"""Conservative pattern scan of every reachable Git blob; never print matched values.

This is a scoped check, not a guarantee that history contains no secrets.
"""
import json
import re
import subprocess


def git(*args):
    return subprocess.check_output(["git", *args])


patterns = {
    "private-key-pem": rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "github-token": rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})",
    "provider-token": rb"\b(?:sk-proj-|gsk_)[A-Za-z0-9_-]{30,}",
    "aws-access-key": rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
    "near-secret-key": rb'"private_key"\s*:\s*"ed25519:[1-9A-HJ-NP-Za-km-z]{80,}"',
    "solana-keypair-array": rb"\[(?:\s*\d{1,3}\s*,){63}\s*\d{1,3}\s*\]",
}
findings = []
reviewed_fixtures = []
blobs = 0
for entry in git("rev-list", "--objects", "--all").decode().splitlines():
    oid, _, path = entry.partition(" ")
    if git("cat-file", "-t", oid).strip() != b"blob":
        continue
    blobs += 1
    data = git("cat-file", "blob", oid)
    if re.search(r"(^|/)(\.env(?:\..*)?|.*-keypair\.json|owner\.json|executor\.json)$", path) and not path.endswith(".env.example"):
        findings.append({"blob": oid, "path": path, "rule": "sensitive-filename"})
    for rule, pattern in patterns.items():
        if re.search(pattern, data):
            if (oid == "32e53285bd56487657743628b3bd99f6aef43e1c"
                    and path == "backend/test/fixes.test.ts" and rule == "provider-token"):
                reviewed_fixtures.append({"blob": oid, "path": path, "rule": rule,
                                          "reason": "Explicit TESTONLY alphabet fixture at line 113; manually reviewed."})
                continue
            findings.append({"blob": oid, "path": path, "rule": rule})
print(json.dumps({"scope": "all reachable Git blobs", "blobs_scanned": blobs, "findings": findings,
                  "reviewed_fixtures": reviewed_fixtures,
                  "limitation": "Pattern scan only; excludes untracked files, entropy detection and credential validation."}, indent=2))
raise SystemExit(bool(findings))
