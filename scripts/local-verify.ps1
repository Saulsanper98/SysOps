# Verificación local: PostgreSQL arriba + esquema + seed + recordatorio de webhook.
# Uso (desde la raíz del repo SysOps):
#   docker compose up -d postgres redis
#   .\scripts\local-verify.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Get-DotEnvValue([string]$Key) {
  $path = Join-Path $Root ".env"
  if (-not (Test-Path $path)) { return $null }
  foreach ($line in Get-Content $path) {
    if ($line -match "^\s*$" -or $line.TrimStart().StartsWith("#")) { continue }
    if ($line -match "^\s*$Key\s*=\s*(.*)\s*$") { return $Matches[1].Trim() }
  }
  return $null
}

Write-Host "== SysOps: verificación local ==" -ForegroundColor Cyan

$dbUrl = Get-DotEnvValue "DATABASE_URL"
if (-not $dbUrl) { throw "DATABASE_URL no definido en .env" }

Write-Host "`n[1/3] Comprobando conexión a PostgreSQL..." -ForegroundColor Yellow
Push-Location (Join-Path $Root "backend")
try {
  $probe = @"
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query('select 1 as ok'))
  .then((r) => { console.log('PostgreSQL OK:', r.rows[0]); return c.end(); })
  .catch((e) => { console.error(e.message); process.exit(1); });
"@
  node -e $probe
  if ($LASTEXITCODE -ne 0) {
    Write-Host "`nNo hay conexión a PostgreSQL. Arranca la base de datos, por ejemplo:" -ForegroundColor Red
    Write-Host "  cd `"$Root`"" -ForegroundColor Gray
    Write-Host "  docker compose up -d postgres redis" -ForegroundColor Gray
    exit 1
  }
}
finally {
  Pop-Location
}

Write-Host "`n[2/3] drizzle-kit push + seed..." -ForegroundColor Yellow
Push-Location (Join-Path $Root "backend")
try {
  npm run db:setup
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  Pop-Location
}

$secret = Get-DotEnvValue "INGEST_WEBHOOK_SECRET"
$port = Get-DotEnvValue "PORT"
if (-not $port) { $port = "3012" }

Write-Host "`n[3/3] Webhook de prueba (con backend en marcha: npm run dev en /backend)" -ForegroundColor Yellow
if ($secret) {
  $body = '{"source":"zabbix","externalId":"smoke-' + [guid]::NewGuid().ToString().Substring(0,8) + '","title":"Smoke test ingest","severity":"media","tags":["smoke"]}'
  Write-Host "PowerShell (ejemplo):" -ForegroundColor Gray
  Write-Host "  `$h = @{ 'X-Ingest-Secret' = '$secret'; 'Content-Type' = 'application/json' }" -ForegroundColor DarkGray
  Write-Host "  Invoke-RestMethod -Uri 'http://localhost:$port/api/ingest/alerts' -Method Post -Headers `$h -Body '$body'" -ForegroundColor DarkGray
}
else {
  Write-Host "Define INGEST_WEBHOOK_SECRET en .env (mín. 8 caracteres) para probar ingest." -ForegroundColor DarkGray
}

Write-Host "`nListo. UI: correlación en /alerts (pestaña Base de datos); CMDB en Ajustes > Inventario CMDB." -ForegroundColor Green
