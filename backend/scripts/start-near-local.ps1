# Persistent local NEAR demo database. SetupOnly never opens an executor credential.
param([switch]$SetupOnly, [ValidateRange(1024,65535)][int]$Port = 8787, [string]$RpcUrl = 'https://test.rpc.fastnear.com')
$ErrorActionPreference = 'Stop'
function Invoke-LocalNative([string]$Command, [string[]]$Arguments) {
    $oldPreference = $ErrorActionPreference
    try { $ErrorActionPreference = 'Continue'; & $Command @Arguments; $result = $LASTEXITCODE }
    finally { $ErrorActionPreference = $oldPreference }
    if ($result -ne 0) { throw ('Local setup command failed: ' + $Command + ', exit ' + $result) }
}
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$localDirectory = Join-Path $root '.tooling/near-local'
$statePath = Join-Path $localDirectory 'database.json'
$utf8 = [Text.UTF8Encoding]::new($false)
New-Item -ItemType Directory -Path $localDirectory -Force | Out-Null
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
} else {
    $suffix = [Guid]::NewGuid().ToString('N').Substring(0,12)
    $randomBuffer = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($randomBuffer) } finally { $rng.Dispose() }
    $state = [pscustomobject]@{ name = ('redline-near-local-' + $suffix); volume = ('redline-near-local-' + $suffix + '-data'); password = [Convert]::ToBase64String($randomBuffer); schemaVersion = 0 }
    [IO.File]::WriteAllText($statePath, ($state | ConvertTo-Json), $utf8)
}
if ($state.name -notmatch '^redline-near-local-[a-f0-9]{12}$' -or $state.volume -ne ($state.name + '-data') -or -not $state.password) {
    throw 'Local database metadata invalid; existing data was not modified'
}
Push-Location (Join-Path $root 'backend')
try {
    $volumes = @(Invoke-LocalNative 'docker.exe' @('volume','ls','--format','{{.Name}}'))
    if ($volumes -contains $state.volume) {
        $labels = (Invoke-LocalNative 'docker.exe' @('volume','inspect','--format','{{json .Labels}}',$state.volume)) | ConvertFrom-Json
        if ($labels.'redline.task' -ne 'near-local-dev') { throw 'Refusing to reuse unrelated Docker volume' }
    } else {
        Invoke-LocalNative 'docker.exe' @('volume','create','--label','redline.task=near-local-dev',$state.volume) | Out-Null
    }
    $containers = @(Invoke-LocalNative 'docker.exe' @('ps','--all','--format','{{.Names}}'))
    if ($containers -contains $state.name) {
        $labels = (Invoke-LocalNative 'docker.exe' @('inspect','--format','{{json .Config.Labels}}',$state.name)) | ConvertFrom-Json
        if ($labels.'redline.task' -ne 'near-local-dev') { throw 'Refusing to reuse unrelated Docker container' }
        Invoke-LocalNative 'docker.exe' @('start',$state.name) | Out-Null
    } else {
        Invoke-LocalNative 'docker.exe' @('run','--detach','--name',$state.name,'--label','redline.task=near-local-dev','--env','POSTGRES_USER=redline_local','--env','POSTGRES_DB=redline_near_local','--env',('POSTGRES_PASSWORD='+$state.password),'--publish','127.0.0.1::5432','--mount',('type=volume,source='+$state.volume+',target=/var/lib/postgresql/data'),'postgres:16-bookworm@sha256:e8a07d2c7579b038938cdba6c539e580e5001caf9ea203d397b5cc83e76bd938') | Out-Null
    }
    $ready = $false
    for ($attempt=0; $attempt -lt 60; $attempt++) {
        & docker.exe exec $state.name pg_isready -U redline_local -d redline_near_local *> $null
        if ($LASTEXITCODE -eq 0) { $ready=$true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Local Postgres readiness timed out; data retained' }
    $binding = Invoke-LocalNative 'docker.exe' @('port',$state.name,'5432/tcp')
    if ($binding -notmatch '^127\.0\.0\.1:[0-9]+$') { throw 'Local database must bind only to 127.0.0.1' }
    $databasePort = ($binding -split ':')[-1].Trim()
    $env:DATABASE_URL = 'postgresql://redline_local:' + [Uri]::EscapeDataString($state.password) + '@127.0.0.1:' + $databasePort + '/redline_near_local?schema=public'
    if ($state.schemaVersion -eq 0) {
        Invoke-LocalNative 'npx.cmd' @('prisma','db','execute','--schema','prisma/schema.prisma','--file','prisma/near-migrations/001-near.sql')
        $state.schemaVersion = 1
        [IO.File]::WriteAllText($statePath, ($state | ConvertTo-Json), $utf8)
    } elseif ($state.schemaVersion -ne 1) { throw 'Unknown local schema version; data retained' }
    Write-Output 'Local NEAR database ready. Existing data and password retained on restart.'
    if ($SetupOnly) { Write-Output 'SetupOnly complete: no key file read, no server started, no chain transaction submitted.'; return }
    if (-not (Test-Path -LiteralPath 'dist/server.js')) { throw 'Run npm.cmd run build first, then restart this helper' }
    $metadata = Get-Content -LiteralPath (Join-Path $root '.tooling/near-executor/public.json') -Raw | ConvertFrom-Json
    $expectedCredential = Join-Path $root '.tooling/near-executor/executor.json'
    if ($metadata.accountId -ne 'nhat-redline-agent.testnet' -or [IO.Path]::GetFullPath($metadata.credentialPath) -ne [IO.Path]::GetFullPath($expectedCredential)) { throw 'Unexpected executor public metadata; no credential read' }
    $env:CHAIN = 'near'
    $env:NEAR_NETWORK = 'testnet'
    $env:NEAR_APP_ORIGIN = 'http://localhost:5173'
    $env:NEAR_RPC_URL = $RpcUrl
    $env:NEAR_CONTRACT_ID = 'nhat-redline-vault.testnet'
    $env:NEAR_EXECUTOR_ID = $metadata.accountId
    $env:NEAR_EXECUTOR_PUBLIC_KEY = $metadata.publicKey
    $env:NEAR_EXECUTOR_CREDENTIAL_PATH = $expectedCredential
    $env:PORT = [string]$Port
    Write-Output ('Starting local NEAR API at http://127.0.0.1:' + $Port + '. Keep this window open; Ctrl+C stops the API. Database is retained.')
    Invoke-LocalNative 'node.exe' @('dist/server.js')
} finally { Pop-Location }
