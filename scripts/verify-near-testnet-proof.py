"""Verify saved public RPC proof offline. Never signs or submits transactions.

This checks consistency of collected RPC data, not a cryptographic light-client
proof. Re-query the public RPC to independently establish freshness/provenance.
"""
import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "docs/evidence"
OWNER = "nhat-redline-owner.testnet"
AGENT = "nhat-redline-agent.testnet"
VAULT = "nhat-redline-vault.testnet"
PAYEE = "nhat-redline-payee.testnet"


def result(name):
    response = json.loads((EVIDENCE / f"phase2-{name}.json").read_text(encoding="utf-8-sig"))
    assert "error" not in response, name
    return response["result"]


def view(name):
    return json.loads(bytes(result(name)["result"]))


def args_file(name):
    return json.loads((EVIDENCE / name).read_text(encoding="utf-8-sig"))


def transaction(name, signer, method, expected_args, deposit="0"):
    response = result(name)
    tx = response["transaction"]
    assert response["final_execution_status"] == "FINAL", name
    assert "SuccessValue" in response["status"], name
    assert tx["signer_id"] == signer and tx["receiver_id"] == VAULT, name
    assert len(tx["actions"]) == 1, name
    call = tx["actions"][0]["FunctionCall"]
    assert call["method_name"] == method and call["deposit"] == deposit, name
    assert json.loads(base64.b64decode(call["args"])) == expected_args, name
    receipts = response["receipts_outcome"]
    assert receipts and all("Failure" not in r["outcome"]["status"] for r in receipts), name
    events = []
    for receipt in receipts:
        for log in receipt["outcome"]["logs"]:
            if log.startswith("EVENT_JSON:"):
                assert receipt["outcome"]["executor_id"] == VAULT, name
                event = json.loads(log[len("EVENT_JSON:"):])
                assert event["standard"] == "redline" and event["version"] == "1.0.0", name
                events.append(event)
    value = base64.b64decode(response["status"]["SuccessValue"])
    return response, json.loads(value) if value else None, events


def main():
    canonical = (EVIDENCE / "phase2-signed-grant-canonical.json").read_bytes()
    policy = json.loads(canonical)
    assert policy["network"] == "testnet" and policy["contract_id"] == VAULT
    assert policy["owner_id"] == OWNER and policy["executor"] == AGENT
    grant = view("final-grant")
    assert hashlib.sha256(canonical).hexdigest() == grant["policy"]["policy_hash"]
    assert grant["policy"] == view("grant-onchain")["policy"]
    assert grant["owner"] == OWNER and grant["active"] is False

    hashes = []
    for name, signer, method, deposit in [
        ("owner-storage", OWNER, "storage_deposit", "50000000000000000000000"),
        ("agent-storage", AGENT, "storage_deposit", "50000000000000000000000"),
        ("owner-deposit", OWNER, "deposit", "500000000000000000000000"),
    ]:
        tx, _, _ = transaction(name, signer, method, {}, deposit)
        hashes.append(tx["transaction"]["hash"])

    initial = view("grant-onchain")
    tx, _, events = transaction("grant-created", OWNER, "create_grant", {
        "grant_id": policy["grant_id"], "policy": initial["policy"],
    })
    assert any(e["event"] == "grant_created" for e in events)
    hashes.append(tx["transaction"]["hash"])

    for name, filename, intent_view, status, reason, event_name in [
        ("safe-transfer", "phase2-safe-transfer-args.json", "safe-intent", "SETTLED", "OK", "intent_completed"),
        ("cap-denial", "phase2-transfer-deny-cap.json", "cap-denied-intent", "REJECTED", "SPEND_CAP_EXCEEDED", "intent_rejected"),
        ("recipient-denial", "phase2-transfer-deny-recipient.json", "recipient-denied-intent", "REJECTED", "DESTINATION_NOT_ALLOWED", "intent_rejected"),
        ("post-revoke-denial", "phase2-post-revoke-args.json", "post-revoke-intent", "REJECTED", "REVOKED", "intent_rejected"),
    ]:
        args = args_file(filename)
        assert args["grant_id"] == policy["grant_id"]
        tx, value, events = transaction(name, AGENT, "execute_transfer", args)
        assert value == view(intent_view)
        assert value["status"] == status and value["reason"] == reason
        for key in ("amount", "recipient", "nonce"):
            assert value[key] == args[key]
        assert any(e["event"] == event_name and any(
            d.get("intent_id") == args["intent_id"] and d.get("intent") == value
            for d in e["data"]
        ) for e in events)
        if status == "REJECTED":
            assert not any(r["outcome"]["executor_id"] == args["recipient"] for r in tx["receipts_outcome"])
        else:
            assert any(r["outcome"]["executor_id"] == PAYEE and r["outcome"]["status"] == {"SuccessValue": ""} for r in tx["receipts_outcome"])
        hashes.append(tx["transaction"]["hash"])

    tx, _, events = transaction("revoke", OWNER, "revoke_grant", {"grant_id": policy["grant_id"]})
    assert any(e["event"] == "grant_revoked" and e["data"] == [{"grant_id": policy["grant_id"]}] for e in events)
    hashes.append(tx["transaction"]["hash"])

    withdraw_args = args_file("phase2-withdraw-args.json")
    tx, value, events = transaction("withdraw", OWNER, "withdraw", withdraw_args)
    assert value == view("final-withdrawal") == {"amount": "450000000000000000000000", "status": "SETTLED"}
    assert any(r["outcome"]["executor_id"] == OWNER and r["outcome"]["status"] == {"SuccessValue": ""} for r in tx["receipts_outcome"])
    assert any(e["event"] == "withdrawal_completed" and any(
        d.get("owner") == OWNER and d.get("withdrawal_id") == withdraw_args["withdrawal_id"] and d.get("withdrawal") == value
        for d in e["data"]
    ) for e in events)
    hashes.append(tx["transaction"]["hash"])
    assert len(set(hashes)) == len(hashes) == 10

    owner = view("final-owner")
    assert owner["credited"] == "500000000000000000000000"
    assert owner["finalized_spent"] == grant["finalized_spent"] == "50000000000000000000000"
    assert owner["completed_withdrawals"] == withdraw_args["amount"] == "450000000000000000000000"
    assert owner["pending_reserved"] == grant["pending_reserved"] == owner["pending_withdrawals"] == "0"
    assert grant["finalized_transactions"] == 1 and grant["pending_transactions"] == 0 and grant["next_nonce"] == "1"
    assert view("final-available") == "0"
    assert int(owner["credited"]) == int(owner["finalized_spent"]) + int(owner["completed_withdrawals"])
    assert int(result("final-payee")["amount"]) - int(result("payee-before-transfer")["amount"]) == int(owner["finalized_spent"])
    print(json.dumps({
        "result": "PASS", "scope": "saved finalized public Testnet RPC evidence",
        "transactions_checked": len(hashes), "transaction_hashes": hashes,
        "grant_active": False, "withdrawal_status": "SETTLED",
        "principal_yoctoNEAR": {"credited": owner["credited"], "spent": owner["finalized_spent"], "withdrawn": owner["completed_withdrawals"], "available": "0", "pending": "0"},
        "limitations": "RPC response consistency checks, not cryptographic light-client verification or a professional audit; frontend/API NEAR E2E remains pending.",
    }, indent=2))


if __name__ == "__main__":
    main()
