# Fresh Postgres setup for ApkayA Engine (native Windows PostgreSQL 17).
#
# Usage (from repo root):
#   .\apps\engine\scripts\setup-postgres.ps1
#   .\apps\engine\scripts\setup-postgres.ps1 -ReinstallServer -PostgresSuperPassword "your-postgres-password"
#
# With -ReinstallServer: stops PostgreSQL 17, uninstalls it, reinstalls via winget
# with --superpassword set to -PostgresSuperPassword (required for reinstall).
#
# Without -ReinstallServer: uses existing local PostgreSQL; requires -PostgresSuperPassword
# for the postgres superuser, or POSTGRES_SUPER_PASSWORD in the environment.

param(
  [switch]$ReinstallServer,
  [string]$PostgresSuperPassword = $env:POSTGRES_SUPER_PASSWORD
)

$ErrorActionPreference = "Stop"

$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$uninstaller = "C:\Program Files\PostgreSQL\17\uninstall-postgresql.exe"
$serviceName = "postgresql-x64-17"
$dbName = "engine"
$dbUser = "apkaya"
$dbPassword = "apkaya"

function Require-SuperPassword {
  if ([string]::IsNullOrWhiteSpace($PostgresSuperPassword)) {
    throw @"
Postgres superuser password required.
Set POSTGRES_SUPER_PASSWORD or pass -PostgresSuperPassword.
For a full server reinstall, also pass -ReinstallServer.
"@
  }
}

function Invoke-PsqlSuper {
  param([string]$Sql)
  $env:PGPASSWORD = $PostgresSuperPassword
  & $psql -U postgres -h localhost -v ON_ERROR_STOP=1 -c $Sql
  if ($LASTEXITCODE -ne 0) { throw "psql failed: $Sql" }
}

if ($ReinstallServer) {
  Require-SuperPassword
  Write-Host "Stopping PostgreSQL 17 service..."
  Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue

  if (Test-Path $uninstaller) {
    Write-Host "Uninstalling PostgreSQL 17..."
    & $uninstaller --mode unattended
  }

  Write-Host "Installing PostgreSQL 17 (fresh)..."
  winget install PostgreSQL.PostgreSQL.17 --accept-package-agreements --accept-source-agreements `
    --override "--mode unattended --unattendedmodeui none --superpassword `"$PostgresSuperPassword`""

  Start-Sleep -Seconds 10
  Start-Service -Name $serviceName
  Start-Sleep -Seconds 5
}

Require-SuperPassword

if (-not (Test-Path $psql)) {
  throw "psql not found at $psql. Install PostgreSQL 17 or use docker compose up postgres -d."
}

Write-Host "Resetting project database and role..."
Invoke-PsqlSuper "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$dbName';" 2>$null
Invoke-PsqlSuper "DROP DATABASE IF EXISTS $dbName;"
Invoke-PsqlSuper "DROP ROLE IF EXISTS $dbUser;"
Invoke-PsqlSuper "CREATE ROLE $dbUser WITH LOGIN PASSWORD '$dbPassword';"
Invoke-PsqlSuper "CREATE DATABASE $dbName OWNER $dbUser;"
Invoke-PsqlSuper "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;"

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Fresh Postgres ready:"
Write-Host "  DATABASE_URL=postgres://${dbUser}:${dbPassword}@localhost:5432/${dbName}"
