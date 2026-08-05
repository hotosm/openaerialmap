#!/bin/bash
# Apply the baseline to an empty database, then run unrecorded migrations.
# Keep this outside the app process so replicas cannot each run migrations.

set -eo pipefail

pretty_echo() {
    local msg="$1"
    local sep
    sep=$(printf '%*s' $((${#msg} + 4)) '' | tr ' ' '-')
    printf '\n%s\n%s\n%s\n\n' "$sep" "$msg" "$sep"
}

check_db_vars() {
    for var in DB_HOST DB_USER DB_PASSWORD DB_NAME; do
        if [ -z "${!var}" ]; then
            echo "Environment variable $var is not set." >&2
            exit 1
        fi
    done
}

wait_for_db() {
    local retries=30
    local port="${DB_PORT:-5432}"
    for ((i = 0; i < retries; i++)); do
        if pg_isready -h "$DB_HOST" -p "$port" -U "$DB_USER" \
            -d "$DB_NAME" >/dev/null 2>&1
        then
            echo "✓ Database is available."
            return 0
        fi
        echo "Waiting for database… (${i}/${retries})"
        sleep 5
    done
    echo "Timed out waiting for the database." >&2
    exit 1
}

create_schema_if_missing() {
    # to_regclass returns NULL if the table is absent (respects search_path).
    local exists query
    query="SELECT (to_regclass('uploads') IS NOT NULL);"
    exists=$(psql -t "$db_url" -c "$query" | tr -d '[:space:]')
    if [ "$exists" = "t" ]; then
        echo "Schema already present. Skipping baseline."
        return 0
    fi
    pretty_echo "Applying baseline schema."
    # cd into the dir so a modular baseline can use relative \i imports.
    cd "${MIGRATIONS_DIR:-/opt/migrations}/init"
    psql "$db_url" --set ON_ERROR_STOP=1 -f ./0-main.sql
    cd - >/dev/null
}

create_migrations_table() {
    psql "$db_url" --set ON_ERROR_STOP=1 <<'SQL'
    CREATE TABLE IF NOT EXISTS "_migrations" (
        script_name text,
        date_executed timestamp without time zone,
        CONSTRAINT "_migrations_pkey" PRIMARY KEY (script_name)
    );
    ALTER TABLE IF EXISTS "_migrations" OWNER TO current_user;
SQL
}

run_pending_migrations() {
    local migration_dir="${MIGRATIONS_DIR:-/opt/migrations}"
    local existing
    existing=$(psql -t "$db_url" -c 'SELECT script_name FROM "_migrations";')
    local pgopts="-c lock_timeout=10s -c statement_timeout=300s"
    local ran=0

    while IFS= read -r script_file; do
        [ -z "$script_file" ] && continue
        local name
        name=$(basename "$script_file")
        if echo "$existing" | grep -q "$name"; then
            continue
        fi
        pretty_echo "Executing migration: $name"
        # Apply with env vars substituted; record it only if it succeeded.
        envsubst < "$script_file" | PGOPTIONS="$pgopts" psql "$db_url" \
            --set ON_ERROR_STOP=1 --echo-all \
        && psql "$db_url" --set ON_ERROR_STOP=1 <<SQL
    INSERT INTO "_migrations" (date_executed, script_name)
    VALUES (NOW(), '$name') ON CONFLICT (script_name) DO NOTHING;
SQL
        ran=1
    done < <(
        find "$migration_dir" -maxdepth 1 -type f -name '*.sql' |
            sort
    )

    [ "$ran" -eq 0 ] && echo "No new migrations found."
}

pretty_echo "### Migrations Start ###"
check_db_vars
wait_for_db
# PGPASSWORD avoids URL escaping for reserved characters and quotes.
export PGPASSWORD="$DB_PASSWORD"
db_url="host=${DB_HOST} port=${DB_PORT:-5432}"
db_url="${db_url} user=${DB_USER} dbname=${DB_NAME}"
create_schema_if_missing
create_migrations_table
run_pending_migrations
pretty_echo "### Migrations End ###"
exit 0
