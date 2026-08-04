# uploader-api Helm chart

Deploys the OpenAerialMap uploader API + htmx UI, plus the namespace-scoped RBAC
it needs to submit Argo Workflows. Install it **into the `oam` namespace**.

An Argo Workflows **controller** must be able to see this namespace. Two
options:

- **Reuse an existing cluster-wide controller** (default, `argo.enabled=false`).
  At HOTOSM the ScaleODM chart deploys a controller in the `argo` namespace that
  watches all namespaces, so workflows created here are picked up automatically.
- **Bundle one** (`argo.enabled=true`): installs the `argo-workflows` subchart
  confined to this namespace (`singleNamespace`), for clusters without Argo.

## Layout

- **Deployment** with a `migrations` init-container (runs `migrate-entrypoint.sh`
  once before the app) and, when `db.enabled`, a `db-check` init-container.
- **Role + RoleBinding** (`rbac.create`) - `argoproj.io/workflows` in this
  namespace only. No ClusterRole.
- **Workflow ServiceAccount** (`workflowServiceAccount.create`) - the `argo-odm`
  SA the WorkflowTemplate assigns to step pods, plus minimum executor RBAC
  (workflowtaskresults etc.) in this namespace.
- **Optional in-cluster Postgres** (`db.enabled`) - `db-deployment`,
  `db-service`, `db-pvc`. Default is an external DB.
- **Optional bundled Argo Workflows** (`argo.enabled`) - see above.
- Service, Ingress (`upload.imagery.hotosm.org`), optional HPA.

## Config model (mirrors field-tm)

- Non-secret env → `.Values.env` map (+ `OAM_UPLOAD_DOMAIN` derived from
  `ingress.host`, `WF_CALLBACK_URL` derived from the service DNS).
- Secrets → `existingSecret` (mounted via `envFrom`): `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `COOKIE_SECRET`, `PGSTAC_DB_PASSWORD`, and (for an
  external DB) `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`.

The chart fails to render (by design) if the pgstac DB, the public asset base, or
the external-DB secret are missing - so a misconfigured deploy fails at
`helm install`, not at runtime.

## Install

```bash
# Production (external DB). pgstac + asset base are required:
helm upgrade --install uploader-api ./chart -n oam --create-namespace \
  --set existingSecret.name=oam-uploader-secrets \
  --set env.PGSTAC_DB_HOST=pgstac.internal --set env.PGSTAC_DB_USER=oam \
  --set env.PGSTAC_DB_NAME=postgis \
  --set env.PUBLIC_ASSET_BASE_URL=https://cdn.openaerialmap.org \
  --set ingress.enabled=true --set ingress.tls.enabled=true

# Local single-cluster (bundled ephemeral DB, auth disabled):
helm upgrade --install uploader-api ./chart -n oam --create-namespace \
  -f chart/values.local.yaml
```

The Argo `WorkflowTemplate` (`../pipeline/workflow-template.yaml`) is applied
separately into the `oam` namespace (kept as the single source of truth rather
than a drift-prone copy in this chart).

**Workflow contract** (what the WorkflowTemplate expects to exist in the
namespace):

- ServiceAccount `argo-odm` - created by this chart
  (`workflowServiceAccount.create=true`, the default). Set it to `false` when
  the Argo install already provisions it (e.g. the local k8s.just test module).
- Secret `oam-uploader-s3` with `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` /
  `AWS_DEFAULT_REGION`. Set `workflowS3Secret.create=true` to have this chart
  provision it, or create it out of band.
- If the shared controller archives workflow logs to S3 (HOTOSM's does), the
  artifact-repository credentials secret it names (`argo-logs-s3-creds`) is
  resolved in the **workflow's** namespace, so a copy must exist here too.

Pods run with hardened, non-root security contexts by default (see the
`*SecurityContext` values). For reproducible deploys, pin the pipeline images by
digest in the WorkflowTemplate and pass the git SHA as `OAM_PIPELINE_VERSION`
(the pipeline build workflow does this for the convert image).
