## k8s

The `k8s` directory contains Kubernetes manifests and configuration needed to run the workspace stack in a cluster.

### Ingress-NGINX Controller (`ingress.contoller.yaml`)

- This file is a full set of manifests for deploying the **NGINX Ingress Controller** via Helm-generated YAML.
- It includes:
  - `ServiceAccount`, `Role`, `ClusterRole`, and corresponding bindings to grant the controller the necessary permissions.
  - `ConfigMap` for controller configuration (log format, annotations, etc.).
  - `Deployment` for the `ingress-nginx-controller` pod that:
    - Listens on HTTP/HTTPS.
    - Exposes webhooks for admission control.
  - `Service` of type `LoadBalancer` to expose the controller externally.
  - Admission webhook configuration and jobs that:
    - Generate TLS certificates for the webhook.
    - Patch the validating webhook configuration.

### How It Fits with the Rest of the Repo

- `orchestrator-simple` is responsible for creating **per-repl** `Deployment`, `Service`, and `Ingress` resources.
- The `Ingress` objects it creates:
  - Use the `nginx` `IngressClass`, which is backed by this Ingress-NGINX controller.
  - Allow routing of external hostnames like:
    - `{replId}.peetcode.com` → `ws-service` (websocket + terminal + editor backend).
    - `{replId}.autogpt-cloud.com` → user runtime pods.
- This `ingress.contoller.yaml` is a cluster-level install of the Ingress controller:
  - It should be applied once per cluster, not per-repl.

### Usage

From a machine with `kubectl` configured for your cluster:

```bash
kubectl apply -f ingress.contoller.yaml
```

After the controller is installed:

- Ensure:
  - `orchestrator-simple` can talk to the cluster.
  - DNS (or `/etc/hosts` in dev) maps `*.peetcode.com` and `*.autogpt-cloud.com` to the Ingress controller’s external IP.
- Once in place, the per-repl `Ingress` created by `orchestrator-simple` will function correctly.


