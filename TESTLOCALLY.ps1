$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Automated tests failed.' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }

$envFile = if (Test-Path '.env') { '.env' } else { '.env.example' }
docker compose --env-file $envFile config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration validation failed.' }
function Get-FlowPilotContainerHealth([string]$service) {
  $containerId = docker compose ps --all --quiet $service 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $containerId) { return 'missing' }
  $state = docker inspect --format '{{.State.Status}}' $containerId 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $state) { return 'unknown' }
  if ($state.Trim() -ne 'running') { return $state.Trim() }
  $health = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' $containerId 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $health) { return 'unknown' }
  return $health.Trim()
}
foreach ($service in @('postgres','api','web','n8n','ollama')) {
  $containerHealth = Get-FlowPilotContainerHealth $service
  if ($containerHealth -ne 'healthy') { throw "FlowPilot container '$service' is not healthy (state: $containerHealth)." }
}

$settings = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $settings[$Matches[1]] = $Matches[2].Trim('"', "'") }
}
try { $h = Invoke-RestMethod 'http://localhost:3001/health' -TimeoutSec 8 } catch { throw 'Start FlowPilot with RUNLOCALLY.bat before the live checks.' }
if ($h.api -ne 'connected' -or $h.database -ne 'connected' -or $h.n8n -ne 'connected') { throw "Live API/database/n8n health failed: API=$($h.api), PostgreSQL=$($h.database), n8n=$($h.n8n)." }

$dbUser = if ($settings.POSTGRES_USER) { $settings.POSTGRES_USER } else { 'flowpilot' }
$n8nUser = if ($settings.N8N_DB_USER) { $settings.N8N_DB_USER } else { 'flowpilot_n8n' }
$n8nDatabase = 'flowpilot_n8n'
# psql does not expand variables in --command. Quote the role as a SQL string
# literal here and escape embedded apostrophes before passing it to psql.
$n8nUserSql = "'" + $n8nUser.Replace("'", "''") + "'"
$permissionSql = "SELECT has_database_privilege($n8nUserSql, current_database(), 'CONNECT') AND has_schema_privilege($n8nUserSql, 'n8n', 'USAGE') AND has_schema_privilege($n8nUserSql, 'n8n', 'CREATE') AND EXISTS (SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=current_database() AND r.rolname=$n8nUserSql);"
$privileges = docker compose exec -T postgres psql --no-psqlrc --username $dbUser --dbname $n8nDatabase --tuples-only --no-align --command $permissionSql
if ($LASTEXITCODE -ne 0 -or (($privileges -join '').Trim() -ne 't')) { throw 'n8n PostgreSQL role/database/schema permission check failed.' }
$managedWorkflows = @(
  (Get-Content 'n8n/workflows/qualify-lead.json' -Raw | ConvertFrom-Json),
  (Get-Content 'n8n/workflows/error-handler.json' -Raw | ConvertFrom-Json)
)
$workflowPredicates = @($managedWorkflows | ForEach-Object {
  $id = $_.id.Replace("'", "''")
  $name = $_.name.Replace("'", "''")
  "(id='$id' AND name='$name')"
}) -join ' OR '
$workflowSql = "SELECT count(*) FROM n8n.workflow_entity WHERE $workflowPredicates;"
$workflowCount = docker compose exec -T postgres psql --no-psqlrc --username $dbUser --dbname $n8nDatabase --tuples-only --no-align --command $workflowSql
if ($LASTEXITCODE -ne 0 -or (($workflowCount -join '').Trim() -ne '2')) { throw 'Both managed n8n workflows were not found in persistent PostgreSQL storage.' }

$web = Invoke-WebRequest 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 8
if ($web.StatusCode -ne 200) { throw "Frontend returned HTTP $($web.StatusCode)." }
$editor = Invoke-WebRequest 'http://localhost:5678/' -UseBasicParsing -TimeoutSec 8
if ($editor.StatusCode -ne 200) { throw "n8n editor returned HTTP $($editor.StatusCode)." }
$tags = Invoke-RestMethod 'http://localhost:11434/api/tags' -TimeoutSec 8
$model = if ($settings.OLLAMA_MODEL) { $settings.OLLAMA_MODEL } else { 'smollm2:1.7b' }
if (-not ($tags.models | Where-Object { $_.name -like "$model*" })) { throw "Configured Ollama model '$model' is not available." }
Write-Host 'Automated tests/builds, Compose config, API, database privileges, persistent n8n workflows, n8n health/editor, frontend, and Ollama model checks passed.' -ForegroundColor Green
