import { WORK_DIR_NAME } from '~/utils/constants';

/**
 * Compatibility type exports — these are imported by shell.ts, terminal.ts, Search.tsx
 * and must remain available even though the runner is no longer WebContainer-based.
 */
export type RunnerProcess = {
  output: ReadableStream<string>;
  exit: Promise<number>;
  input: { getWriter: () => { write: (data: string) => void; close: () => void } };
  kill(): void;
  resize(size: { cols: number; rows: number }): void;
};

/** WebContainer textSearch API — matches what Search.tsx expects */
export type TextSearchOptions = {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  isRegex?: boolean;
  include?: string[];
  includes?: string[];   // alias used by some internal callers
  exclude?: string[];
  excludes?: string[];   // alias used by some internal callers
  folders?: string[];
  homeDir?: string;
};

export type TextSearchOnProgressCallback = (
  filePath: string,
  matches: Array<{
    preview: { text: string; matches: Array<{ startLineNumber: number; endLineNumber: number }> };
    ranges: Array<{ startLineNumber: number; startColumn: number; endColumn: number }>;
  }>,
) => void;


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

  // Production fallback — update this to your Railway service URL if different
  return 'wss://sinc-production-21a2.up.railway.app';
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

export type PathWatcherEvent =
  | { type: 'add_file'; path: string; buffer: Uint8Array }
  | { type: 'remove_file'; path: string; buffer: Uint8Array }
  | { type: 'change'; path: string; buffer: Uint8Array }
  | { type: 'add_dir'; path: string; buffer: Uint8Array }
  | { type: 'remove_dir'; path: string; buffer: Uint8Array };

export interface WorkspaceRunner {
  workdir: string;
  fs: {
    writeFile(path: string, data: string | Uint8Array, encoding?: string): Promise<void>;
    readFile(path: string, encoding?: 'utf-8' | 'utf8'): Promise<string>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    readdir(path: string, options?: any): Promise<any[]>;
    rm(path: string, options?: { recursive?: boolean }): Promise<void>;
  };
  internal: {
    watchPaths(
      options: { include: string[]; exclude?: string[]; includeContent?: boolean },
      callback: (events: PathWatcherEvent[]) => void,
    ): { close(): void };
    /** Optional text search — only available if the runner backend supports it */
    textSearch?(
      query: string,
      options: TextSearchOptions,
      onProgress: TextSearchOnProgressCallback,
    ): Promise<void>;
  };
  spawn(cmd: string, args?: string[], options?: any): Promise<any>;
  on(event: string, listener: Function): () => void;
  off(event: string, listener: Function): void;
}


// Request timeout configuration (ms)
const REQUEST_TIMEOUTS: Record<string, number> = {
  writeFile: 15_000,
  readFile: 10_000,
  mkdir: 10_000,
  readdir: 10_000,
  rm: 10_000,
  spawn: 120_000,
  default: 30_000,
};

const HEARTBEAT_INTERVAL_MS = 20_000;
const MAX_RECONNECT_ATTEMPTS = 5;

// Track active process output streams
const processHandlers = new Map<
  number,
  { stdoutController: ReadableStreamDefaultController<string>; resolveExit: (code: number) => void }
>();

class ServerProcessWrapper {
  private _pid: number;
  private _sendCommand: (payload: any) => void;
  private _exitResolve!: (code: number) => void;

  output: ReadableStream<string>;
  exit: Promise<number>;

  constructor(pid: number, sendCommand: (payload: any) => void) {
    this._pid = pid;
    this._sendCommand = sendCommand;

    this.exit = new Promise<number>((resolve) => {
      this._exitResolve = resolve;
    });

    this.output = new ReadableStream<string>({
      start: (controller) => {
        processHandlers.set(pid, {
          stdoutController: controller,
          resolveExit: (code) => {
            try { controller.close(); } catch {}
            this._exitResolve(code);
          },
        });
      },
    });
  }

  input = {
    getWriter: () => ({
      write: (data: string) => {
        this._sendCommand({ type: 'input', args: { pid: this._pid, data } });
      },
      close: () => {},
    }),
  };

  kill() {
    this._sendCommand({ type: 'kill', args: { pid: this._pid } });
    this._exitResolve(1);
  }

  resize(_size: { cols: number; rows: number }) {
    // No-op
  }
}

class VirtualJshProcessWrapper {
  private _sendCommand: (payload: any) => void;
  private _resolveExit: (code: number) => void = () => {};

  output: ReadableStream<string>;
  exit: Promise<number>;
  input: { getWriter: () => { write: (data: string) => void; close: () => void } };

