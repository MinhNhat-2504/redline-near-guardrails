# Isolated, disposable PostgreSQL test runner; never uses an existing DATABASE_URL.
param([switch]$LiveProof)
$ErrorActionPreference = 'Stop'
function Invoke-TestNative([string]$Command, [string[]]$Arguments) {
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue' # Native progress on stderr is not a failure.
        & $Command @Arguments
        $nativeExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if ($nativeExit -ne 0) { throw ('Test command failed: ' + $Command + ', exit ' + $nativeExit) }
}
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$testName = 'redline-near-it-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$oldDatabase = $env:DATABASE_URL
$oldTestDatabase = $env:NEAR_TEST_DATABASE_URL
$randomBuffer = New-Object byte[] 32
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($randomBuffer) } finally { $generator.Dispose() }
$password = [Convert]::ToBase64String($randomBuffer)
$started = $false
Push-Location (Join-Path $projectRoot 'backend')
try {
    Invoke-TestNative 'docker.exe' @('run','--detach','--rm','--name',$testName,'--label','redline.task=near-db-disposable-test','--env','POSTGRES_USER=redline_test','--env','POSTGRES_DB=redline_near_test','--env',"POSTGRES_PASSWORD=$password",'--publish','127.0.0.1::5432','--tmpfs','/var/lib/postgresql/data:rw','postgres:16-bookworm@sha256:e8a07d2c7579b038938cdba6c539e580e5001caf9ea203d397b5cc83e76bd938') | Out-Null
    $started = $true
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        & docker.exe exec $testName pg_isready -U redline_test -d redline_near_test *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Temporary Postgres readiness timed out' }
    $portText = & docker.exe port $testName '5432/tcp'
    $testPort = ($portText -split ':')[-1].Trim()
    $env:DATABASE_URL = 'postgresql://redline_test:' + [Uri]::EscapeDataString($password) + '@127.0.0.1:' + $testPort + '/redline_near_test?schema=public'
    $env:NEAR_TEST_DATABASE_URL = $env:DATABASE_URL
    # Generate Prisma once via npm run build before starting parallel/live checks.
    # Regenerating here can lock the Windows query-engine DLL used by another process.
    Invoke-TestNative 'npx.cmd' @('prisma','db','execute','--schema','prisma/schema.prisma','--file','prisma/near-migrations/001-near.sql')
    Invoke-TestNative 'npm.cmd' @('run','test:near:db')
    if ($LiveProof) {
        Invoke-TestNative 'npx.cmd' @('tsx','scripts/near-live-api-proof.ts')
        Invoke-TestNative 'npx.cmd' @('tsx','scripts/near-startup-smoke.ts')
    }
} finally {
    $env:DATABASE_URL = $oldDatabase
    $env:NEAR_TEST_DATABASE_URL = $oldTestDatabase
    if ($started) {
        $labels = (& docker.exe inspect --format '{{json .Config.Labels}}' $testName) | ConvertFrom-Json
        if ($labels.'redline.task' -ne 'near-db-disposable-test' -or $testName -notmatch '^redline-near-it-[a-f0-9]{12}$') {
            throw 'Refusing cleanup: temporary container identity mismatch'
        }
        & docker.exe stop $testName | Out-Null
    }
    Pop-Location
}
