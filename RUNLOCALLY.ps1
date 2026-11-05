$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
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
function Wait-FlowPilotContainerHealthy([string]$service,[int]$attempts=50) {
  for ($attempt=0; $attempt -lt $attempts; $attempt++) {
    if ((Get-FlowPilotContainerHealth $service) -eq 'healthy') { return $true }
    if ($attempt -lt ($attempts - 1)) { Start-Sleep -Seconds 3 }
  }
  return $false
}
Write-Host "`n FlowPilot · local startup`n" -ForegroundColor Cyan
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop is not installed or docker.exe is not on PATH.' }
$null = docker info --format '{{.ServerVersion}}' 2>$null
if ($LASTEXITCODE -ne 0) { throw 'Docker Engine is unavailable. Start Docker Desktop and confirm your Windows account can access its Linux engine.' }
if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $secretBytes = New-Object byte[] 32
  $rng.GetBytes($secretBytes)
  $pw = [Convert]::ToBase64String($secretBytes)
  $rng.GetBytes($secretBytes)
  $n8nPw = [Convert]::ToBase64String($secretBytes)
  $keyBytes = New-Object byte[] 48
  $rng.GetBytes($keyBytes)
  $key = [Convert]::ToBase64String($keyBytes)
  $rng.Dispose()
  $txt = Get-Content -Raw '.env'
  $txt = $txt.Replace('change-this-local-password',$pw).Replace('change-this-n8n-password',$n8nPw).Replace('replace-with-a-long-random-local-key',$key)
  Set-Content -Path '.env' -Value $txt -NoNewline -Encoding ascii
  Write-Host 'Created .env with generated local-only secrets.' -ForegroundColor Green
}
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration is invalid. Check .env.' }
$runningServices = docker compose ps --status running --services
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect running FlowPilot services.' }
$n8nWasRunning = $runningServices -contains 'n8n'
$n8nInitiallyHealthy = $false
if ($n8nWasRunning) { $n8nInitiallyHealthy = Wait-FlowPilotContainerHealthy 'n8n' 10 }
$n8nStoppedForMigration = $n8nWasRunning -and -not $n8nInitiallyHealthy
try {
if ((Get-FlowPilotContainerHealth 'postgres') -ne 'healthy') {
  docker compose up -d postgres
  if ($LASTEXITCODE -ne 0) { throw 'Could not start PostgreSQL.' }
}
$settings = @{}
foreach ($line in Get-Content '.env') { if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $settings[$Matches[1]] = $Matches[2].Trim('"', "'") } }
$postgresUser = if ($settings.POSTGRES_USER) { $settings.POSTGRES_USER } else { 'flowpilot' }
$postgresDb = if ($settings.POSTGRES_DB) { $settings.POSTGRES_DB } else { 'flowpilot' }
if (-not (Wait-FlowPilotContainerHealthy 'postgres' 50)) { docker compose ps; throw 'PostgreSQL did not become healthy. Inspect docker compose logs postgres.' }
if ($n8nStoppedForMigration) {
  docker compose stop n8n
  if ($LASTEXITCODE -ne 0) { throw 'Could not stop n8n before moving its database.' }
}
if (-not $n8nInitiallyHealthy) {
Write-Host 'Provisioning the n8n database and settings-file permissions…'
docker compose run --rm --no-deps n8n-db-migrate
if ($LASTEXITCODE -ne 0) { throw 'The n8n database migration failed; n8n was not restarted.' }
docker compose run --rm --no-deps n8n-permissions
if ($LASTEXITCODE -ne 0) { throw 'Could not repair n8n settings-file permissions.' }
} else { Write-Host 'n8n is already healthy; preserving it and skipping one-time provisioning.' }
if (-not $n8nInitiallyHealthy) {
  docker compose up -d --no-deps n8n
  if ($LASTEXITCODE -ne 0) { throw 'Could not start n8n after provisioning.' }
  if (-not (Wait-FlowPilotContainerHealthy 'n8n' 40)) { docker compose ps; throw 'n8n did not become healthy after provisioning.' }
}
docker compose up -d --build --no-deps api
if ($LASTEXITCODE -ne 0) { throw 'Could not build or start the API.' }
if (-not (Wait-FlowPilotContainerHealthy 'api' 50)) { docker compose ps; throw 'API did not become healthy. Inspect docker compose logs api.' }
docker compose up -d --no-deps web ollama
if ($LASTEXITCODE -ne 0) { throw 'Could not start frontend and Ollama.' }
if (-not (Wait-FlowPilotContainerHealthy 'web' 30)) { docker compose ps; throw 'Frontend did not become healthy. Inspect docker compose logs web.' }
$managedWorkflows = @(
  (Get-Content 'n8n/workflows/qualify-lead.json' -Raw | ConvertFrom-Json),
  (Get-Content 'n8n/workflows/error-handler.json' -Raw | ConvertFrom-Json)
)
$workflowConflicts = @($managedWorkflows | ForEach-Object {
  $id = $_.id.Replace("'", "''")
  $name = $_.name.Replace("'", "''")
  "(id='$id' AND name<>'$name')"
}) -join ' OR '
$workflowConflictSql = "SELECT count(*) FROM n8n.workflow_entity WHERE $workflowConflicts;"
$workflowConflictsFound = docker compose exec -T postgres psql --no-psqlrc --username $postgresUser --dbname flowpilot_n8n --tuples-only --no-align --command $workflowConflictSql
if ($LASTEXITCODE -ne 0) { throw 'Could not verify managed n8n workflow IDs before import.' }
if ((($workflowConflictsFound -join '').Trim()) -ne '0') { throw 'A managed n8n workflow ID belongs to a different workflow; refusing to overwrite it.' }
$workflowPresent = @($managedWorkflows | ForEach-Object {
  $id = $_.id.Replace("'", "''")
  $name = $_.name.Replace("'", "''")
  "(id='$id' AND name='$name')"
}) -join ' OR '
$workflowCountSql = "SELECT count(*) FROM n8n.workflow_entity WHERE $workflowPresent;"
$workflowCount = docker compose exec -T postgres psql --no-psqlrc --username $postgresUser --dbname flowpilot_n8n --tuples-only --no-align --command $workflowCountSql
if ($LASTEXITCODE -ne 0) { throw 'Could not check persistent n8n workflows.' }
if ((($workflowCount -join '').Trim()) -ne '2') {
  Write-Host 'Importing the two managed workflows into persistent n8n storage…'
  docker compose exec -T n8n n8n import:workflow --separate --input=/workflows/
  if ($LASTEXITCODE -ne 0) { throw 'n8n workflow import failed.' }
  $workflowCount = docker compose exec -T postgres psql --no-psqlrc --username $postgresUser --dbname flowpilot_n8n --tuples-only --no-align --command $workflowCountSql
  if ($LASTEXITCODE -ne 0 -or (($workflowCount -join '').Trim()) -ne '2') { throw 'Workflow import finished without both managed workflows in persistent n8n storage.' }
} else { Write-Host 'Both managed workflows are present in persistent n8n storage.' }
$model = (Get-Content '.env' | Where-Object { $_ -match '^OLLAMA_MODEL=' } | Select-Object -First 1) -replace '^OLLAMA_MODEL=', ''
if (-not $model) { $model='smollm2:1.7b' }
$ollamaReady = Wait-FlowPilotContainerHealthy 'ollama' 40
if ($ollamaReady) {
  try { $tags = Invoke-RestMethod 'http://localhost:11434/api/tags' -TimeoutSec 8 } catch { $tags=$null }
  if (-not $tags) { Write-Warning 'Ollama container is healthy but its model endpoint is unavailable. FlowPilot remains usable in Demo Mode.' }
  elseif (-not ($tags.models | Where-Object { $_.name -like "$model*" })) {
    Write-Host "Downloading local model $model (first run only)…"
    docker compose exec -T ollama ollama pull $model
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Model download failed. FlowPilot remains available in Demo Mode.' }
  }
} else { Write-Warning 'Ollama did not become ready. FlowPilot remains usable in Demo Mode.' }
Write-Host "`nFlowPilot is available at http://localhost:5173`nAPI: http://localhost:3001/api/health`nn8n: http://localhost:5678`n" -ForegroundColor Green
Start-Process 'http://localhost:5173'
} catch {
  if ($n8nStoppedForMigration) {
    Write-Warning 'Startup failed after stopping the previously running n8n service; restoring its existing container.'
    docker compose start n8n
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Could not automatically restore n8n. Start it with: docker compose start n8n' }
    elseif (-not (Wait-FlowPilotContainerHealthy 'n8n' 40)) { Write-Warning 'n8n restart was requested but its container did not report healthy.' }
  }
  throw
}
