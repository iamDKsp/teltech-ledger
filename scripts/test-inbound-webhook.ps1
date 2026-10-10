param(
  [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
  [int]$TestPort = 55439
)
$ErrorActionPreference = 'Stop'
$testRepo = Split-Path -Parent $PSScriptRoot
$testCluster = Join-Path $testRepo ('scratch\webhook-test-' + [guid]::NewGuid().ToString('N'))
$testStarted = $false
$previousDatabaseUrl = $env:DATABASE_URL
$previousTestUrl = $env:INBOUND_WEBHOOK_TEST_DATABASE_URL
foreach ($binary in @('initdb.exe', 'pg_ctl.exe', 'createdb.exe')) {
  if (!(Test-Path -LiteralPath (Join-Path $PostgresBin $binary))) { throw "PostgreSQL não encontrado em $PostgresBin" }
}
New-Item -ItemType Directory -Path $testCluster -Force | Out-Null
Push-Location $testRepo
try {
  & (Join-Path $PostgresBin 'initdb.exe') -D $testCluster -U webhook_test -A trust --encoding=UTF8 --no-locale
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao inicializar PostgreSQL de teste' }
  & (Join-Path $PostgresBin 'pg_ctl.exe') -D $testCluster -l (Join-Path $testCluster 'postgres.log') -o "-h 127.0.0.1 -p $TestPort" -w start
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar PostgreSQL de teste' }
  $testStarted = $true
  & (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p $TestPort -U webhook_test webhook_test
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar banco de teste' }
  $env:DATABASE_URL = "postgresql://webhook_test@127.0.0.1:$TestPort/webhook_test"
  $env:INBOUND_WEBHOOK_TEST_DATABASE_URL = $env:DATABASE_URL
  & pnpm --filter '@workspace/db' run push-force
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar schema de teste' }
  & pnpm --filter '@workspace/api-server' run test:webhook-db
  if ($LASTEXITCODE -ne 0) { throw 'Testes de webhook falharam' }
} finally {
  $env:DATABASE_URL = $previousDatabaseUrl
  $env:INBOUND_WEBHOOK_TEST_DATABASE_URL = $previousTestUrl
  if ($testStarted) { & (Join-Path $PostgresBin 'pg_ctl.exe') -D $testCluster -m fast -w stop }
  Pop-Location
  Write-Output "Cluster de teste preservado (servidor encerrado): $testCluster"
}
