#!/bin/sh
set -eu

# Idempotent for fresh initdb and for the n8n-db-migrate Compose one-shot.
# Existing app-database n8n rows are copied, never dropped or overwritten.
: "${PGDATABASE:=${POSTGRES_DB:?}}"
: "${PGUSER:=${POSTGRES_USER:?}}"
: "${PGPASSWORD:=${POSTGRES_PASSWORD:-}}"
: "${N8N_DB_USER:?N8N_DB_USER is required}"
: "${N8N_DB_PASSWORD:?N8N_DB_PASSWORD is required}"
: "${N8N_DB_NAME:=flowpilot_n8n}"
export PGDATABASE PGUSER PGPASSWORD N8N_DB_USER N8N_DB_PASSWORD N8N_DB_NAME

if [ "$PGDATABASE" = "$N8N_DB_NAME" ]; then
  echo 'The n8n database name must differ from the FlowPilot application database.' >&2
  exit 1
fi

tries=0
until psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$PGDATABASE" --command 'SELECT 1' >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo 'PostgreSQL did not accept the n8n database migration connection.' >&2
    exit 1
  fi
  sleep 2
done

# Create the login role only when absent. Existing passwords are retained.
psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname postgres <<'SQL'
\getenv n8n_user N8N_DB_USER
\getenv n8n_password N8N_DB_PASSWORD
\getenv n8n_database N8N_DB_NAME

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'n8n_user', :'n8n_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'n8n_user')
\gexec
SELECT format('ALTER ROLE %I LOGIN', :'n8n_user')
\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'n8n_database', :'n8n_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'n8n_database')
\gexec
SELECT EXISTS (
  SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba
  WHERE d.datname = :'n8n_database' AND r.rolname = :'n8n_user'
) AS n8n_database_owned_by_role
\gset
\if :n8n_database_owned_by_role
\echo 'Dedicated n8n database ownership verified.'
\else
\echo 'Refusing migration: the existing dedicated n8n database has a different owner.'
\quit 1
\endif
SQL

source_tables=$(psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$PGDATABASE" --tuples-only --no-align --command "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='n8n' AND c.relkind IN ('r','p');")
target_tables=$(psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$N8N_DB_NAME" --tuples-only --no-align --command "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='n8n' AND c.relkind IN ('r','p');")
source_tables=$(printf '%s' "$source_tables" | tr -d '[:space:]')
target_tables=$(printf '%s' "$target_tables" | tr -d '[:space:]')

if [ "$target_tables" -eq 0 ] && [ "$source_tables" -gt 0 ]; then
  target_schema=$(psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$N8N_DB_NAME" --tuples-only --no-align --command "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='n8n');")
  if [ "$target_schema" = 't' ]; then
    echo 'Refusing migration: the dedicated n8n database has an existing schema but no tables; inspect it before retrying.' >&2
    exit 1
  fi
  dump_file=$(mktemp)
  trap 'rm -f "$dump_file"' EXIT HUP INT TERM
  pg_dump --no-owner --no-acl --format=custom --schema=n8n --file="$dump_file" --dbname "$PGDATABASE"
  pg_restore --exit-on-error --single-transaction --no-owner --no-acl --role="$N8N_DB_USER" --dbname "$N8N_DB_NAME" "$dump_file"
  target_tables=$(psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$N8N_DB_NAME" --tuples-only --no-align --command "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='n8n' AND c.relkind IN ('r','p');")
  target_tables=$(printf '%s' "$target_tables" | tr -d '[:space:]')
  if [ "$target_tables" -ne "$source_tables" ]; then
    echo 'n8n schema migration verification failed; source data was retained.' >&2
    exit 1
  fi
  echo 'Existing n8n schema data was copied and verified in the dedicated database.'
elif [ "$target_tables" -gt 0 ]; then
  echo 'Dedicated n8n database already contains tables; preserving it without overwrite.'
else
  psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$N8N_DB_NAME" <<'SQL'
\getenv n8n_user N8N_DB_USER
CREATE SCHEMA IF NOT EXISTS n8n AUTHORIZATION :"n8n_user";
SQL
fi

# Ensure the destination schema and its objects are owned by the n8n role.
psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$N8N_DB_NAME" <<'SQL'
\getenv n8n_user N8N_DB_USER
SELECT format('ALTER SCHEMA n8n OWNER TO %I', :'n8n_user')
WHERE EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='n8n')
\gexec
SELECT format('ALTER TABLE n8n.%I OWNER TO %I', c.relname, :'n8n_user')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='n8n' AND c.relkind IN ('r','p')
  AND c.relowner <> (SELECT oid FROM pg_roles WHERE rolname=:'n8n_user')
\gexec
SELECT format('ALTER SEQUENCE n8n.%I OWNER TO %I', c.relname, :'n8n_user')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='n8n' AND c.relkind='S'
  AND c.relowner <> (SELECT oid FROM pg_roles WHERE rolname=:'n8n_user')
\gexec
SQL

# Retain the old schema as an app-admin-owned archive, but remove n8n's direct
# access to FlowPilot's application database after the copy is verified.
psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$PGDATABASE" <<'SQL'
\getenv n8n_user N8N_DB_USER
\getenv app_user PGUSER
\getenv app_database PGDATABASE
SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='n8n') AS old_n8n_schema_exists
\gset
\if :old_n8n_schema_exists
SELECT format('ALTER TABLE n8n.%I OWNER TO %I', c.relname, :'app_user')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='n8n' AND c.relkind IN ('r','p')
  AND c.relowner <> (SELECT oid FROM pg_roles WHERE rolname=:'app_user')
\gexec
SELECT format('ALTER SEQUENCE n8n.%I OWNER TO %I', c.relname, :'app_user')
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='n8n' AND c.relkind='S'
  AND c.relowner <> (SELECT oid FROM pg_roles WHERE rolname=:'app_user')
\gexec
SELECT format('ALTER SCHEMA n8n OWNER TO %I', :'app_user')
\gexec
REVOKE ALL PRIVILEGES ON SCHEMA n8n FROM :"n8n_user";
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA n8n FROM :"n8n_user";
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA n8n FROM :"n8n_user";
\endif
SELECT format('REVOKE CONNECT ON DATABASE %I FROM %I', :'app_database', :'n8n_user')
\gexec
SELECT format('REVOKE CREATE ON DATABASE %I FROM %I', :'app_database', :'n8n_user')
\gexec
SQL

# Verify the new database owner and schema privileges without printing secrets.
psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname postgres <<'SQL'
\getenv n8n_user N8N_DB_USER
\getenv n8n_database N8N_DB_NAME
SELECT EXISTS (
  SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba
  WHERE d.datname=:'n8n_database' AND r.rolname=:'n8n_user'
) AND has_database_privilege(:'n8n_user', :'n8n_database', 'CONNECT') AS n8n_database_ready
\gset
\if :n8n_database_ready
\echo 'Dedicated n8n database is ready.'
\else
\echo 'Dedicated n8n database verification failed.'
\quit 1
\endif
SQL
