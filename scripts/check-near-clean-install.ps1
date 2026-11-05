# Isolated source installation/build; does not start the API, wallet, or an indexer.
param([string]$Snapshot = 'HEAD')
$ErrorActionPreference = 'Stop'
if ($Snapshot -ne 'HEAD' -and $Snapshot -notmatch '^[a-f0-9]{40}$') { throw 'Expected HEAD or a Git tree/commit SHA' }
$projectRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$taskRoot = Join-Path $projectRoot ('.tooling\near-clean-install-' + [Guid]::NewGuid().ToString('N'))
$sourceRoot = Join-Path $taskRoot 'source'
New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
$archive = Join-Path $taskRoot 'source.tar'
$oldUserConfig = $env:NPM_CONFIG_USERCONFIG
$oldAudit = $env:NPM_CONFIG_AUDIT
$oldFund = $env:NPM_CONFIG_FUND
$steps = @()
$reportPath = Join-Path $taskRoot 'report.json'
function Invoke-CleanStep([string]$Name, [string]$Directory, [string]$Command, [string[]]$Arguments) {
    $log = Join-Path $taskRoot ($Name + '.log')
    Push-Location $Directory
    $previous = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $Command @Arguments *> $log
        $stepExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previous; Pop-Location }
    $script:steps += @{ name = $Name; exitCode = $stepExit; log = $Name + '.log' }
    Write-Output ($Name + ': exit ' + $stepExit)
    if ($stepExit -ne 0) { throw ('Clean install step failed: ' + $Name + '. See its retained log.') }
}
$result = 'FAIL'
$sourceChecked = $false
try {
    Push-Location $projectRoot
    try {
        & git archive --format=tar --output=$archive $Snapshot
        if ($LASTEXITCODE -ne 0) { throw 'Git source archive failed' }
    } finally { Pop-Location }
    & tar -xf $archive -C $sourceRoot
    if ($LASTEXITCODE -ne 0) { throw 'Source extraction failed' }
    foreach ($relative in @('.env','backend\.env','.tooling','node_modules','backend\node_modules','.git')) {
        if (Test-Path -LiteralPath (Join-Path $sourceRoot $relative)) { throw ('Unexpected local state in source archive: ' + $relative) }
    }
    $sourceChecked = $true
    $emptyConfig = Join-Path $taskRoot 'empty-npmrc'
    Set-Content -LiteralPath $emptyConfig -Value '' -Encoding ascii
    $env:NPM_CONFIG_USERCONFIG = $emptyConfig
    $env:NPM_CONFIG_AUDIT = 'false'
    $env:NPM_CONFIG_FUND = 'false'
    # Cache-only installation: no registry login, public RPC, or wallet is needed.
    Invoke-CleanStep 'frontend-install' $sourceRoot 'npm.cmd' @('ci','--offline','--no-audit','--no-fund')
    Invoke-CleanStep 'frontend-check' $sourceRoot 'npm.cmd' @('run','check')
    $backendRoot = Join-Path $sourceRoot 'backend'
    Invoke-CleanStep 'backend-install' $backendRoot 'npm.cmd' @('ci','--offline','--no-audit','--no-fund')
    Invoke-CleanStep 'backend-build' $backendRoot 'npm.cmd' @('run','build')
    Invoke-CleanStep 'backend-check' $backendRoot 'npm.cmd' @('run','typecheck')
    Invoke-CleanStep 'backend-tests' $backendRoot 'npm.cmd' @('test')
    $result = 'PASS'
} finally {
    $env:NPM_CONFIG_USERCONFIG = $oldUserConfig
    $env:NPM_CONFIG_AUDIT = $oldAudit
    $env:NPM_CONFIG_FUND = $oldFund
    @{ result = $result; snapshot = $Snapshot; scope = 'Fresh Git source archive, empty node_modules, cache-only npm ci, tests/builds. Not a browser/newcomer walkthrough or live server startup.'; noLocalEnvOrToolingCopied = $sourceChecked; publicFinancialSubmission = 'NOT RUN'; steps = $steps } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding utf8
    Write-Output ('Retained isolated workspace/report: ' + $taskRoot)
}
