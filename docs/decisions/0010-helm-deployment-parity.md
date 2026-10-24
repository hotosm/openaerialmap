# Helm chart as the single deployment definition

## Context and Problem Statement

The Docker Compose dev environment cannot run Argo, so the processing pipeline
only works in Kubernetes. The stack is also defined twice, in Compose and Helm,
and the two drift apart.

## Considered Options

- **Keep Compose for dev, Helm for prod.** No real processing locally, and two
  definitions to maintain.
- **DevSpace, Telepresence or Tilt.** Another tool and config file for every
  contributor, for little gain over host-run services.
- **Helm everywhere, driven by `just`.** Chosen.

## Decision Outcome

The Helm chart is the only deployment definition:

- **Local development:** Talos-in-Docker with Argo, managed by `just`
  recipes. The frontend and APIs run on the host with hot reload, using the
  cluster for the database, storage and pipeline.
- **Small-scale production:** the same chart on a single-node cluster, such as
  k3s on a Linux VM.
- **HOT production:** the same chart with production values.

The full-stack `compose.yaml` will be retired. `compose.test.yaml` remains the
CI test harness.

### Consequences

- Dev runs the real pipeline, and only one stack definition is maintained.
- Contributors need Docker and `just`, but should not need Kubernetes
  knowledge for everyday work.
- Talos-in-Docker is for dev and CI only, not production.
- The `just` recipes depend on maintainers with Kubernetes knowledge, so the
  local flow should run in CI on a schedule.
