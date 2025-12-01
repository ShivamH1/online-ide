## init-service

`init-service` is responsible for **bootstrapping a new project/workspace** by copying a language-specific template from S3 into a per-repl S3 folder.

### What It Does

- Exposes a single HTTP endpoint:
  - `POST /project` with body `{ replId, language }`.
- Validates required fields:
  - If either `replId` or `language` is missing, returns `400` with an error.
- Triggers a copy in S3:
  - Source: `base/{language}` (template project).
  - Destination: `code/{replId}` (user's workspace).
- Responds with `201` when the copy is initiated/succeeds.

### Entry Point (`src/index.ts`)

- Sets up an Express app:
  - Config:
    - `dotenv.config()` to load AWS/S3 settings from `.env`.
    - `express.json()` for JSON request bodies.
    - `cors()` to allow cross-origin calls from the frontend/orchestrator.
  - `PORT` defaults to `3000` unless overridden by `process.env.PORT`.

- `POST /project`:
  - Extracts `replId` and `language` from `req.body`.
  - Early validation: returns `400` if either field is missing.
  - Calls `copyS3Folder("base/{language}", "code/{replId}", "")` and waits for it to complete.
  - Sends `{ message: "Project created successfully" }` on success.

### S3 Utilities (`src/aws.ts`)

All AWS logic is centralized here using the AWS SDK `S3` client.

- **S3 Client Setup**
  - Uses environment variables:
    - `AWS_ACCESS_KEY_ID`
    - `AWS_SECRET_ACCESS_KEY`
    - `S3_ENDPOINT`
    - `S3_BUCKET`
  - Creates a single `S3` instance reused across calls.

- **`copyS3Folder(sourcePrefix, destinationPrefix, continuationToken)`**
  - Lists objects under the `sourcePrefix` in the configured bucket using `listObjectsV2`.
  - For each object:
    - Builds a `destinationKey` by replacing the `sourcePrefix` prefix with `destinationPrefix` in the object's key.
    - Runs `copyObject` from `source` to `destination`.
  - Handles pagination:
    - If `IsTruncated` is true, recursively calls itself with `NextContinuationToken` to continue copying the remaining objects.
  - Errors are caught and logged with `"Error copying S3 folder:"`.

- **`saveToS3(key, filePath, content)`**
  - A convenience function to store text content:
    - `Key` is computed as `key + filePath`.
  - Calls `putObject` to overwrite or create the object.
  - This function is not currently used by `init-service/index.ts` but mirrors the `ws-service` logic and can be reused if init should write initial files directly.

### Data Flow

1. Client (or another service) calls `POST /project` with `{ replId, language }`.
2. `init-service` validates and calls `copyS3Folder("base/{language}", "code/{replId}")`.
3. The S3 bucket ends up with a new folder under `code/{replId}` containing the project template for the requested language.
4. Later, other services (e.g. `ws-service`) can sync this S3 folder down into `/workspace` and/or keep it updated.

### Key Environment Variables

- `PORT` – HTTP port (default `3000`).
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` – AWS credentials.
- `S3_ENDPOINT` – Optional custom S3-compatible endpoint (e.g. MinIO).
- `S3_BUCKET` – Bucket name containing `base/*` templates and `code/*` workspaces.


