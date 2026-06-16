import { WORK_DIR_NAME } from '~/utils/constants';

// Resolve backend runner websocket URL
const getBackendUrl = (): string => {
  if (typeof window === 'undefined') return '';
  
  // Try custom environment variable
  const envUrl = import.meta.env.VITE_BACKEND_RUNNER_URL;
  if (envUrl) return envUrl;

  // Local development fallback
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'ws://localhost:8080';
  }

  // Production fallback
  return 'wss://sinc-backend-runner.up.railway.app';
};

// Dynamically resolve projectId from Chat ID in the URL, fallback to sessionStorage UUID
const getProjectId = (): string => {
  if (typeof window === 'undefined') return 'default';
  
  const match = window.location.pathname.match(/\/chat\/([^/]+)/);
  if (match && match[1]) {
    return match[1];
  }

  let sessionId = sessionStorage.getItem('sinc_session_project_id');
  if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('sinc_session_project_id', sessionId);
  }
  return sessionId;
};

export interface PathWatcherEvent {
  type: 'add_dir' | 'remove_dir' | 'add_file' | 'change' | 'remove_file' | 'update_directory';
  path: string;
  buffer?: Uint8Array;
}

export interface TextSearchOptions {
  folders: string[];
  [key: string]: any;
}

export type TextSearchOnProgressCallback = (filePath: string, matches: any[]) => void;

export interface RunnerProcess {
  input: WritableStream<string>;
  output: ReadableStream<string>;
  exit: Promise<number>;
  resize(size: { cols: number; rows: number }): void;
  kill(): void;
}

export interface WorkspaceRunner {
  fs: {
    writeFile(path: string, data: string | Uint8Array, encoding?: string): Promise<void>;
    readFile(path: string, encoding?: 'utf-8' | 'utf8'): Promise<string>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    readdir(path: string, options?: { withFileTypes?: boolean; [key: string]: any }): Promise<any[]>;
    rm(path: string, options?: { recursive?: boolean }): Promise<void>;
  };
  internal: {
    watchPaths(
      options: { include: string[]; exclude?: string[]; includeContent?: boolean },
      callback: (events: PathWatcherEvent[]) => void
    ): { close(): void };
    textSearch?(
      query: string,
      options: TextSearchOptions,
      onProgress: TextSearchOnProgressCallback
    ): Promise<void>;
  };
  workdir: string;
  spawn(cmd: string, args?: string[], options?: any): Promise<RunnerProcess>;
  on(event: string, listener: Function): () => void;
  off(event: string, listener: Function): void;
}

interface RunnerContext {
  loaded: boolean;
}

export const runnerContext: RunnerContext = import.meta.hot?.data.runnerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.runnerContext = runnerContext;
}

// Map representing processes output controllers: pid -> Controller/Handlers
const processHandlers = new Map<string, {
  stdoutController: ReadableStreamDefaultController<string> | null;
  stderrController: ReadableStreamDefaultController<string> | null;
  resolveExit: (code: number) => void;
}>();

class ServerProcessWrapper implements RunnerProcess {
  public input: WritableStream<string>;
  public output: ReadableStream<string>;
  public exit: Promise<number>;

  constructor(pid: string, sendCommand: (payload: any) => void) {
    let stdoutCtrl: ReadableStreamDefaultController<string> | null = null;
    this.output = new ReadableStream<string>({
      start(c) {
        stdoutCtrl = c;
      }
    });

    this.exit = new Promise<number>((resolve) => {
      processHandlers.set(pid, {
        stdoutController: stdoutCtrl,
        stderrController: null,
        resolveExit: resolve
      });
    });

    this.input = new WritableStream<string>({
      write(chunk) {
        sendCommand({
          type: 'input',
          args: { pid, data: chunk }
        });
      }
    });
  }

  resize(size: { cols: number; rows: number }) {
    // No-op for standard background process wraps
  }

  kill() {
    // Handled via runner connection wrappers
  }
}

class VirtualJshProcessWrapper implements RunnerProcess {
  public input: WritableStream<string>;
  public output: ReadableStream<string>;
  public exit: Promise<number>;
  private _resolveExit!: (code: number) => void;
  private _activeProcessPid: string | null = null;
  private _sendCommand: (payload: any) => void;

