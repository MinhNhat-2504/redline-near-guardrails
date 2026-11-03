# Pure local OS listener-table guard; no wallet, credential, RPC or signing operations.
function Assert-NearBackendStopped([ValidateRange(1,65535)][int]$Port = 8787) {
    try { $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() }
    catch { throw 'Could not inspect local listeners; no signing attempted' }
    if (@($listeners | Where-Object { $_.Port -eq $Port }).Count -gt 0) {
        throw 'Backend port is still open. Press Ctrl+C in backend window first.'
    }
}
