# Backing Up pgSTAC Manually

- pgSTAC is backed up by the PGO Operator on a schedule.
- However, it might be useful to dump the pgSTAC database locally,
  for testing and development purposes.

## Dump

```bash
# Connect to cluster
CURRENT_USER=$(whoami)
docker run --rm -it --name aws-cli -v /home/$CURRENT_USER:/root \
    --workdir /root ghcr.io/spwoodcock/awscli-kubectl:latest
aws sso login --profile admin --use-device-code

# Install postgresql-client-16 (to match current pg version of pgstac)
apt install lsb-release wget gnupg
echo \
  "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | apt-key add -
apt update
apt install postgresql-client-16

# Port forward the db service
kubectl port-forward service/eoapi-pgbouncer 5432:5432

# Get the connection string
kubectl get secrets eoapi-pguser-eoapi -o go-template='{{.data.uri | base64decode}}'
# Replace eoapi-primary.eoapi.svc with localhost, as we are port-forwarding
PGURL=<output_from_plus_with_localhost>

# Dump the db in custom format
pg_dump -Fc "$PGURL" > pgstac-backup.dump.gz
```

## Restore

See [global-mosaic compose file](../backend/global-mosaic/compose.yaml) for a
`pg_restore` example.
