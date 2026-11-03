param(
    [ValidateRange(1, 24)]
    [int]$DurationHours = 1
)

# Prepare an unsigned, reviewable demo grant. No RPC, signing, keys or transfers.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$grantId = 'demo-' + [Guid]::NewGuid().ToString('N')
$packageDirectory = Join-Path $projectRoot ('.tooling/near-testnet/' + $grantId)
New-Item -ItemType Directory -Path $packageDirectory | Out-Null
$expiry = [DateTimeOffset]::UtcNow.AddHours($DurationHours)
$expiryNs = ([System.Numerics.BigInteger]$expiry.ToUnixTimeMilliseconds() * [System.Numerics.BigInteger]1000000).ToString([System.Globalization.CultureInfo]::InvariantCulture)

# Field order is canonical v1. Amounts/timestamps are decimal strings, not floats.
$canonical = [ordered]@{
    schema = 'redline.near.policy.v1'
    network = 'testnet'
    contract_id = 'nhat-redline-vault.testnet'
    owner_id = 'nhat-redline-owner.testnet'
    grant_id = $grantId
    executor = 'nhat-redline-agent.testnet'
    asset = 'NEAR'
    spend_cap = '200000000000000000000000'
    max_transactions = 3
    recipients = @('nhat-redline-payee.testnet')
    expires_at_ns = $expiryNs
    cooldown_ns = '0'
}
$canonicalJson = ConvertTo-Json -InputObject $canonical -Depth 8 -Compress
$utf8 = [System.Text.UTF8Encoding]::new($false)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
    $policyHash = ([BitConverter]::ToString($sha256.ComputeHash($utf8.GetBytes($canonicalJson)))).Replace('-', '').ToLowerInvariant()
} finally {
    $sha256.Dispose()
}
$arguments = [ordered]@{
    grant_id = $grantId
    policy = [ordered]@{
        executor = $canonical.executor
        policy_hash = $policyHash
        spend_cap = $canonical.spend_cap
        max_transactions = $canonical.max_transactions
        recipients = $canonical.recipients
        expires_at_ns = $canonical.expires_at_ns
        cooldown_ns = $canonical.cooldown_ns
    }
}
$canonicalPath = Join-Path $packageDirectory 'policy-canonical.json'
$grantPath = Join-Path $packageDirectory 'grant.json'
[System.IO.File]::WriteAllText($canonicalPath, $canonicalJson, $utf8)
[System.IO.File]::WriteAllText($grantPath, (ConvertTo-Json -InputObject $arguments -Depth 8), $utf8)
[System.IO.File]::WriteAllText((Join-Path $projectRoot '.tooling/near-testnet/latest-grant-path.txt'), $grantPath, $utf8)

Write-Output 'UNSIGNED proposal only. No transaction has been submitted.'
Write-Output ('Grant: ' + $grantId)
Write-Output ('Owner: ' + $canonical.owner_id)
Write-Output ('Executor: ' + $canonical.executor)
Write-Output ('Recipient: ' + $canonical.recipients[0])
Write-Output 'Total budget: 0.2 native NEAR; max 3 transfers; cooldown 0.'
Write-Output ('Expires (UTC+7): ' + $expiry.ToOffset([TimeSpan]::FromHours(7)).ToString('yyyy-MM-dd HH:mm:ss zzz'))
Write-Output ('Policy SHA256: ' + $policyHash)
Write-Output ('Review/signing arguments: ' + $grantPath)