  constructor(sendCmd: (payload: any) => void) {
    this._sendCommand = sendCmd;
    
    let controller: ReadableStreamDefaultController<string>;
    this.output = new ReadableStream<string>({
      start(c) {
        controller = c;
      }
    });

    this.exit = new Promise<number>((resolve) => {
      this._resolveExit = resolve;
    });

    // Send the interactive initialization signal to xterm.js
    setTimeout(() => {
      try {
        controller.enqueue('\x1b]654;interactive\x07');
        controller.enqueue('\r\n\x1b[36mproject\x1b[0m:\x1b[34m/home/project\x1b[0m$ ');
        controller.enqueue('\x1b]654;prompt\x07');
      } catch (e) {
        console.warn('[Virtual JSH] Failed to initialize:', e);
      }
    }, 100);

    let commandBuffer = '';

    this.input = new WritableStream<string>({
      write: async (chunk) => {
        // Echo input back so the user sees typing in terminal
        controller.enqueue(chunk);

        if (chunk === '\x03') { // Ctrl+C
          commandBuffer = '';
          if (this._activeProcessPid) {
            this._sendCommand({
              type: 'kill',
              args: { pid: this._activeProcessPid }
            });
          }
          controller.enqueue('^C\r\n');
          controller.enqueue('\x1b]654;prompt\x07');
          return;
        }

        if (chunk === '\x7f' || chunk === '\b') { // Backspace
          if (commandBuffer.length > 0) {
            commandBuffer = commandBuffer.slice(0, -1);
            controller.enqueue('\b \b');
          }
          return;
        }

        commandBuffer += chunk;

        if (commandBuffer.endsWith('\r') || commandBuffer.endsWith('\n')) {
          let command = commandBuffer.trim();
          commandBuffer = '';

          // Strip out comment lines to prevent execution bugs
          command = command
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('//') && !line.startsWith('#'))
            .join('\n');

          if (!command) {
            controller.enqueue('\r\n\x1b[36mproject\x1b[0m:\x1b[34m/home/project\x1b[0m$ ');
            controller.enqueue('\x1b]654;prompt\x07');
            return;
          }

          try {
            controller.enqueue('\r\n');

            // Send spawn request to backend
            const requestId = Math.random().toString(36).substring(2, 9);
            
            const onSpawnResponse = (response: any) => {
              if (response.error) {
                controller.enqueue(`sh: spawn failed: ${response.error}\r\n`);
                controller.enqueue(`\x1b]654;exit=127:1\x07`);
                controller.enqueue('\r\n\x1b[36mproject\x1b[0m:\x1b[34m/home/project\x1b[0m$ ');
                controller.enqueue('\x1b]654;prompt\x07');
                return;
              }

              const pid = response.data.pid;
              this._activeProcessPid = pid;

              // Override stdout/stderr output handlers
              processHandlers.set(pid, {
                stdoutController: {
                  enqueue: (data: string) => controller.enqueue(data),
                  close: () => {},
                  error: () => {}
                } as any,
                stderrController: null,
                resolveExit: (code: number) => {
                  this._activeProcessPid = null;
                  controller.enqueue(`\x1b]654;exit=${code}:1\x07`);
                  controller.enqueue('\r\n\x1b[36mproject\x1b[0m:\x1b[34m/home/project\x1b[0m$ ');
                  controller.enqueue('\x1b]654;prompt\x07');
                }
              });
            };

            // Register temporary callback for spawn response
            (window as any)._sincWsCallbacks = (window as any)._sincWsCallbacks || new Map();
            (window as any)._sincWsCallbacks.set(requestId, onSpawnResponse);

            this._sendCommand({
              type: 'spawn',
              requestId,
              args: {
                command,
                args: [],
                cwd: '',
                env: {}
              }
            });

          } catch (err: any) {
            controller.enqueue(`sh: command failed: ${err.message}\r\n`);
            controller.enqueue(`\x1b]654;exit=127:1\x07`);
            controller.enqueue('\r\n\x1b[36mproject\x1b[0m:\x1b[34m/home/project\x1b[0m$ ');
            controller.enqueue('\x1b]654;prompt\x07');
          }
        }
      }
    });
  }

  kill() {
    if (this._activeProcessPid) {
      this._sendCommand({
        type: 'kill',
        args: { pid: this._activeProcessPid }
      });
    }
    this._resolveExit(0);
  }

  resize(size: { cols: number; rows: number }) {
    // No-op
  }
}