  constructor(sendCommand: (payload: any) => void) {
    this._sendCommand = sendCommand;

    this.exit = new Promise<number>((resolve) => {
      this._resolveExit = resolve;
    });

    let outputController!: ReadableStreamDefaultController<string>;
    this.output = new ReadableStream<string>({
      start(controller) {
        outputController = controller;
      },
    });

    const jshPrompt = '\r\n\x1b[32m❯\x1b[0m ';
    outputController.enqueue(jshPrompt);

    let lineBuffer = '';

    this.input = {
      getWriter: () => ({
        write: (data: string) => {
          if (data === '\r' || data === '\n') {
            const cmd = lineBuffer.trim();
            lineBuffer = '';

            if (!cmd || cmd.startsWith('#')) {
              outputController.enqueue(jshPrompt);
              return;
            }

            outputController.enqueue(`\r\n`);

            const requestId = Math.random().toString(36).substring(2, 9);
            const globalCallbacks = ((window as any)._sincWsCallbacks ??= new Map());
            globalCallbacks.set(requestId, (resp: any) => {
              const output = resp?.data?.output ?? '';
              if (output) {
                outputController.enqueue(output);
              }
              outputController.enqueue(jshPrompt);
            });

            this._sendCommand({
              type: 'spawn',
              requestId,
              args: { command: '/bin/sh', args: ['-c', cmd], cwd: '', env: {} },
            });
          } else if (data === '\x03') {
            outputController.enqueue('^C\r\n');
            outputController.enqueue(jshPrompt);
            lineBuffer = '';
          } else if (data === '\x7f' || data === '\b') {
            if (lineBuffer.length > 0) {
              lineBuffer = lineBuffer.slice(0, -1);
              outputController.enqueue('\b \b');
            }
          } else {
            lineBuffer += data;
            outputController.enqueue(data);
          }
        },
        close: () => {},
      }),
    };
  }

  kill() {
    this._resolveExit(0);
  }

  resize(_size: { cols: number; rows: number }) {
    // No-op
  }
}

class ServerRunner implements WorkspaceRunner {
  private _ws!: WebSocket;
  private _projectId: string;
  private _backendUrl: string;
  private _wsOpenPromise!: Promise<void>;
  private _wsOpenResolve!: () => void;
  private _messageQueue: any[] = [];
  private _pendingRequests = new Map<string, { resolve: Function; reject: Function; payload: any }>();
  private _listeners = new Map<string, Set<Function>>();
  private _watchCallback: ((events: PathWatcherEvent[]) => void) | null = null;
  private _reconnectAttempts = 0;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _isDestroyed = false;

  public fs: any;
  public internal: any;
  public workdir: string = `/home/${WORK_DIR_NAME}`;

  constructor() {
    this._projectId = getProjectId();
    this._backendUrl = getBackendUrl();

    console.log(`[Workspace Init] Session ID: ${this._projectId}`);
    console.log(`[Workspace Init] Connecting to: ${this._backendUrl}/project/${this._projectId}`);

    this._createOpenPromise();
    this._connect();
    this._setupFilesystem();
    this._setupWatcher();
  }

  // ─── Connection Management ────────────────────────────────────────────

  private _createOpenPromise() {
    this._wsOpenPromise = new Promise((resolve) => {
      this._wsOpenResolve = resolve;
    });
  }

