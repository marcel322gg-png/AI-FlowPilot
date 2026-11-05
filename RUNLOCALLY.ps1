$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
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
if ($runningServices -contains 'n8n') {
  docker compose stop n8n
  if ($LASTEXITCODE -ne 0) { throw 'Could not stop n8n before moving its database.' }
}
docker compose up -d postgres
if ($LASTEXITCODE -ne 0) { throw 'Could not start PostgreSQL.' }
$settings = @{}
foreach ($line in Get-Content '.env') { if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $settings[$Matches[1]] = $Matches[2].Trim('"', "'") } }
$postgresUser = if ($settings.POSTGRES_USER) { $settings.POSTGRES_USER } else { 'flowpilot' }
$postgresDb = if ($settings.POSTGRES_DB) { $settings.POSTGRES_DB } else { 'flowpilot' }
Write-Host 'Waiting for PostgreSQL before applying the n8n database migration…'
$pgReady = $false
for ($i=0; $i -lt 50; $i++) {
  $null = docker compose exec -T postgres pg_isready -U $postgresUser -d $postgresDb 2>$null
  if ($LASTEXITCODE -eq 0) { $pgReady=$true; break }
  Start-Sleep -Seconds 2
}
if (-not $pgReady) { docker compose ps; throw 'PostgreSQL did not become ready. Inspect docker compose logs postgres.' }
docker compose run --rm --no-deps n8n-db-migrate
if ($LASTEXITCODE -ne 0) { throw 'The n8n database migration failed; n8n was not restarted.' }
docker compose run --rm --no-deps n8n-permissions
if ($LASTEXITCODE -ne 0) { throw 'Could not repair n8n settings-file permissions.' }
docker compose up -d --build --no-deps api
if ($LASTEXITCODE -ne 0) { throw 'Could not build or start the API.' }
Write-Host 'Waiting for the API and PostgreSQL health endpoint…'
$healthy = $false
for ($i=0; $i -lt 50; $i++) {
  try { $h = Invoke-RestMethod 'http://localhost:3001/health' -TimeoutSec 5; if ($h.database -eq 'connected') { $healthy=$true; break } } catch { }
  Start-Sleep -Seconds 3
}
if (-not $healthy) { docker compose ps; throw 'API or database did not become healthy. Inspect with docker compose logs.' }
docker compose up -d --no-deps n8n web ollama
if ($LASTEXITCODE -ne 0) { throw 'Could not start n8n, frontend, and Ollama.' }
$n8nReady = $false
for ($i=0; $i -lt 40; $i++) { try { $null = Invoke-WebRequest 'http://localhost:5678/healthz' -UseBasicParsing -TimeoutSec 2; $n8nReady=$true; break } catch { Start-Sleep -Seconds 3 } }
if (-not $n8nReady) { docker compose ps; throw 'n8n did not become healthy. Inspect with docker compose logs n8n.' }
$null = docker compose exec -T n8n sh -c 'test -f /home/node/.n8n/.flowpilot-workflows-imported' 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Importing workflows into the persistent n8n data volume…'
  docker compose exec -T n8n n8n import:workflow --input=/workflows/qualify-lead.json
  $qualifyImport = $LASTEXITCODE
  docker compose exec -T n8n n8n import:workflow --input=/workflows/error-handler.json
  $errorImport = $LASTEXITCODE
  if ($qualifyImport -eq 0 -and $errorImport -eq 0) {
    docker compose exec -T n8n sh -c 'touch /home/node/.n8n/.flowpilot-workflows-imported'
  } else { Write-Warning 'Workflow import failed; check n8n logs and import the JSON files from n8n/workflows.' }
} else { Write-Host 'Workflows were already initialized in the persistent n8n volume.' }
$model = (Get-Content '.env' | Where-Object { $_ -match '^OLLAMA_MODEL=' } | Select-Object -First 1) -replace '^OLLAMA_MODEL=', ''
if (-not $model) { $model='smollm2:1.7b' }
$ollamaReady = $false
for ($i=0; $i -lt 40; $i++) { try { $tags = Invoke-RestMethod 'http://localhost:11434/api/tags' -TimeoutSec 3; $ollamaReady=$true; break } catch { Start-Sleep -Seconds 3 } }
if ($ollamaReady) {
  if (-not ($tags.models | Where-Object { $_.name -like "$model*" })) {
    Write-Host "Downloading local model $model (first run only)…"
    docker compose exec -T ollama ollama pull $model
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Model download failed. FlowPilot remains available in Demo Mode.' }
  }
} else { Write-Warning 'Ollama did not become ready. FlowPilot remains usable in Demo Mode.' }
Write-Host "`nFlowPilot is available at http://localhost:5173`nAPI: http://localhost:3001/api/health`nn8n: http://localhost:5678`n" -ForegroundColor Green
Start-Process 'http://localhost:5173'
