## orchestrator-simple

`orchestrator-simple` is a **minimal Kubernetes orchestrator** that creates per-repl resources (Deployment, Service, Ingress, etc.) from a template `service.yaml` when requested.

### What It Does

- Exposes an HTTP endpoint:
  - `POST /start` with body `{ userId, replId }`.
- On each call:
  - Loads a Kubernetes manifest file `service.yaml` from the local filesystem.
  - Performs a simple string replacement of the placeholder `service_name` with the actual `replId`.
  - Parses the resulting YAML into one or more Kubernetes objects.
  - For each object:
    - If `kind: Deployment` → `appsV1Api.createNamespacedDeployment`.
    - If `kind: Service` → `coreV1Api.createNamespacedService`.
    - If `kind: Ingress` → `networkingV1Api.createNamespacedIngress`.
  - Responds with a success or failure message.

### Entry Point (`src/index.ts`)

- Express setup:
  - Uses `express.json()` for JSON payloads.
  - Enables CORS via `cors()` so the frontend can call it from the browser.
- Kubernetes client setup:
  - Uses `KubeConfig` from `@kubernetes/client-node`.
  - `kubeconfig.loadFromDefault()`:
    - Typically reads from `~/.kube/config` in local dev or the in-cluster config when running inside Kubernetes.
  - Constructs:
    - `coreV1Api` (`CoreV1Api`) for services and basic resources.
    - `appsV1Api` (`AppsV1Api`) for deployments.
    - `networkingV1Api` (`NetworkingV1Api`) for ingresses.

### YAML Parsing (`readAndParseKubeYaml`)

```ts
const readAndParseKubeYaml = (filePath: string, replId: string): Array<any> => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const docs = yaml.parseAllDocuments(fileContent).map((doc) => {
        let docString = doc.toString();
        const regex = new RegExp(`service_name`, 'g');
        docString = docString.replace(regex, replId);
        console.log(docString);
        return yaml.parse(docString);
    });
    return docs;
};
```

- Reads `service.yaml` as a string.
- Uses `yaml.parseAllDocuments` to support **multi-document YAML** (separated by `---`).
- For each document:
  - Converts it back to a string.
  - Replaces all occurrences of the placeholder `service_name` with the actual `replId`.
  - Parses the updated string to a JS object that can be passed to the Kubernetes client APIs.

### `/start` Endpoint

- Handler logic:
  - Destructures `{ userId, replId }` from `req.body`.
  - Sets `namespace = "default"` (can be made configurable).
  - Calls `readAndParseKubeYaml(path.join(__dirname, "../service.yaml"), replId)` to get an array of manifests.
  - Iterates through each `manifest`:
    - Switches on `manifest.kind`:
      - `"Deployment"` → `appsV1Api.createNamespacedDeployment(namespace, manifest)`.
      - `"Service"` → `coreV1Api.createNamespacedService(namespace, manifest)`.
      - `"Ingress"` → `networkingV1Api.createNamespacedIngress(namespace, manifest)`.
      - Any other kind is logged as unsupported.
  - On success:
    - Returns HTTP 200 with `{ message: "Resources created successfully" }`.
  - On error:
    - Logs `"Failed to create resources"`.
    - Returns HTTP 500 with `{ message: "Failed to create resources" }`.

### Port and Deployment

- The server listens on:
  - `PORT = process.env.PORT || 3002`.
- Intended usage:
  - The frontend calls `http://localhost:3002/start` with `{ replId }` from `CodingPage.tsx`.
  - Once the Kubernetes resources are created, DNS/Ingress should route:
    - `{replId}.peetcode.com` to `ws-service` (terminal + editing).
    - `{replId}.autogpt-cloud.com` (or similar) to the running user code (as used by the frontend `Output` iframe).

### Environment & Assumptions

- Expects:
  - A working Kubernetes cluster reachable via the default kubeconfig.
  - A valid `service.yaml` in the project root (`../service.yaml` from `dist/src/index.js`).
  - An Ingress controller (e.g., NGINX) installed in the cluster (see the `k8s` directory).
- Security/prod notes:
  - Multi-tenant auth/authorization is not implemented here—`userId` is currently unused.
  - In a real system you would:
    - Validate the caller.
    - Enforce quotas/namespaces per user.
    - Implement cleanup (delete Deployments/Services/Ingresses on stop).