  private _connect() {
    if (this._isDestroyed) return;

    const url = `${this._backendUrl}/project/${this._projectId}`;
    this._ws = new WebSocket(url);

    this._ws.onopen = () => {
      console.log('[Workspace] WebSocket connected.');
      this._reconnectAttempts = 0;
      this._wsOpenResolve();
      this._startHeartbeat();

      // Flush queued messages
      while (this._messageQueue.length > 0) {
        const msg = this._messageQueue.shift();
        this._ws.send(JSON.stringify(msg));
      }

      // Replay any pending requests that were waiting before reconnect
      for (const [, { payload }] of this._pendingRequests) {
        this._ws.send(JSON.stringify(payload));
      }

      if (this._reconnectAttempts === 0) {
        this._emit('connected');
      } else {
        this._emit('reconnected');
      }
    };

    this._ws.onmessage = (event) => this._handleMessage(event);

    this._ws.onclose = (evt) => {
      console.warn(`[Workspace] WebSocket closed (code=${evt.code}).`);
      this._stopHeartbeat();

      if (this._isDestroyed) return;

      if (this._reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 10_000);
        this._reconnectAttempts++;
        console.log(`[Workspace] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        this._emit('reconnecting', this._reconnectAttempts);

        // Reset open promise so new requests wait for reconnect
        this._createOpenPromise();

        setTimeout(() => this._connect(), delay);
      } else {
        console.error('[Workspace] Max reconnection attempts reached. Connection permanently lost.');
        // Reject all pending requests so the UI doesn't hang
        for (const [id, { reject }] of this._pendingRequests) {
          reject(new Error('Backend connection lost. Please refresh the page to reconnect.'));
          this._pendingRequests.delete(id);
        }
        this._emit('connection-lost');
      }
    };

    this._ws.onerror = (err) => {
      console.error('[Workspace] WebSocket error:', err);
    };
  }

  private _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this._ws.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // ─── Message Handling ─────────────────────────────────────────────────

  private _handleMessage(event: MessageEvent) {
    let payload: any;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    const { type, requestId, data, error, pid, exitCode, path: changedPath } = payload;

    // Pong response — ignore
    if (type === 'pong') return;

    // Handle standard request/response
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

      // Handle global window callback mapping (jsh process spawns)
      const globalCallbacks = (window as any)._sincWsCallbacks;
      if (globalCallbacks && globalCallbacks.has(requestId)) {
        const cb = globalCallbacks.get(requestId);
        globalCallbacks.delete(requestId);
        cb(payload);
      }
    }

    // Handle process output stream
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

    // Handle Vite/Dev Server ready event
    if (type === 'server-ready') {
      const port = payload.port;
      const proxyUrl = `${this._backendUrl.replace('ws', 'http')}/preview/${this._projectId}/${port}/`;
      console.log(`[Workspace] Server ready at port ${port} → ${proxyUrl}`);
      this._emit('server-ready', port, proxyUrl);
      this._emit('port', port, 'open', proxyUrl);
    }

    // Handle file watcher notifications
    if (type === 'file-changed' && this._watchCallback) {
      let normalizedPath = changedPath;
      if (normalizedPath.startsWith('home/project/')) {
        normalizedPath = '/' + normalizedPath;
      } else if (normalizedPath === 'home/project') {
        normalizedPath = '/home/project';
      } else if (!normalizedPath.startsWith('/home/project/')) {
        normalizedPath = `/home/project/${normalizedPath}`;
      }

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

      const isFileChange = eventType === 'change' || eventType === 'add_file';
      if (!isFileChange || payload.hasContent) {
        this._watchCallback([{ type: eventType, path: normalizedPath, buffer }]);
      }
    }
  }

  // ─── Request Helpers ──────────────────────────────────────────────────

  private async _sendRequest(type: string, args: any): Promise<any> {
    await this._wsOpenPromise;

    const requestId = Math.random().toString(36).substring(2, 9);
    const payload = { type, requestId, args };
    const timeoutMs = REQUEST_TIMEOUTS[type] ?? REQUEST_TIMEOUTS.default;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this._pendingRequests.has(requestId)) {
          this._pendingRequests.delete(requestId);
          reject(new Error(`Request '${type}' timed out after ${timeoutMs}ms — backend may be overloaded`));
        }
      }, timeoutMs);

      this._pendingRequests.set(requestId, {
        resolve: (data: any) => { clearTimeout(timer); resolve(data); },
        reject: (err: any) => { clearTimeout(timer); reject(err); },
        payload,
      });

      this._ws.send(JSON.stringify(payload));
    });
  }

  private _sendCommand(payload: any) {
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(payload));
    } else {
      this._messageQueue.push(payload);
    }
  }

  // ─── Filesystem ───────────────────────────────────────────────────────

  private _setupFilesystem() {
    this.fs = {
      writeFile: async (path: string, data: string | Uint8Array, _encoding?: string) => {
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
      },
    };
  }

  // ─── File Watcher ─────────────────────────────────────────────────────

  private _setupWatcher() {
    this.internal = {
      watchPaths: (
        _options: { include: string[]; exclude?: string[]; includeContent?: boolean },
        callback: (events: PathWatcherEvent[]) => void,
      ) => {
        this._watchCallback = callback;
        return {
          close: () => {
            this._watchCallback = null;
          },
        };
      },
    };
  }

  // ─── Process Spawning ─────────────────────────────────────────────────

  async spawn(cmd: string, args?: string[], options?: any) {
    if (cmd === '/bin/jsh') {
      return new VirtualJshProcessWrapper(this._sendCommand.bind(this));
    }

    const cleanArgs = args || [];
    const response = await this._sendRequest('spawn', {
      command: cmd,
      args: cleanArgs,
      cwd: options?.cwd || '',
      env: options?.env || {},
    });

    const pid = response.pid;
    return new ServerProcessWrapper(pid, this._sendCommand.bind(this));
  }

  // ─── Event Emitter ────────────────────────────────────────────────────

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
          console.error(`Error in event listener for '${event}':`, e);
        }
      }
    }
  }

  destroy() {
    this._isDestroyed = true;
    this._stopHeartbeat();
    this._ws.close();
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

        // Listen to workbench stores HMR updates setup
        import('~/lib/stores/workbench').then(({ workbenchStore }) => {
          wrapper.on('port', (port: number, type: 'open' | 'close') => {
            if (type === 'close') {
              console.log(`Port ${port} closed.`);
            }
          });

          // Surface connection events to workbench store
          wrapper.on('connection-lost', () => {
            workbenchStore.setRunnerConnectionStatus('disconnected');
          });
          wrapper.on('reconnecting', () => {
            workbenchStore.setRunnerConnectionStatus('reconnecting');
          });
          wrapper.on('reconnected', () => {
            workbenchStore.setRunnerConnectionStatus('connected');
          });
          wrapper.on('connected', () => {
            workbenchStore.setRunnerConnectionStatus('connected');
          });
        });

        return wrapper;
      });

  if (import.meta.hot) {
    import.meta.hot.data.runner = runner;
  }
}
