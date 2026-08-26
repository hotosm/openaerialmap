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
  `additionalEgress` for an external in-cluster object store - the bundled one
  is allowed automatically. Only enforced by some CNIs
  (Calico, Cilium; on EKS the VPC CNI addon needs `enableNetworkPolicy: "true"`)
  - elsewhere it applies and looks healthy while doing nothing, so test it.
- **Optional bundled Argo Workflows** (`argo.enabled`) - see above.
- **Optional catalogue seed Job** (`seed.enabled`, off) - a post-install hook
  that mirrors another deployment's public catalogue into this one. See below.
- **Optional in-cluster object store** (`s3.rustfs.enabled`, off) - the RustFS
  subchart, its own S3-API Ingress, and a `bucket-init` post-install hook that
  creates the bucket with a public-read policy and CORS. See below.
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

## Seeding a fresh catalogue

`seed.enabled=true` adds a post-install/PostSync Job that creates
`env.STAC_COLLECTION` and can copy items from another public STAC API:

```bash
helm upgrade --install uploader-api ./chart -n oam \
  --set seed.enabled=true --set seed.maxItems=500 --set seed.maxGiB=50 \
  --timeout 60m
```

`seed.maxItems=0` creates only the collection. Larger values copy assets before
inserting items; missing required assets skip an item and copy failures fail the
Job. Source reads are anonymous and destination writes use `s3Secret`. Existing
catalogues are skipped unless `seed.reseed=true`. Match the Helm/ArgoCD timeout
to `seed.activeDeadlineSeconds`.

`seed.maxGiB` is a ceiling on copied bytes, not a target: the run stops before
the first item that would cross it. It defaults to 10 to fit the bundled store's
default volume; seeding into real S3 has no such constraint, so the example
above raises it.

Copied objects need an expiry rule on a shared AWS bucket, or a disposable
environment's imagery outlives it - see "Production bucket setup" in the
uploader-api README. On a bundled store they go with the environment.

## In-cluster object storage

`s3.rustfs.enabled=true` bundles [RustFS](https://rustfs.com) as the object
store, so the chart installs with no AWS account and a torn-down environment
takes its imagery with it. The default is external S3, as production uses.

```bash
helm upgrade --install uploader-api ./chart -n oam \
  --set s3.rustfs.enabled=true \
  --set s3.rustfs.ingress.enabled=true \
  --set s3.rustfs.ingress.host=s3.stage.imagery.hotosm.org \
  --set s3.rustfs.ingress.tls.enabled=true \
  --set rustfs.storageclass.name=gp3-ephemeral
```

`env.S3_ENDPOINT` is then derived from the store's Service, and
`env.S3_EXTERNAL_ENDPOINT`/`env.PUBLIC_ASSET_BASE_URL` from the ingress, so the
app, the pipeline steps (which take `awsurl`/`externalaws` from the app) and the
seed job cannot disagree. Anything set explicitly in `env` still wins - that is
how you keep the store but serve assets via a CDN.

A `bucket-init` Job runs on every sync, before the seed job, creating the bucket
with a public-read policy and CORS. RustFS starts with no buckets, so without it
the first upload 404s.

Four things are easy to get wrong:

- **It needs a public hostname.** The browser presigns and PUTs straight to the
  store, and STAC asset hrefs are absolute; without `s3.rustfs.ingress.enabled`
  there is no address for either and the chart refuses to render. Leave
  `rustfs.ingress.enabled=false` - the subchart's own ingress backs onto the
  console port and speaks no S3.
- **CORS lives on the bucket, not the proxy.** RustFS answers preflights from
  the configuration `bucket-init` applies; adding
  `nginx.ingress.kubernetes.io/enable-cors` on top duplicates the headers and
  browsers reject the response. Needs RustFS >= the April 2026 release, which is
  where `PutBucketCors` stopped returning 501.
- **Credentials come from `s3Secret`, unchanged.** `rustfs.extraEnv` maps the
  same keypair onto the store's own env names, so an existing or sealed secret
  works untouched. Those names are repeated from `s3Secret` because Helm values
  cannot reference each other; the chart refuses to render if they disagree.
- **Storage is sized by hand.** The defaults pair `seed.maxGiB: 10` with a 20Gi
  volume - raise them together, budgeting about twice what testers upload, since
  each upload keeps its original and its COG and tilepack-api writes into the
  same bucket. `rustfs.storageclass.name` must name a StorageClass the cluster
  has.

`oam-s3-creds` must already exist with `S3_ACCESS_KEY` and `S3_SECRET_KEY` - the
same two keys an external-S3 install needs. Add `--set s3Secret.create=true
--set s3Secret.accessKeyId=... --set s3Secret.secretAccessKey=...` to have the
chart render it instead.

### What happens to the imagery on teardown

Standalone mode is not optional. Distributed puts the data on a StatefulSet
`volumeClaimTemplate`, whose PVCs are not in the rendered manifest set, so no
GitOps prune can see them and a deleted environment leaves its imagery - and its
bill - behind. Standalone keeps a plain PVC that is pruned with everything else.

That PVC carries `helm.sh/resource-policy: keep`, which cuts two ways:

- **ArgoCD ignores it** ([argo-cd#17819][]) and prunes the PVC. That is what
  makes a closed PR a clean teardown, and why an ephemeral StorageClass
  (`reclaimPolicy: Delete`) is the right choice.
- **`helm uninstall` honours it.** Delete the claim by hand:

```bash
kubectl -n oam delete pvc -l app.kubernetes.io/name=rustfs
```

[argo-cd#17819]: https://github.com/argoproj/argo-cd/issues/17819

## Bundled database storage

Only relevant with `db.enabled=true`; production uses an external database.

The chart creates a retained PVC named `<release>-db-data`. Configure it with:

- **`db.primary.persistence.enabled`** defaults to `true`. Set it to `false` only
  where the namespace is disposable (`values.local.yaml`, PR previews).
- **`db.primary.persistence.existingClaim`** adopts an existing claim.
- **`db.primary.persistence.size` / `.storageClassName`** apply when the chart
  creates the claim.

Check the existing claim before upgrading:

- **0.1.x (Deployment), claim `<release>-db-data`:** Nothing. 0.3.0 and later
  use the same name.
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
