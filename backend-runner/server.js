import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Projects parent directory on the server
const PROJECTS_BASE_DIR = process.env.PROJECTS_DIR || path.join(__dirname, 'projects');

const app = express();
app.use(cors());
app.use(express.json());

// Active child processes tracker: projectId -> Map(pid -> ChildProcess)
const activeProcesses = new Map();
// Active file watchers: projectId -> FSWatcher
const fileWatchers = new Map();
// Active WebSocket connections tracker: projectId -> Set(ws)
const projectSockets = new Map();
// Delayed project cleanup timers tracker: projectId -> timerId
const projectCleanupTimers = new Map();
// Active proxy middleware instances tracker: projectId-port -> ProxyMiddleware
const activeProxies = new Map();

// Configure CORS and security headers globally to support COOP/COEP/CORP
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// Middleware to proxy absolute root-relative asset requests (e.g. /main.js)
// by extracting the project context from the Referer header or cookie fallback.
app.use((req, res, next) => {
  // If the path already has /preview/ or /project/ or /health, let it pass to its router
  if (req.path.startsWith('/preview/') || req.path.startsWith('/project/') || req.path === '/health') {
    return next();
  }

  let projectId;
  let portStr;

  // 1. Try to extract from Referer header
  const referer = req.headers.referer;
  if (referer) {
    const match = referer.match(/\/preview\/([^/]+)\/(\d+)/);
    if (match) {
      projectId = match[1];
      portStr = match[2];
    }
  }

  // 2. Fallback to cookies if referer didn't have the preview prefix
  if (!projectId || !portStr) {
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const cookies = {};
      cookieHeader.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        cookies[parts.shift().trim()] = decodeURI(parts.join('='));
      });
      projectId = cookies['preview_projectId'];
      portStr = cookies['preview_port'];
    }
  }

  if (projectId && portStr) {
    const targetPort = parseInt(portStr, 10);
    if (!isNaN(targetPort)) {
      const proxyKey = `${projectId}-${portStr}`;
      let proxy = activeProxies.get(proxyKey);

      if (!proxy) {
        proxy = createProxyMiddleware({
          target: `http://localhost:${targetPort}`,
          changeOrigin: true,
          ws: false,
          pathRewrite: (pathStr, reqObj) => pathStr,
          logger: console,
          on: {
            proxyRes: (proxyRes, req, res) => {
              proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';
              proxyRes.headers['cross-origin-embedder-policy'] = 'require-corp';
              proxyRes.headers['cross-origin-opener-policy'] = 'same-origin';
            },
            error: (err, req, res) => {
              console.error(`[Fallback Proxy Error] ${projectId}:${targetPort} ->`, err.message);
              if (res.status) {
                res.status(502).send(`Asset preview not ready. error: ${err.message}`);
              }
            }
          }
        });
        activeProxies.set(proxyKey, proxy);
      }

      return proxy(req, res, next);
    }
  }

  next();
});

// Helper to resolve workspace paths and prevent directory traversal
function resolveWorkspacePath(projectId, relPath) {
  const projectDir = path.resolve(PROJECTS_BASE_DIR, projectId);
  
  // Normalize drive letter casing on Windows to prevent path.relative mismatches
  const normalizeDrive = (p) => {
    if (p && p.length >= 2 && p[1] === ':') {
      return p[0].toUpperCase() + p.slice(1);
    }
    return p;
  };

  const normProjectDir = normalizeDrive(projectDir);
  
  // Normalize slashes and strip leading ../ loops just like the frontend client wrapper
  let cleanPath = relPath.replace(/\\/g, '/');
  while (cleanPath.startsWith('../')) {
    cleanPath = cleanPath.slice(3);
  }
  
  // Resolve target path
  let targetPath;
  if (cleanPath.startsWith('/home/project')) {
    targetPath = path.resolve(normProjectDir, cleanPath.slice(1));
  } else if (cleanPath.startsWith('/home')) {
    targetPath = path.resolve(normProjectDir, cleanPath.slice(1));
  } else if (cleanPath.startsWith('/')) {
    targetPath = path.resolve(normProjectDir, 'home', 'project', cleanPath.slice(1));
  } else {
    targetPath = path.resolve(normProjectDir, 'home', 'project', cleanPath);
  }
  
  const normTargetPath = normalizeDrive(targetPath);
  
  const relativeToProject = path.relative(normProjectDir, normTargetPath);
  if (relativeToProject.startsWith('..') || path.isAbsolute(relativeToProject)) {
    throw new Error(`Directory traversal attempt detected: ${relPath}`);
  }
  return normTargetPath;
}