class ServerRunner implements WorkspaceRunner {
  private _ws!: WebSocket;
  private _projectId: string;
  private _backendUrl: string;
  private _wsOpenPromise: Promise<void>;
  private _messageQueue: any[] = [];
  private _pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
  private _listeners = new Map<string, Set<Function>>();
  private _watchCallback: ((events: PathWatcherEvent[]) => void) | null = null;

  public fs: any;
  public internal: any;
  public workdir: string = `/home/${WORK_DIR_NAME}`;

  constructor() {
    this._projectId = getProjectId();
    this._backendUrl = getBackendUrl();

    console.log(`[Workspace Init] Session ID: ${this._projectId}`);
    console.log(`[Workspace Init] Connecting to: ${this._backendUrl}/project/${this._projectId}`);

    // Create websocket connection
    this._ws = new WebSocket(`${this._backendUrl}/project/${this._projectId}`);
    
    this._wsOpenPromise = new Promise((resolve) => {
      this._ws.onopen = () => {
        console.log('[Workspace Init] WebSocket channel open.');
        resolve();
        // Flush queue
        while (this._messageQueue.length > 0) {
          const msg = this._messageQueue.shift();
          this._ws.send(JSON.stringify(msg));
        }
      };
    });

    this._ws.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      const { type, requestId, data, error, pid, exitCode, path: changedPath } = payload;

      // Handle standard command responses
      if (type === 'response') {
        const pending = this._pendingRequests.get(requestId);
        if (pending) {
          this._pendingRequests.delete(requestId);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(data);
          }
        }
        
        // Handle global window callback mapping (e.g. for jsh process spawns)
        const globalCallbacks = (window as any)._sincWsCallbacks;
        if (globalCallbacks && globalCallbacks.has(requestId)) {
          const cb = globalCallbacks.get(requestId);
          globalCallbacks.delete(requestId);
          cb(payload);
        }
      }

      // Handle process output stream redirection
      if (type === 'process-output') {
        const handler = processHandlers.get(pid);
        if (handler && handler.stdoutController) {
          handler.stdoutController.enqueue(data);
        }
      }

      // Handle process completion
      if (type === 'process-exit') {
        const handler = processHandlers.get(pid);
        if (handler) {
          processHandlers.delete(pid);
          handler.resolveExit(exitCode);
        }
      }

      // Handle Vite / Dev Server ready proxy event
      if (type === 'server-ready') {
        const port = payload.port;
        // Rewrite proxy URL to land on backend router
        const proxyUrl = `${this._backendUrl.replace('ws', 'http')}/preview/${this._projectId}/${port}/`;
        console.log(`[Server Ready] Port ${port} mapped to proxy URL: ${proxyUrl}`);
        this._emit('server-ready', port, proxyUrl);
        this._emit('port', port, 'open', proxyUrl);
      }

