"""Read-only consistency check of saved public RPC data; not a light-client proof."""
import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "docs/evidence"
OWNER = "nhat-redline-owner.testnet"
VAULT = "nhat-redline-vault.testnet"


def result(name):
    data = json.loads((EVIDENCE / f"phase3-api-{name}.json").read_text(encoding="utf-8-sig"))
    assert "error" not in data, name
    return data["result"]


def view(name):
    return json.loads(bytes(result(name)["result"]))


def verify():
    prepared = json.loads((EVIDENCE / "phase3-api-demo-prepared.json").read_text(encoding="utf-8-sig"))
    args = {"grant_id": prepared["grantId"], "policy": prepared["policy"]}
    hashes = {}
    for name, method, expected_args, deposit in [
        ("owner-deposit", "deposit", {}, str(10**23)),
        ("grant-created", "create_grant", args, "0"),
    ]:
        data = result(name)
        assert data["final_execution_status"] == "FINAL"
        assert "SuccessValue" in data["status"]
        tx = data["transaction"]
        assert tx["signer_id"] == OWNER and tx["receiver_id"] == VAULT
        assert len(tx["actions"]) == 1
        call = tx["actions"][0]["FunctionCall"]
        assert call["method_name"] == method and call["deposit"] == deposit
        assert json.loads(base64.b64decode(call["args"])) == expected_args
        for outcome in [data["transaction_outcome"], *data["receipts_outcome"]]:
            assert "Failure" not in outcome["outcome"]["status"]
        hashes[name] = tx["hash"]
    assert hashes == {
        "owner-deposit": "EwAtGZnEMncRqcgFH6PznBiMiVr8opi8wZRjjfzHL5hR",
        "grant-created": "7ELKNpW6W67jpy2FUpzPvUTmkmVfsh1JejzTonVHdMXt",
    }
    grant = view("grant-before-transfer")
    assert grant["owner"] == OWNER and grant["policy"] == args["policy"]
    assert grant["active"] is True and grant["next_nonce"] == "0"
    assert grant["finalized_spent"] == grant["pending_reserved"] == "0"
    assert grant["finalized_transactions"] == grant["pending_transactions"] == 0
    ledger = view("owner-before-transfer")
    assert ledger["credited"] == str(6 * 10**23)
    assert ledger["finalized_spent"] == str(5 * 10**22)
    assert ledger["completed_withdrawals"] == str(45 * 10**22)
    assert ledger["pending_reserved"] == ledger["pending_withdrawals"] == "0"
    available = int(ledger["credited"]) - int(ledger["finalized_spent"]) - int(ledger["completed_withdrawals"])
    assert available == 10**23
    assert result("payee-before-transfer")["amount"] == str(1005 * 10**22)
    report = {"status": "PASS", "scope": "Two FINAL owner transactions and pre-transfer snapshots only; API executor transfer NOT RUN",
              "hashes": hashes, "grantId": args["grant_id"], "availableYocto": str(available),
              "payeeBaselineYocto": result("payee-before-transfer")["amount"],
              "evidenceSha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(EVIDENCE.glob("phase3-api-*.json")) if p.name != "phase3-api-preflight-verification.json"}}
    (EVIDENCE / "phase3-api-preflight-verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    verify()