// 1. Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// 2. Preview Reverse Proxy Middleware
// Maps /preview/:projectId/:port/* -> http://localhost:<port>
app.use('/preview/:projectId/:port', (req, res, next) => {
  const { projectId, port } = req.params;
  const targetPort = parseInt(port, 10);
  
  if (isNaN(targetPort)) {
    return res.status(400).send('Invalid port number');
  }

  // Set cookies to track target project and port for root-relative asset fallbacks
  res.setHeader('Set-Cookie', [
    `preview_projectId=${projectId}; Path=/; SameSite=Lax`,
    `preview_port=${port}; Path=/; SameSite=Lax`
  ]);

  const proxyKey = `${projectId}-${port}`;
  let proxy = activeProxies.get(proxyKey);

  if (!proxy) {
    // Create proxy middleware and cache it
    proxy = createProxyMiddleware({
      target: `http://localhost:${targetPort}`,
      changeOrigin: true,
      ws: false,
      pathRewrite: (pathStr, reqObj) => {
        // Strip /preview/:projectId/:port from request path
        const prefix = `/preview/${projectId}/${port}`;
        return pathStr.startsWith(prefix) ? pathStr.slice(prefix.length) || '/' : pathStr;
      },
      logger: console,
      on: {
        proxyRes: (proxyRes, req, res) => {
          proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';
          proxyRes.headers['cross-origin-embedder-policy'] = 'require-corp';
          proxyRes.headers['cross-origin-opener-policy'] = 'same-origin';
        },
        error: (err, req, res) => {
          console.error(`[Proxy Error] ${projectId}:${targetPort} ->`, err.message);
          if (res.status) {
            res.status(502).send(`Preview not ready or failed to load. error: ${err.message}`);
          }
        }
      }
    });
    activeProxies.set(proxyKey, proxy);
  }

  return proxy(req, res, next);
});

// Start HTTP Server
const port = process.env.PORT || 8080;
const server = createServer(app);

// 3. WebSocket Server for shell terminals and filesync
const wss = new WebSocketServer({ noServer: true });

