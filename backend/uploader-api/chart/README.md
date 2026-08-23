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
- **Optional in-cluster Postgres** (`db.enabled`) - `db-statefulset` +
  `db-service` + `db-pvc` + `db-secret`, for staging / PR previews / local dev.
  Persistent by default; set `db.primary.persistence.enabled=false` for a
  throwaway environment. Set `db.auth.existingSecret` to provide the password.
- **Optional workflow egress NetworkPolicy** (`workflowNetworkPolicy.enabled`,
  off) - blocks workflow access to private ranges. Needs `apiServerCIDRs`, and
  `additionalEgress` for an in-cluster object store. Only enforced by some CNIs
  (Calico, Cilium; on EKS the VPC CNI addon needs `enableNetworkPolicy: "true"`)
  - elsewhere it applies and looks healthy while doing nothing, so test it.
- **Optional bundled Argo Workflows** (`argo.enabled`) - see above.
- Service, Ingress (`upload.imagery.hotosm.org`), optional HPA.

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
- Secret `oam-s3-creds` with `S3_ACCESS_KEY` / `S3_SECRET_KEY`. Set
  `s3Secret.create=true` to provision it, or create it out of band. The workflow
  template must use the same name and keys.
- If the shared controller archives workflow logs to S3 (HOTOSM's does), the
  artifact-repository credentials secret it names (`argo-logs-s3-creds`) is
  resolved in the **workflow's** namespace, so a copy must exist here too.

## Bundled database storage

Only relevant with `db.enabled=true`; production uses an external database.

The chart creates a retained PVC named `<release>-db-data`. Configure it with:

- **`db.primary.persistence.enabled`** defaults to `true`. Set it to `false` only
  where the namespace is disposable (`values.local.yaml`, PR previews).
- **`db.primary.persistence.existingClaim`** adopts an existing claim.
- **`db.primary.persistence.size` / `.storageClassName`** apply when the chart
  creates the claim.

Check the existing claim before upgrading:

- **0.1.x (Deployment), claim `<release>-db-data`:** Nothing. 0.3.0 uses the
  same name.
- **0.2.0 (StatefulSet), claim `data-<release>-db-0`:** Set
  `db.primary.persistence.existingClaim=data-<release>-db-0` before upgrading.

```bash
kubectl -n oam get pvc -l app.kubernetes.io/component=db
```

Changing claim size or storage class requires a manual dump and restore. The old
claim remains retained until it is deleted explicitly.

Pods run with hardened, non-root security contexts by default (see the
`*SecurityContext` values). For reproducible deploys, pin the pipeline images by
digest in the WorkflowTemplate and pass the git SHA as `OAM_PIPELINE_VERSION`
(the pipeline build workflow does this for the convert image).
