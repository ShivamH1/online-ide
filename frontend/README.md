## Frontend (React + Vite)

This app is the web UI that provides a Replit-style coding experience: editor, file tree, terminal, and an output iframe pointing at the running instance.

### High-Level Flow

- **Routing (`App.tsx`)**
  - Uses `react-router-dom` to expose:
    - `/` → `Landing` (simple landing page / entry point).
    - `/coding?replId=...` → `CodingPage` (main workspace).

- **Workspace Boot (`CodingPage.tsx`)**
  - Reads `replId` from the query string.
  - Calls `POST http://localhost:3002/start` with `{ replId }` to the `orchestrator-simple` service to spin up Kubernetes resources for that repl.
  - Shows `"Booting..."` until the pod is created, then renders `CodingPagePostPodCreation`.

- **Live Session Setup (`CodingPagePostPodCreation`)**
  - Re-reads `replId` from the URL.
  - Creates a Socket.IO connection to `ws://{replId}.peetcode.com` via `useSocket`.
  - Subscribes to the `"loaded"` event to receive the initial workspace file structure from `/workspace` on the `ws-service`.
  - Manages React state:
    - `fileStructure: RemoteFile[]` – flat list of files/dirs from the backend.
    - `selectedFile: File | undefined` – current file open in the editor.
    - `showOutput: boolean` – toggles the output iframe.
  - `onSelect(file)`:
    - If directory: emits `"fetchDir"` with `file.path`, updates `fileStructure` with a de-duplicated merge of previous and new entries.
    - If file: emits `"fetchContent"` and updates `selectedFile` with the returned content.

- **Layout**
  - Uses `@emotion/styled` to build:
    - `LeftPanel` → `Editor` (file tree + code editor).
    - `RightPanel` → `Output` (optional iframe) + `Terminal`.

### Editor & File Tree

- **`Editor.tsx`**
  - Accepts `files` (`RemoteFile[]`), `onSelect`, `selectedFile`, and `socket`.
  - Uses `buildFileTree` to convert the flat `RemoteFile[]` into a hierarchical `Directory` tree.
  - On mount, if no `selectedFile`, auto-selects the first file in `rootDir.files`.
  - Renders:
    - `Sidebar` + `FileTree` component to show the nested tree.
    - `Code` component to show the Monaco-based editor for `selectedFile` and send changes back over `socket` (see external editor code).

- **File/Directory Model (`external/editor/utils/file-manager.tsx`)**
  - Defines `Type` enum (`FILE`, `DIRECTORY`, `DUMMY`) and `File`, `Directory`, `RemoteFile` structures.
  - `buildFileTree(data: RemoteFile[])`:
    - Splits the flat list into `dirs` and `files`.
    - Builds a `Map` cache keyed by full path.
    - Identifies parent directories based on path segments and constructs a `rootDir` tree.
    - Computes `depth` for each file and directory via `getDepth` to aid indentation in the UI.
  - Also provides helpers:
    - `findFileByName(rootDir, filename)`.
    - `sortDir` and `sortFile` for alphabetical ordering.

### Terminal Integration

- **`Terminal.tsx` (`TerminalComponent`)**
  - Uses `xterm` and `xterm-addon-fit` for an in-browser terminal emulator.
  - On mount:
    - Emits `"requestTerminal"` over the Socket.IO connection to ask the backend for a PTY.
    - Registers a `"terminal"` listener (`terminalHandler`) to handle incoming data.
    - Sets up an `xterm.Terminal` instance with:
      - `cursorBlink`, `screenKeys`, `cols`, and a black background theme.
      - `fitAddon` to size the terminal to the container.
  - `terminalHandler({ data })`:
    - Converts incoming `ArrayBuffer` data to a string via `ab2str` and writes it to the terminal.
  - `term.onData(data)`:
    - Sends keystrokes back over the socket as `'terminalData'` events, which the backend writes into the PTY.
  - Emits an initial newline (`'\n'`) to prompt the shell.

### Output Panel

- **`Output.tsx`**
  - Reads `replId` from the query string.
  - Constructs `INSTANCE_URI = http://{replId}.autogpt-cloud.com`.
  - Renders an `iframe` pointing to the running application instance; this decouples the editing environment from runtime execution.

### Key Ideas / Logic

- **Repl isolation via subdomains**
  - Both the websocket (`{replId}.peetcode.com`) and output (`{replId}.autogpt-cloud.com`) are per-repl subdomains, letting the backend inspect the `Host` header and route to the right workspace.

- **Thin client, thick server**
  - The frontend never touches the real filesystem directly—everything goes through the `ws-service` over Socket.IO.
  - The client is mainly responsible for:
    - Rendering tree and code views.
    - Translating user interactions into websocket events.
    - Displaying terminal and runtime output.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