// Upgrade WebSocket request
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname;
  
  // Handshake route: /project/:projectId
  const match = pathname.match(/^\/project\/([^/]+)$/);
  if (match) {
    const projectId = match[1];
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, projectId);
    });
  } else if (pathname.startsWith('/preview/')) {
    // Extract projectId and port from pathname /preview/projectId/port/...
    const parts = pathname.split('/');
    const projectId = parts[2];
    const portStr = parts[3];
    const targetPort = parseInt(portStr, 10);
    
    if (projectId && !isNaN(targetPort)) {
      const proxyKey = `${projectId}-${portStr}`;
      let proxy = activeProxies.get(proxyKey);
      
      if (!proxy) {
        proxy = createProxyMiddleware({
          target: `http://localhost:${targetPort}`,
          changeOrigin: true,
          ws: false,
          pathRewrite: (pathStr, reqObj) => {
            const prefix = `/preview/${projectId}/${portStr}`;
            return pathStr.startsWith(prefix) ? pathStr.slice(prefix.length) || '/' : pathStr;
          },
          logger: console,
          on: {
            proxyRes: (proxyRes, req, res) => {
              proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';
              proxyRes.headers['cross-origin-embedder-policy'] = 'require-corp';
              proxyRes.headers['cross-origin-opener-policy'] = 'same-origin';
            },
            error: (err, req, res) => {
              console.error(`[Proxy Upgrade Error] ${projectId}:${targetPort} ->`, err.message);
              if (res && typeof res.destroy === 'function') {
                res.destroy();
              }
            }
          }
        });
        activeProxies.set(proxyKey, proxy);
      }
      
      if (typeof proxy.upgrade === 'function') {
        proxy.upgrade(request, socket, head);
      } else {
        socket.destroy();
      }
    } else {
      socket.destroy();
    }
  } else {
    // Check Referer header or cookies for HMR and other root WebSocket connections
    let projectId;
    let portStr;

    // 1. Try to extract from Referer
    const referer = request.headers.referer;
    if (referer) {
      const matchReferer = referer.match(/\/preview\/([^/]+)\/(\d+)/);
      if (matchReferer) {
        projectId = matchReferer[1];
        portStr = matchReferer[2];
      }
    }

    // 2. Fallback to cookies if referer didn't match
    if (!projectId || !portStr) {
      const cookieHeader = request.headers.cookie;
      if (cookieHeader) {
        const cookies = {};
        cookieHeader.split(';').forEach((cookie) => {
          const parts = cookie.split('=');
          cookies[parts.shift().trim()] = decodeURI(parts.join('='));
        });
        projectId = cookies['preview_projectId'];
        portStr = cookies['preview_port'];
      }
    }

    if (projectId && portStr) {
      const targetPort = parseInt(portStr, 10);
      if (!isNaN(targetPort)) {
        const proxyKey = `${projectId}-${portStr}`;
        let proxy = activeProxies.get(proxyKey);
        
        if (!proxy) {
          proxy = createProxyMiddleware({
            target: `http://localhost:${targetPort}`,
            changeOrigin: true,
            ws: false,
            pathRewrite: (pathStr, reqObj) => pathStr,
            logger: console,
            on: {
              proxyRes: (proxyRes, req, res) => {
                proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';
                proxyRes.headers['cross-origin-embedder-policy'] = 'require-corp';
                proxyRes.headers['cross-origin-opener-policy'] = 'same-origin';
              },
              error: (err, req, res) => {
                console.error(`[Proxy Upgrade Error] ${projectId}:${targetPort} ->`, err.message);
                if (res && typeof res.destroy === 'function') {
                  res.destroy();
                }
              }
            }
          });
          activeProxies.set(proxyKey, proxy);
        }
        
        if (typeof proxy.upgrade === 'function') {
          return proxy.upgrade(request, socket, head);
        }
      }
    }
    socket.destroy();
  }
});

