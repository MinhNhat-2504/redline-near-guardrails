# Offline English narration from Windows' installed voice; no API, screen capture or wallet access.
param([string]$Voice = 'Microsoft Zira Desktop')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$projectRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$outputRoot = Join-Path $projectRoot '.tooling\near-demo-narration'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$lines = @(
    @{ scene = 'Overview'; text = 'An AI assistant should not need unrestricted access to your wallet.' },
    @{ scene = 'Overview'; text = 'REDLINE lets you approve a budget, recipient, and expiry, while a NEAR contract checks each payment request.' },
    @{ scene = 'Evidence tour: English'; text = 'This is a historical Testnet walkthrough, with independently verified transaction evidence.' },
    @{ scene = 'Evidence tour: English'; text = 'The owner granted point zero five NEAR, at most three payments, to one approved recipient.' },
    @{ scene = 'Within permission: open original Explorer receipt'; text = 'A valid point zero one NEAR payment settled. The link opens its actual transaction.' },
    @{ scene = 'Within permission: open original Explorer receipt'; text = 'The contract callback, not a prediction in the interface, confirms the payment result.' },
    @{ scene = 'Over budget'; text = 'A request beyond the approved budget is blocked.' },
    @{ scene = 'Wrong recipient'; text = 'A request to another recipient is blocked too. These requests do not transfer principal to the proposed recipient, although execution fees can still apply.' },
    @{ scene = 'Permission revoked'; text = 'The owner can revoke future spending. A later request is rejected even when budget remains.' },
    @{ scene = 'Permission revoked'; text = 'Revocation does not cancel a transfer that has already been dispatched.' },
    @{ scene = 'English implementation disclosure'; text = 'NEAR function call keys restrict the executor to one vault method.' },
    @{ scene = 'English implementation disclosure'; text = 'The contract reserves funds before dispatch, and finalizes accounting through private callbacks.' },
    @{ scene = 'README and evidence'; text = 'The repository includes public payment proofs and separate local sandbox tests for concurrency and failed callbacks.' },
    @{ scene = 'Closing overview'; text = 'This prototype uses controlled payment requests. Optional Gemini explanations cannot sign or bypass the contract.' },
    @{ scene = 'Closing overview'; text = 'Reproduce REDLINE from the public repository, or inspect the recorded evidence without connecting a wallet.' }
)
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $speaker.SelectVoice($Voice)
    $speaker.Rate = 0
    $speaker.Volume = 100
    $segments = @()
    for ($index = 0; $index -lt $lines.Count; $index++) {
        $file = '{0:D2}.wav' -f ($index + 1)
        $speaker.SetOutputToWaveFile((Join-Path $outputRoot $file))
        $speaker.Speak($lines[$index].text)
        $speaker.SetOutputToNull()
        $segments += @{ file = $file; text = $lines[$index].text; scene = $lines[$index].scene }
    }
    @{ voice = $Voice; synthetic = $true; language = 'en-US'; segments = $segments } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputRoot 'segments.json') -Encoding UTF8
} finally { $speaker.Dispose() }
& python (Join-Path $PSScriptRoot 'assemble-near-demo-narration.py') $outputRoot
if ($LASTEXITCODE -ne 0) { throw 'Narration assembly failed' }
Write-Output 'Offline synthetic narration only. No screen recording or MP4 was generated.'
