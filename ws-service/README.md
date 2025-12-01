## ws-service

`ws-service` is the **WebSocket and filesystem/terminal backend** for a single workspace. It:

- Exposes a Socket.IO server over an HTTP server.
- Serves:
  - File tree and file content from a `/workspace` directory.
  - Save operations (both to local disk and to S3).
  - A PTY-backed terminal session using `node-pty`.

### High-Level Responsibilities

- Accept WebSocket connections from the frontend (one per repl/browser tab).
- Infer `replId` from the incoming `Host` header (subdomain).
- On connection:
  - List the root `/workspace` directory and send it to the client (`"loaded"` event).
- Provide handlers for:
  - Fetching directory contents.
  - Fetching file contents.
  - Updating file contents and syncing them to S3.
  - Requesting and streaming a terminal session.

### Entry Point (`src/index.ts`)

- Sets up an Express app + HTTP server:
  - Applies `dotenv.config()` to load `.env`.
  - Uses `express.json()` and `cors()` for JSON APIs and cross-origin usage.
  - `PORT` defaults to `3001` unless overridden by `process.env.PORT`.
- Calls `initWs(httpServer)` to attach all WebSocket logic.
- Starts the HTTP server and logs the port.

### WebSocket Layer (`src/ws.ts`)

#### `initWs(httpServer)`

- Creates a new `Server` instance from `socket.io`, allowing CORS from any origin (`origin: "*"`, `methods: ["GET", "POST"]`).
- Attaches a connection handler:
  - Reads `host` from `socket.handshake.headers.host`.
  - Extracts `replId` as the first part of the hostname (e.g., `abc123.peetcode.com` → `abc123`).
  - If `replId` is missing:
    - Disconnects the socket.
    - Calls `terminalManager.clear(socket.id)` defensively.
  - On a valid connection:
    - Emits `"loaded"` with:
      - `rootContent: await fetchDir("/workspace", "")` – initial directory listing to populate the frontend file tree.
    - Calls `initHandlers(socket, replId)` to bind all runtime events.

#### `initHandlers(socket, replId)`

Defines all per-connection event handlers:

- `"disconnect"`
  - Logs `"user disconnected"`.
  - (A natural place to later clean up PTY sessions, timers, etc.)

- `"fetchDir"` (`dir: string, callback`)
  - Builds `dirPath = /workspace/{dir}`.
  - Calls `fetchDir(dirPath, dir)` (from `fs.ts`) to list contents.
  - Returns an array of `{ type: "file" | "dir", name, path }` via the callback.

- `"fetchContent"` (`{ path: filePath }, callback`)
  - Builds `fullPath = /workspace/{filePath}`.
  - Reads the file with `fetchFileContent(fullPath)`.
  - Returns its contents as a UTF-8 string.

- `"updateContent"` (`{ path: filePath, content }`)
  - Writes the updated content locally:
    - `fullPath = /workspace/{filePath}`.
    - `saveFile(fullPath, content)` from `fs.ts`.
  - Persists the change to S3:
    - Calls `saveToS3("code/{replId}", filePath, content)` so the canonical copy in S3 matches the on-disk file.
  - Notes (from comments in code):
    - The payload is the full file contents, not a diff.
    - Should be size-limited and throttled in production.

- `"requestTerminal"`
  - Uses `terminalManager.createPty(socket.id, replId, handler)` to start a PTY session:
    - `handler(data, id)`:
      - Wraps `data` as a `Buffer` (`Buffer.from(data, "utf-8")`) and emits a `"terminal"` event back to the client.
  - The client’s `xterm` instance consumes this `"terminal"` event.

- `"terminalData"` (`{ data }`)
  - Forwards keystrokes from the client to the PTY:
    - Calls `terminalManager.write(socket.id, data)`.

### Filesystem Helpers (`src/fs.ts`)

Wraps Node’s `fs` APIs with Promise-based helpers:

- **`fetchDir(dir, baseDir)`**
  - Calls `fs.readdir(dir, { withFileTypes: true })`.
  - Returns an array of objects:
    - `{ type: "dir" | "file", name, path: baseDir + "/" + file.name }`.
  - `baseDir` is used so that paths returned to the frontend are relative to `/workspace` and can be safely concatenated back on the server.

- **`fetchFileContent(file)`**
  - Reads `file` with `fs.readFile(file, "utf8")`.
  - Resolves with the file contents as a string.

- **`saveFile(file, content)`**
  - Writes `content` to `file` using `fs.writeFile(file, content, "utf8")`.
  - Returns a Promise so call sites can `await` completion.

### S3 Helpers (`src/aws.ts`)

Similar to `init-service`, but also includes logic to sync entire folders to/from S3.

- **Client setup**
  - Uses `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_BUCKET`.

- **`fetchS3Folder(key, localPath)`**
  - Lists objects prefixed by `key`.
  - For each object:
    - Downloads it with `getObject`.
    - Writes it to `localPath` with the prefix removed from the key (mirroring S3’s folder structure onto the filesystem).
  - Uses `writeFile` which:
    - Ensures the target directory exists via `createFolder(path.dirname(filePath))`.
    - Then writes the file with `fs.writeFile`.

- **`copyS3Folder(sourcePrefix, destinationPrefix, continuationToken?)`**
  - Utility to mirror content from one S3 prefix to another (similar to `init-service`).
  - Lists objects by `sourcePrefix` and uses `copyObject` to copy them with a rewritten key.

- **`saveToS3(key, filePath, content)`**
  - Writes content under `Key = key + filePath` back to S3 via `putObject`.

### Terminal Manager / PTY (`src/pty.ts`)

Encapsulates `node-pty` usage and session management.

- **`TerminalManager`**
  - Maintains an in-memory map:
    - `sessions: { [id: string]: { terminal: IPty; replId: string } }`.
  - `createPty(id, replId, onData)`:
    - Spawns a new terminal using `fork(SHELL, [], { cols: 100, name: "xterm", cwd: "/workspace" })`.
    - `SHELL` is `"bash"` by default; adjust as needed for the runtime environment.
    - Registers a `data` handler:
      - Calls `onData(data, term.pid)` for each output chunk.
    - Stores the session keyed by `id` (socket ID).
    - Registers an `exit` handler:
      - Deletes the session from the map.
    - Returns the `term` instance.
  - `write(terminalId, data)`:
    - Looks up the session by `terminalId` and calls `.write(data)` on the underlying PTY.
  - `clear(terminalId)`:
    - Kills the PTY process and removes the session from the map.

### Environment & Assumptions

- Files are served from and written to **`/workspace`** inside the container/VM.
- `replId` is derived purely from the incoming `Host` header, so DNS/ingress must route `{replId}.peetcode.com` to this service.
- S3 is the source of truth for workspace files:
  - `init-service` seeds `code/{replId}`.
  - This service optionally syncs from S3 to `/workspace` and ensures edits are written back to S3 under `code/{replId}`.