wss.on('connection', async (ws, request, projectId) => {
  console.log(`[WS Connected] Project: ${projectId}`);
  
  // Cancel any pending cleanup timer for this project
  if (projectCleanupTimers.has(projectId)) {
    clearTimeout(projectCleanupTimers.get(projectId));
    projectCleanupTimers.delete(projectId);
    console.log(`[Clean Up] Cancelled pending cleanup for project ${projectId} (reconnected)`);
  }

  // Track the active WebSocket connection
  if (!projectSockets.has(projectId)) {
    projectSockets.set(projectId, new Set());
  }
  projectSockets.get(projectId).add(ws);
  
  const projectDir = path.resolve(PROJECTS_BASE_DIR, projectId);
  
  // Ensure workspace directory exists
  try {
    await fs.mkdir(projectDir, { recursive: true });
  } catch (e) {
    console.error(`Failed to create directory for project ${projectId}:`, e.message);
  }

  // Initialize process storage for project
  if (!activeProcesses.has(projectId)) {
    activeProcesses.set(projectId, new Map());
  }
  const projectProcesses = activeProcesses.get(projectId);

  // Setup chokidar file watcher to notify UI of file changes (hot reload helper)
  if (!fileWatchers.has(projectId)) {
    const watcher = chokidar.watch(projectDir, {
      ignored: [/(^|[\/\\])\../, '**/node_modules/**', '**/dist/**', '**/build/**'],
      persistent: true,
      ignoreInitial: true
    });
    
    watcher.on('all', async (event, filePath) => {
      const relPath = path.relative(projectDir, filePath).replace(/\\/g, '/');
      try {
        let contentBuffer = null;
        let hasContent = false;
        if (event === 'add' || event === 'change') {
          try {
            const stats = await fs.stat(filePath);
            if (stats.isFile() && stats.size < 2 * 1024 * 1024) { // Only read files under 2MB
              contentBuffer = await fs.readFile(filePath);
              hasContent = true;
            }
          } catch (err) {
            // File might have been deleted quickly or permission issues
          }
        }

        const message = JSON.stringify({
          type: 'file-changed',
          event,
          path: relPath,
          content: contentBuffer ? contentBuffer.toString('base64') : undefined,
          hasContent
        });

        // Broadcast to all active sockets for this project
        const activeSockets = projectSockets.get(projectId);
        if (activeSockets) {
          for (const socket of activeSockets) {
            if (socket.readyState === 1) { // WebSocket.OPEN
              socket.send(message);
            }
          }
        }
      } catch {}
    });
    
    fileWatchers.set(projectId, watcher);
  }

  // Handle incoming WebSocket messages
  ws.on('message', async (message) => {
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch {
      return console.error('Invalid message format received');
    }

    const { type, requestId, args } = payload;
    const sendResponse = (data, error = null) => {
      try {
        ws.send(JSON.stringify({
          type: 'response',
          requestId,
          data,
          error
        }));
      } catch {}
    };

    try {
      switch (type) {
        case 'init': {
          sendResponse({ initialized: true });
          break;
        }

        case 'writeFile': {
          const { path: relPath, content } = args;
          const targetPath = resolveWorkspacePath(projectId, relPath);
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, content);
          sendResponse({ success: true });
          break;
        }

        case 'mkdir': {
          const { path: relPath, options = {} } = args;
          const targetPath = resolveWorkspacePath(projectId, relPath);
          await fs.mkdir(targetPath, { recursive: options.recursive ?? true });
          sendResponse({ success: true });
          break;
        }

        case 'readFile': {
          const { path: relPath, encoding = 'utf8' } = args;
          const targetPath = resolveWorkspacePath(projectId, relPath);
          const data = await fs.readFile(targetPath, encoding);
          sendResponse({ content: data });
          break;
        }

        case 'readdir': {
          const { path: relPath } = args;
          const targetPath = resolveWorkspacePath(projectId, relPath);
          const files = await fs.readdir(targetPath, { withFileTypes: true });
          const result = files.map(f => ({
            name: f.name,
            isDirectory: f.isDirectory(),
            isFile: f.isFile()
          }));
          sendResponse({ files: result });
          break;
        }

        case 'rm': {
          const { path: relPath, options = {} } = args;
          const targetPath = resolveWorkspacePath(projectId, relPath);
          await fs.rm(targetPath, { recursive: options.recursive ?? true, force: true });
          sendResponse({ success: true });
          break;
        }

        case 'spawn': {
          const { command, args: cmdArgs = [], cwd = '', env = {} } = args;
          let runCwd;
          try {
            runCwd = resolveWorkspacePath(projectId, cwd);
            // Ensure the cwd directory exists on disk to prevent spawn ENOENT error
            await fs.mkdir(runCwd, { recursive: true });
          } catch (err) {
            console.error(`[Spawn Error] Directory creation failed:`, err.message);
            return sendResponse(null, `Failed to initialize spawn directory: ${err.message}`);
          }
          
          console.log(`[Spawn] Project ${projectId}: ${command} ${cmdArgs.join(' ')}`);

          const mergedEnv = {
            ...process.env,
            ...env,
            PORT: env.PORT || '0', // Let systems allocate ports dynamically
            FORCE_COLOR: '1' // Force color outputs in terminal
          };

          const isWindows = process.platform === 'win32';
          const shellOption = isWindows 
            ? (process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe')
            : true;

          let child;
          try {
            child = spawn(command, cmdArgs, {
              cwd: runCwd,
              env: mergedEnv,
              shell: shellOption
            });
          } catch (spawnError) {
            console.error(`[Spawn Error] Project ${projectId}:`, spawnError.message);
            return sendResponse(null, `Failed to spawn command: ${spawnError.message}`);
          }

          // Register error handler immediately so asynchronous spawn errors are caught
          // and do not crash the Node.js process.
          child.on('error', (err) => {
            console.error(`[Process Error] Project ${projectId}:`, err.message);
            const pidStr = child.pid ? child.pid.toString() : 'unknown';
            projectProcesses.delete(pidStr);
            try {
              ws.send(JSON.stringify({
                type: 'process-exit',
                pid: pidStr,
                exitCode: 1,
                error: err.message
              }));
            } catch {}
          });

          if (!child || !child.pid) {
            console.error(`[Spawn Error] Project ${projectId}: Child process object or PID is missing`);
            return sendResponse(null, 'Failed to initialize child process');
          }

          const procId = child.pid.toString();
          projectProcesses.set(procId, child);

          // Notify frontend that spawn completed with process ID
          sendResponse({ pid: procId });

          // Send stdout/stderr outputs to frontend
          if (child.stdout) {
            child.stdout.on('data', (data) => {
              const outputStr = data.toString();
              try {
                ws.send(JSON.stringify({
                  type: 'process-output',
                  pid: procId,
                  stream: 'stdout',
                  data: outputStr
                }));
              } catch {}

              // Strip ANSI escape codes to ensure correct regex matching
              const cleanOutput = outputStr.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

              // Parse Vite / Dev Server port detection (e.g., "Local: http://localhost:5173/")
              const portMatch = cleanOutput.match(/(?:https?:\/\/localhost:|http:\/\/127\.0\.0\.1:|Local:\s+http:\/\/localhost:)(\d+)/i);
              if (portMatch) {
                const detectedPort = parseInt(portMatch[1], 10);
                console.log(`[Port Detected] Project ${projectId} is ready on port ${detectedPort}`);
                try {
                  ws.send(JSON.stringify({
                    type: 'server-ready',
                    port: detectedPort
                  }));
                } catch {}
              }
            });
          }

          if (child.stderr) {
            child.stderr.on('data', (data) => {
              try {
                ws.send(JSON.stringify({
                  type: 'process-output',
                  pid: procId,
                  stream: 'stderr',
                  data: data.toString()
                }));
              } catch {}
            });
          }

          // Handle process completion
          child.on('close', (code) => {
            console.log(`[Process Exit] Project ${projectId}, pid ${procId} exited with code: ${code}`);
            projectProcesses.delete(procId);
            try {
              ws.send(JSON.stringify({
                type: 'process-exit',
                pid: procId,
                exitCode: code
              }));
            } catch {}
          });
          break;
        }

        case 'input': {
          const { pid: procId, data } = args;
          const child = projectProcesses.get(procId.toString());
          if (child && child.stdin && child.stdin.writable) {
            child.stdin.write(data);
          }
          break;
        }

        case 'kill': {
          const { pid: procId } = args;
          const child = projectProcesses.get(procId.toString());
          if (child) {
            child.kill();
            sendResponse({ killed: true });
          } else {
            sendResponse({ killed: false }, 'Process not found');
          }
          break;
        }

        default:
          sendResponse(null, `Unsupported request type: ${type}`);
      }
    } catch (err) {
      console.error(`[Command Error] Project ${projectId}, Type ${type}:`, err.message);
      sendResponse(null, err.message);
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    console.log(`[WS Disconnected] Project: ${projectId}`);
    
    const sockets = projectSockets.get(projectId);
    if (sockets) {
      sockets.delete(ws);
      
      if (sockets.size === 0) {
        projectSockets.delete(projectId);
        
        // Schedule cleanup in 10 seconds to allow for page reloads / tab switching
        const timer = setTimeout(() => {
          console.log(`[Clean Up] Executing cleanup for project ${projectId}`);
          projectCleanupTimers.delete(projectId);

          // Terminate any running child processes for this project workspace
          const projectProcesses = activeProcesses.get(projectId);
          if (projectProcesses) {
            for (const [procId, child] of projectProcesses.entries()) {
              try {
                console.log(`[Clean Up] Killing pid ${procId} for project ${projectId}`);
                child.kill('SIGKILL');
              } catch {}
            }
            activeProcesses.delete(projectId);
          }

          // Clean up file watcher
          const watcher = fileWatchers.get(projectId);
          if (watcher) {
            watcher.close();
            fileWatchers.delete(projectId);
          }

          // Clean up active proxies associated with this project
          for (const key of activeProxies.keys()) {
            if (key.startsWith(`${projectId}-`)) {
              activeProxies.delete(key);
            }
          }
        }, 10000); // 10 seconds delay

        projectCleanupTimers.set(projectId, timer);
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Sinc Backend Project Runner listening on port ${port}`);
});
