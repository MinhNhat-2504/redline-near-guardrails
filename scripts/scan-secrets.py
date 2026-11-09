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
    "google-api-key": rb"\bAIza[0-9A-Za-z_-]{35}\b",
    "openai-api-key": rb"\bsk-[A-Za-z0-9_-]{40,}",
    "aws-access-key": rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
    "near-secret-key": rb'"private_key"\s*:\s*"ed25519:[1-9A-HJ-NP-Za-km-z]{80,}"',
    "solana-keypair-array": rb"\[(?:\s*\d{1,3}\s*,){63}\s*\d{1,3}\s*\]",
}
findings = []
reviewed_fixtures = []
blobs = 0
entries = git("rev-list", "--objects", "--all").decode().splitlines()
for staged in git("ls-files", "--stage").decode().splitlines():
    metadata, path = staged.split("\t", 1)
    entries.append(metadata.split()[1] + " " + path)
seen = set()
unique = []
for entry in entries:
    oid, _, path = entry.partition(" ")
    if oid not in seen:
        seen.add(oid)
        unique.append((oid, path))
# Batch object reads avoid spawning two Git processes for each historical blob.
reader = subprocess.Popen(["git", "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
for oid, path in unique:
    reader.stdin.write((oid + "\n").encode())
    reader.stdin.flush()
    header = reader.stdout.readline().decode().split()
    if len(header) != 3:
        raise RuntimeError("Git object unavailable; scan incomplete")
    size = int(header[2])
    data = reader.stdout.read(size)
    if len(data) != size or reader.stdout.read(1) != b"\n":
        raise RuntimeError("Truncated Git object; scan incomplete")
    if header[1] != "blob":
        continue
    blobs += 1
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
reader.stdin.close()
reader.stdout.close()
if reader.wait() != 0:
    raise RuntimeError("Git batch reader failed; scan incomplete")
print(json.dumps({"scope": "all reachable Git blobs plus staged index", "blobs_scanned": blobs, "findings": findings,
                  "reviewed_fixtures": reviewed_fixtures,
                  "limitation": "Pattern scan only; includes reachable history and index, not unstaged/untracked content, entropy detection or live credential validation. No matched values are printed."}, indent=2))
raise SystemExit(bool(findings))