      // Handle file watcher notification
      if (type === 'file-changed' && this._watchCallback) {
        // Map backend relative path back to expected frontend layout path
        let normalizedPath = changedPath;
        if (normalizedPath.startsWith('home/project/')) {
          normalizedPath = '/' + normalizedPath;
        } else if (normalizedPath === 'home/project') {
          normalizedPath = '/home/project';
        } else if (!normalizedPath.startsWith('/home/project/')) {
          normalizedPath = `/home/project/${normalizedPath}`;
        }

        // Map chokidar event to PathWatcherEvent type
        let eventType: PathWatcherEvent['type'] = 'change';
        if (payload.event === 'add') {
          eventType = 'add_file';
        } else if (payload.event === 'unlink') {
          eventType = 'remove_file';
        } else if (payload.event === 'addDir') {
          eventType = 'add_dir';
        } else if (payload.event === 'unlinkDir') {
          eventType = 'remove_dir';
        }

        // Convert base64 content back to Uint8Array if provided
        let buffer = new Uint8Array();
        if (payload.hasContent && payload.content) {
          try {
            const binaryString = window.atob(payload.content);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            buffer = bytes;
          } catch (e) {
            console.error('Failed to decode file watcher content:', e);
          }
        }

        // For file addition/modification, only trigger update if we have the content
        // or if it's a removal/directory event. This prevents overwriting store files with empty strings.
        const isFileChange = eventType === 'change' || eventType === 'add_file';
        if (!isFileChange || payload.hasContent) {
          this._watchCallback([{
            type: eventType,
            path: normalizedPath,
            buffer
          }]);
        }
      }
    };

    this._ws.onclose = () => {
      console.warn('[Workspace Init] WebSocket connection closed.');
    };

    this._ws.onerror = (err) => {
      console.error('[Workspace Init] WebSocket encountered error:', err);
    };

    // 1. Filesystem implementation
    this.fs = {
      writeFile: async (path: string, data: string | Uint8Array, _encoding?: string) => {
        // Ensure data is converted to string for transmission
        const contentStr = typeof data === 'string' ? data : new TextDecoder().decode(data);
        await this._sendRequest('writeFile', { path, content: contentStr });
      },
      readFile: async (path: string, encoding?: 'utf-8' | 'utf8') => {
        const res = await this._sendRequest('readFile', { path, encoding: encoding || 'utf8' });
        return res.content;
      },
      mkdir: async (path: string, options?: { recursive?: boolean }) => {
        await this._sendRequest('mkdir', { path, options });
      },
      readdir: async (path: string, options?: any) => {
        const res = await this._sendRequest('readdir', { path, options });
        return res.files;
      },
      rm: async (path: string, options?: { recursive?: boolean }) => {
        await this._sendRequest('rm', { path, options });
      }
    };

    // 2. File Watcher implementation
    this.internal = {
      watchPaths: (
        options: { include: string[]; exclude?: string[]; includeContent?: boolean },
        callback: (events: PathWatcherEvent[]) => void
      ) => {
        this._watchCallback = callback;
        return {
          close: () => {
            this._watchCallback = null;
          }
        };
      }
    };
  }

  // Private helper to send websocket requests and wrap in Promise
  private async _sendRequest(type: string, args: any): Promise<any> {
    await this._wsOpenPromise;
    
    const requestId = Math.random().toString(36).substring(2, 9);
    const payload = { type, requestId, args };

    return new Promise((resolve, reject) => {
      this._pendingRequests.set(requestId, { resolve, reject });
      this._ws.send(JSON.stringify(payload));
    });
  }

  // Private helper for one-way WebSocket outputs
  private _sendCommand(payload: any) {
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(payload));
    } else {
      this._messageQueue.push(payload);
    }
  }

  async spawn(cmd: string, args?: string[], options?: any) {
    if (cmd === '/bin/jsh') {
      return new VirtualJshProcessWrapper(this._sendCommand.bind(this));
    }

    // Call spawn on backend
    const cleanArgs = args || [];
    const response = await this._sendRequest('spawn', {
      command: cmd,
      args: cleanArgs,
      cwd: options?.cwd || '',
      env: options?.env || {}
    });

    const pid = response.pid;
    return new ServerProcessWrapper(pid, this._sendCommand.bind(this));
  }

  on(event: string, listener: Function) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off(event: string, listener: Function) {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }

  private _emit(event: string, ...args: any[]) {
    const set = this._listeners.get(event);
    if (set) {
      for (const listener of set) {
        try {
          listener(...args);
        } catch (e) {
          console.error(`Error in event listener for ${event}:`, e);
        }
      }
    }
  }
}

export let runner: Promise<WorkspaceRunner> = new Promise(() => {
  // noop for SSR
});

if (!import.meta.env.SSR) {
  runner =
    import.meta.hot?.data.runner ??
    Promise.resolve()
      .then(() => {
        const wrapper = new ServerRunner();
        runnerContext.loaded = true;
        
        // Listen to workbench stores HMR updates setup
        import('~/lib/stores/workbench').then(({ workbenchStore }) => {
          // Listen for preview/port failures
          wrapper.on('port', (port: number, type: 'open' | 'close') => {
            if (type === 'close') {
              console.log(`Port ${port} closed.`);
            }
          });
        });

        return wrapper;
      });

  if (import.meta.hot) {
    import.meta.hot.data.runner = runner;
  }
}
