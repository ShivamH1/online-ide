## Replit-Like Workspace (Monorepo)

This repository contains a minimal Replit-style workspace environment, composed of a React frontend and several Node.js/TypeScript backend services.

### Apps & Services

- **frontend**: React + Vite UI for the code editor, file tree, terminal, and output panel.
- **init-service**: Initializes workspaces and performs AWS-related setup.
- **ws-service**: WebSocket / terminal service that exposes PTY and file system operations to the frontend.
- **orchestrator-simple**: Simple orchestrator that talks to Kubernetes (via `@kubernetes/client-node`) to provision workspace pods.
- **k8s**: Kubernetes manifests (e.g. ingress configuration).

### Prerequisites

- **Node.js**: Recommended LTS (Node 20). Newer versions (e.g. Node 22) may require updated native build tools.
- **npm** or **yarn** for dependency management.
- **Docker** and a **Kubernetes** cluster (optional, for full orchestration flow).
- On Windows, the `ws-service` depends on `node-pty`, which requires:
  - Visual Studio Build Tools with **"Desktop development with C++"** workload, or
  - Compatible C++ toolchain per `node-gyp` docs.

### Install Dependencies

From the repo root:

```bash
cd frontend
npm install

cd ../init-service
npm install

cd ../ws-service
npm install

cd ../orchestrator-simple
npm install
```

### Development

#### Frontend

```bash
cd frontend
npm run dev
```

This starts the Vite dev server. The UI provides:

- **Editor**: Code editing experience.
- **Terminal**: Connected to `ws-service` via websockets.
- **Output**: Application output / logs pane.

#### init-service

```bash
cd init-service
npm run dev
```

Runs the initialization API in watch mode (TypeScript via `ts-node` + `nodemon`). Configure AWS credentials / environment variables in `.env` (see below).

#### ws-service

```bash
cd ws-service
npm run dev
```

Starts the WebSocket / terminal backend in watch mode. This service:

- Manages PTY sessions (`node-pty`).
- Exposes filesystem helpers (`fs.ts`).
- Integrates with AWS when needed (`aws.ts`).

#### orchestrator-simple

```bash
cd orchestrator-simple
npm run dev
```

Starts a simple orchestrator that:

- Uses `@kubernetes/client-node` to talk to your cluster.
- Applies YAML manifests (e.g. workspace pods) using settings in the `k8s` folder.

### Builds & Production

Most backend services share a similar build pipeline:

```bash
# Example: ws-service
cd ws-service
npm run build   # tsc -b
npm start       # node dist/index.js
```

Frontend:

```bash
cd frontend
npm run build
npm run preview   # optional, preview the production build
```

### Environment Variables

Each service expects its own `.env` file (see the corresponding `src/aws.ts` / `src/index.ts` for exact keys). Typical variables include:

- **AWS**:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`
- **Service Ports / URLs**:
  - `PORT` for each backend service.
  - URLs used by the frontend to reach `init-service`, `ws-service`, and `orchestrator-simple`.

Create `.env` files per service, e.g.:

```bash
cd init-service
cp .env.example .env   # if present, otherwise create manually
```

### Kubernetes / k8s

The `k8s` directory contains configuration files such as ingress definitions. Apply them with `kubectl` once your cluster is configured:

```bash
kubectl apply -f k8s/
```

You may need to adjust:

- Hostnames / domains in ingress.
- Namespace, image names, and resource limits.

### Notes for Windows Users

The `ws-service` uses `node-pty`, which compiles native code:

- Ensure you have **Visual Studio Build Tools** with C++ workload installed.
- Alternatively, follow the `node-gyp` Windows instructions (`https://github.com/nodejs/node-gyp#on-windows`).

If you do not need terminal/PTY features, you can remove `node-pty` from `ws-service/package.json` and adjust the PTY-related code accordingly.

### Scripts Overview

- **frontend**
  - `npm run dev`: Start Vite dev server.
  - `npm run build`: Type-check + build.
  - `npm run lint`: ESLint.
  - `npm run preview`: Preview production build.
- **init-service**, **ws-service**, **orchestrator-simple**
  - `npm run dev`: Start service in watch mode (`nodemon` + `ts-node`).
  - `npm run build`: Compile TypeScript to `dist/`.
  - `npm start`: Run compiled service.

### License

This project is licensed under the ISC License (per individual `package.json` files), unless otherwise noted.


