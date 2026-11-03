# USER-RUN ONLY. Signing is an explicit flag; default prints the approved proposal.
param([switch]$SignAndSend, [switch]$CheckCli)
$ErrorActionPreference = 'Stop'
$executor = 'nhat-redline-agent.testnet'
$vault = 'nhat-redline-vault.testnet'
$publicKey = 'ed25519:9hauPZp4YBAHNMNp8bf4ThyYuSMeVTrKn5twEU2JrCy3'
$oldPacketNonce = [System.Numerics.BigInteger]::Parse('276011715000001')
$arguments = @('transaction','construct-transaction',$executor,'receiver-id',$executor,
    'add-action','delete-key',$publicKey,'add-action','add-key','grant-function-call-access',
    '--allowance','0.1 NEAR','--contract-account-id',$vault,'--function-names','execute_transfer',
    'use-manually-provided-public-key',$publicKey,'skip','network-config','testnet','sign-with-keychain','send')
if ($SignAndSend -and $CheckCli) { throw 'Choose either CheckCli or SignAndSend' }
Write-Output 'Atomic Testnet key reset: SAME public key, SAME vault/execute_transfer permission, SAME 0.1 NEAR allowance.'
Write-Output 'Signer=receiver nhat-redline-agent.testnet. Actions: DeleteKey then AddKey. No principal transfer or deposit.'
Write-Output ('Public key: ' + $publicKey)
$cli = Join-Path $env:APPDATA 'npm\node_modules\near-cli-rs\node_modules\.bin_real\near.exe'
if (-not (Test-Path -LiteralPath $cli)) { throw 'Expected near-cli-rs executable missing; no signing attempted' }
if ($CheckCli) {
    # Clap handles --help before executing any command or keychain operation.
    & $cli @arguments --help
    if ($LASTEXITCODE -ne 0) { throw 'CLI argument validation failed' }
    Write-Output 'CLI syntax check only. No RPC, keychain access, signature or transaction.'
    return
}
if (-not $SignAndSend) {
    Write-Output 'REVIEW ONLY. Stop backend with Ctrl+C, then run this script with -SignAndSend to sign locally.'
    Write-Output 'Do not share executor.json or session.json. After reset, verify FINAL nonce before recovery.'
    return
}
. (Join-Path $PSScriptRoot 'near-maintenance-guard.ps1')
Assert-NearBackendStopped
function Read-PublicRpc([string]$Method, $Parameters) {
    $body = @{jsonrpc='2.0';id='redline-key-reset-preflight';method=$Method;params=$Parameters} | ConvertTo-Json -Depth 10 -Compress
    $response = Invoke-RestMethod -Uri 'https://test.rpc.fastnear.com' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 20
    if ($response.id -ne 'redline-key-reset-preflight' -or $response.error -or -not $response.result) { throw 'Public Testnet preflight unavailable; no signing attempted' }
    return $response.result
}
$status = Read-PublicRpc 'status' @()
if ($status.chain_id -ne 'testnet' -or $status.sync_info.syncing) { throw 'RPC identity/sync check failed' }
Start-Sleep -Seconds 2
$key = Read-PublicRpc 'query' @{request_type='view_access_key';finality='final';account_id=$executor;public_key=$publicKey}
if ([System.Numerics.BigInteger]::Parse([string]$key.nonce) -gt $oldPacketNonce) {
    throw 'Key nonce already supersedes old packet. Do not reset again; verify the previous reset transaction.'
}
$permission = $key.permission.FunctionCall
if (-not $permission -or $permission.receiver_id -ne $vault -or
    @($permission.method_names).Count -ne 1 -or $permission.method_names[0] -ne 'execute_transfer' -or
    $permission.allowance -ne '100000000000000000000000') { throw 'Current scoped key differs from reviewed proposal; stopped' }
$version = & $cli --version
if ($LASTEXITCODE -ne 0 -or ($version -join "`n") -notmatch 'near-cli-rs 0\.30\.1') { throw 'Review requires near-cli-rs0.30.1; no signing attempted' }
Write-Output 'Preflight passed. CLI will sign locally with the existing agent FullAccess keychain key.'
Write-Output 'Review EXACTLY two actions: DeleteKey and AddKey for the SAME scoped public key.'
Assert-NearBackendStopped
& $cli @arguments
if ($LASTEXITCODE -ne 0) { throw 'Key reset outcome not confirmed. Keep request/database; check transaction before retrying.' }
Write-Output 'CLI returned success. Send only the transaction ID/output for independent FINAL verification.'
Write-Output 'Keep backend stopped. Do not run transfer submit until key nonce and journal recovery are verified.'
