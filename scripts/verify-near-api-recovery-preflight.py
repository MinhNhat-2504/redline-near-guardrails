"""Offline consistency checks on real collected public RPC; never signs/submits.

Not a cryptographic light-client proof. Re-query RPC for freshness/provenance.
"""
import base64
import hashlib
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent.parent / "docs/evidence"
OWNER, VAULT = "nhat-redline-owner.testnet", "nhat-redline-vault.testnet"
AGENT, PAYEE = "nhat-redline-agent.testnet", "nhat-redline-payee.testnet"
TX = "B9HT5FBGAQdp5xnfS4TsfntJA5B5C2PkwsaERP3vTgG1"


def read(name):
    return json.loads((EVIDENCE / name).read_text(encoding="utf-8-sig"))


def result(name):
    data = read(f"phase3-api-recovery-{name}.json")
    assert "error" not in data, name
    return data["result"]


def view(name):
    return json.loads(bytes(result(name)["result"]))


def verify():
    prepared = read("phase3-api-recovery-prepared.json")
    args = {"grant_id": prepared["grantId"], "policy": prepared["policy"]}
    assert args["policy"]["spend_cap"] == str(5 * 10**22)
    assert args["policy"]["max_transactions"] == 3
    assert args["policy"]["recipients"] == [PAYEE] and args["policy"]["executor"] == AGENT
    assert args["policy"]["cooldown_ns"] == "0" and prepared["plannedTopupYocto"] == "0"
    canonical_bytes = (EVIDENCE / "phase3-api-recovery-policy-canonical.json").read_bytes()
    assert hashlib.sha256(canonical_bytes).hexdigest() == args["policy"]["policy_hash"]
    canonical = json.loads(canonical_bytes)
    for field, expected in {"schema": "redline.near.policy.v1", "network": "testnet", "contract_id": VAULT, "owner_id": OWNER, "grant_id": args["grant_id"]}.items():
        assert canonical[field] == expected, field
    for field, value in args["policy"].items():
        if field != "policy_hash":
            assert canonical[field] == value, field
    tx = result("grant-created")
    assert tx["final_execution_status"] == "FINAL" and "SuccessValue" in tx["status"]
    assert tx["transaction"]["hash"] == TX
    assert tx["transaction"]["signer_id"] == OWNER and tx["transaction"]["receiver_id"] == VAULT
    assert len(tx["transaction"]["actions"]) == 1
    call = tx["transaction"]["actions"][0]["FunctionCall"]
    assert call["method_name"] == "create_grant" and call["deposit"] == "0"
    assert json.loads(base64.b64decode(call["args"])) == args
    for outcome in [tx["transaction_outcome"], *tx["receipts_outcome"]]:
        assert set(outcome["outcome"]["status"]).issubset({"SuccessValue", "SuccessReceiptId"})
        assert len(outcome["outcome"]["status"]) == 1
    grant = view("grant-before-transfer")
    assert grant["owner"] == OWNER and grant["policy"] == args["policy"]
    assert grant["active"] is True and grant["next_nonce"] == "0"
    assert grant["finalized_spent"] == grant["pending_reserved"] == "0"
    assert grant["finalized_transactions"] == grant["pending_transactions"] == 0
    emitted = []
    for receipt in tx["receipts_outcome"]:
        if receipt["outcome"]["executor_id"] != VAULT:
            continue
        for log in receipt["outcome"]["logs"]:
            if log.startswith("EVENT_JSON:"):
                event = json.loads(log.removeprefix("EVENT_JSON:"))
                if event.get("standard") == "redline" and event.get("event") == "grant_created":
                    emitted.extend(event["data"])
    assert emitted == [{"grant_id": args["grant_id"], "grant": grant}]
    baseline_height = result("grant-before-transfer")["block_height"]
    for name in ["owner-before-transfer", "executor-before-transfer", "payee-before-transfer"]:
        assert result(name)["block_height"] >= baseline_height
    ledger = view("owner-before-transfer")
    assert ledger["credited"] == str(6 * 10**23) and ledger["finalized_spent"] == str(5 * 10**22)
    assert ledger["completed_withdrawals"] == str(45 * 10**22)
    assert ledger["pending_reserved"] == ledger["pending_withdrawals"] == "0"
    available = int(ledger["credited"]) - int(ledger["finalized_spent"]) - int(ledger["completed_withdrawals"])
    assert available == 10**23
    payee = result("payee-before-transfer")["amount"]
    assert payee == str(1005 * 10**22)
    access = result("executor-before-transfer")
    assert access["permission"] == {"FunctionCall": {"receiver_id": VAULT, "method_names": ["execute_transfer"], "allowance": str(10**23)}}
    journal = read("phase3-executor-journal-recovery.json")
    assert journal["status"] == "INVALIDATED_BY_FINAL_KEY_RESET" and journal["disposition"]["state"] == "INVALIDATED"
    assert prepared["recoveryOf"]["transactionHash"] == journal["originalTransactionHash"]
    assert prepared["recoveryOf"]["resetTransactionHash"] == journal["resetTransactionHash"]
    assert int(access["nonce"]) == int(journal["disposition"]["keyResetProof"]["finalizedKeyNonce"])
    expiry = datetime.fromtimestamp(int(args["policy"]["expires_at_ns"]) / 10**9, timezone(timedelta(hours=7)))
    report = {"status": "PASS_RECOVERY_GRANT_PREFLIGHT", "transactionHash": TX, "grantId": args["grant_id"],
              "availableYocto": str(available), "payeeBaselineYocto": payee, "executorKeyNonce": str(access["nonce"]),
              "policyHash": args["policy"]["policy_hash"], "expiresAtUtcPlus7": expiry.isoformat(),
              "scope": "FINAL owner grant, canonical policy, grant/ledger/key/payee snapshots; recovered API transfer NOT RUN"}
    (EVIDENCE / "phase3-api-recovery-preflight-verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    verify()
