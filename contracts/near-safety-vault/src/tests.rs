#![allow(deprecated)] // Explicit mock Promise results; sandbox tests exercise actual receipts.
use super::*;
use near_sdk::test_utils::{
    get_created_receipts, get_logs, testing_env_with_promise_results, VMContextBuilder,
};
use near_sdk::testing_env;
use near_sdk::PromiseResult;

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
fn account(s: &str) -> AccountId {
    s.parse().unwrap()
}
fn context(caller: &str, signer: &str, deposit: u128, now: u64) -> VMContextBuilder {
    let mut c = VMContextBuilder::new();
    c.current_account_id(account("vault.testnet"))
        .predecessor_account_id(account(caller))
        .signer_account_id(account(signer))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(100))
        .block_timestamp(now)
        .storage_usage(env::storage_usage())
        .prepaid_gas(Gas::from_tgas(300));
    c
}
fn caller(name: &str, deposit: u128, now: u64) {
    testing_env!(context(name, name, deposit, now).build());
}
fn policy() -> Policy {
    Policy {
        executor: account("agent.testnet"),
        policy_hash: "a".repeat(64),
        spend_cap: U128(5 * NEAR),
        max_transactions: 5,
        recipients: vec![account("payee.testnet")],
        expires_at_ns: U64(100_000),
        cooldown_ns: U64(0),
    }
}
fn setup() -> Vault {
    caller("owner.testnet", NEAR, 100);
    let mut vault = Vault::new();
    vault.storage_deposit();
    caller("agent.testnet", NEAR, 100);
    vault.storage_deposit();
    caller("owner.testnet", 10 * NEAR, 100);
    vault.deposit();
    caller("owner.testnet", 0, 100);
    vault.create_grant("grant1".into(), policy());
    vault
}
fn execute(v: &mut Vault, id: &str, nonce: u64, amount: u128) -> PromiseOrValue<Intent> {
    v.execute_transfer(
        "grant1".into(),
        id.into(),
        U64(nonce),
        "NEAR".into(),
        account("payee.testnet"),
        U128(amount),
        "a".repeat(64),
    )
}
fn rejected(value: PromiseOrValue<Intent>, reason: Reason) {
    match value {
        PromiseOrValue::Value(intent) => {
            assert_eq!(intent.status, Status::Rejected);
            assert_eq!(intent.reason, reason);
        }
        _ => panic!("queued a forbidden transfer"),
    }
}
#[allow(deprecated)]
fn callback(v: &mut Vault, id: &str, success: bool) -> Intent {
    let ctx = context("vault.testnet", "agent.testnet", 0, 200).build();
    testing_env_with_promise_results(
        ctx,
        if success {
            PromiseResult::Successful(vec![])
        } else {
            PromiseResult::Failed
        },
    );
    v.on_transfer_complete("grant1".into(), id.into())
}

#[test]
fn deposit_grant_and_successful_callback_are_accounted_once() {
    let mut v = setup();
    let initial_storage = v
        .get_owner_balance(account("agent.testnet"))
        .storage_available
        .0;
    caller("agent.testnet", 0, 100);
    assert!(matches!(
        execute(&mut v, "one", 0, NEAR),
        PromiseOrValue::Promise(_)
    ));
    assert!(!get_created_receipts().is_empty());
    let g = v.grant(&"grant1".into());
    assert_eq!(g.pending_reserved.0, NEAR);
    assert_eq!(g.finalized_spent.0, 0);
    assert_eq!(g.pending_transactions, 1);
    assert_eq!(g.next_nonce.0, 1);
    assert_eq!(
        v.get_available_balance(account("owner.testnet")).0,
        9 * NEAR
    );
    assert!(
        v.get_owner_balance(account("agent.testnet"))
            .storage_available
            .0
            < initial_storage
    );
    assert_eq!(callback(&mut v, "one", true).status, Status::Settled);
    let storage = env::storage_usage();
    assert_eq!(callback(&mut v, "one", true).status, Status::Settled);
    assert_eq!(env::storage_usage(), storage);
    let g = v.grant(&"grant1".into());
    assert_eq!(g.finalized_spent.0, NEAR);
    assert_eq!(g.pending_reserved.0, 0);
    assert_eq!(g.finalized_transactions, 1);
    assert_eq!(g.pending_transactions, 0);
    assert_eq!(
        v.get_available_balance(account("owner.testnet")).0,
        9 * NEAR
    );
    assert!(get_logs().is_empty()); // duplicate callback emits no second settlement
}

#[test]
fn failed_callback_releases_once_without_reusing_nonce_or_id() {
    let mut v = setup();
    caller("agent.testnet", 0, 100);
    drop(execute(&mut v, "one", 0, NEAR));
    assert_eq!(callback(&mut v, "one", false).status, Status::Failed);
    assert_eq!(callback(&mut v, "one", false).status, Status::Failed);
    let g = v.grant(&"grant1".into());
    assert_eq!(g.pending_transactions, 0);
    assert_eq!(g.finalized_transactions, 0);
    assert_eq!(g.pending_reserved.0, 0);
    assert_eq!(g.next_nonce.0, 1);
    assert_eq!(
        v.get_available_balance(account("owner.testnet")).0,
        10 * NEAR
    );
    caller("agent.testnet", 0, 300);
    rejected(execute(&mut v, "one", 1, NEAR), Reason::NonceReplay);
    assert!(get_created_receipts().is_empty());
    assert_eq!(
        v.get_intent("grant1".into(), "one".into()).unwrap().status,
        Status::Failed
    );
}

#[test]
fn replay_while_pending_and_after_settlement_does_not_queue_again() {
    let mut v = setup();
    caller("agent.testnet", 0, 100);
    drop(execute(&mut v, "one", 0, NEAR));
    caller("agent.testnet", 0, 101);
    rejected(execute(&mut v, "one", 1, NEAR), Reason::NonceReplay);
    rejected(execute(&mut v, "other", 0, NEAR), Reason::NonceReplay);
    assert!(get_created_receipts().is_empty());
    assert_eq!(callback(&mut v, "one", true).status, Status::Settled);
    caller("agent.testnet", 0, 300);
    rejected(execute(&mut v, "one", 1, NEAR), Reason::NonceReplay);
    assert!(get_created_receipts().is_empty());
}

#[test]
fn overlapping_requests_cannot_exceed_spend_or_transaction_caps() {
    let mut v = setup();
    caller("agent.testnet", 0, 100);
    drop(execute(&mut v, "one", 0, 4 * NEAR));
    caller("agent.testnet", 0, 101);
    rejected(
        execute(&mut v, "two", 1, 2 * NEAR),
        Reason::SpendCapExceeded,
    );
    assert!(get_created_receipts().is_empty());
    let g = v.grant(&"grant1".into());
    assert_eq!(g.pending_reserved.0, 4 * NEAR);
    caller("owner.testnet", 0, 102);
    let mut p = policy();
    p.max_transactions = 1;
    v.create_grant("single".into(), p);
    caller("agent.testnet", 0, 103);
    drop(v.execute_transfer(
        "single".into(),
        "one".into(),
        U64(0),
        "NEAR".into(),
        account("payee.testnet"),
        U128(NEAR),
        "a".repeat(64),
    ));
    caller("agent.testnet", 0, 104);
    rejected(
        v.execute_transfer(
            "single".into(),
            "two".into(),
            U64(1),
            "NEAR".into(),
            account("payee.testnet"),
            U128(NEAR),
            "a".repeat(64),
        ),
        Reason::TxCapExceeded,
    );
    assert!(get_created_receipts().is_empty());
}

#[test]
fn rejected_intent_is_persisted_without_money_or_nonce_changes() {
    let mut v = setup();
    let owner_storage = v.balance(&account("owner.testnet")).storage_available;
    let executor_storage = v.balance(&account("agent.testnet")).storage_available;
    caller("agent.testnet", 0, 100);
    rejected(
        v.execute_transfer(
            "grant1".into(),
            "bad".into(),
            U64(0),
            "NEAR".into(),
            account("attacker.testnet"),
            U128(NEAR),
            "a".repeat(64),
        ),
        Reason::DestinationNotAllowed,
    );
    assert!(get_created_receipts().is_empty());
    assert_eq!(
        v.get_intent("grant1".into(), "bad".into()).unwrap().status,
        Status::Rejected
    );
    assert_eq!(v.grant(&"grant1".into()).next_nonce.0, 0);
    assert_eq!(
        v.get_available_balance(account("owner.testnet")).0,
        10 * NEAR
    );
    assert!(get_logs().iter().any(|s| s.contains("intent_rejected")));
    assert_eq!(
        v.balance(&account("owner.testnet")).storage_available,
        owner_storage
    );
    assert!(v.balance(&account("agent.testnet")).storage_available.0 < executor_storage.0);
}

#[test]
fn revoke_does_not_cancel_pending_settlement() {
    let mut v = setup();
    caller("agent.testnet", 0, 100);
    drop(execute(&mut v, "one", 0, NEAR));
    caller("owner.testnet", 0, 101);
    v.revoke_grant("grant1".into());
    caller("agent.testnet", 0, 102);
    rejected(execute(&mut v, "two", 1, NEAR), Reason::Revoked);
    assert_eq!(callback(&mut v, "one", true).status, Status::Settled);
    assert!(!v.grant(&"grant1".into()).active);
}

#[test]
#[allow(deprecated)]
fn withdraw_pending_is_reserved_separately_and_callback_idempotent() {
    let mut v = setup();
    caller("agent.testnet", 0, 100);
    drop(execute(&mut v, "one", 0, 4 * NEAR));
    caller("owner.testnet", 0, 101);
    drop(v.withdraw("out".into(), U128(6 * NEAR)));
    assert_eq!(v.get_available_balance(account("owner.testnet")).0, 0);
    callback(&mut v, "one", true);
    let ctx = context("vault.testnet", "owner.testnet", 0, 200).build();
    testing_env_with_promise_results(ctx, PromiseResult::Successful(vec![]));
    assert_eq!(
        v.on_withdraw_complete(account("owner.testnet"), "out".into())
            .status,
        Status::Settled
    );
    assert_eq!(
        v.on_withdraw_complete(account("owner.testnet"), "out".into())
            .status,
        Status::Settled
    );
    let b = v.get_owner_balance(account("owner.testnet"));
    assert_eq!(b.completed_withdrawals.0, 6 * NEAR);
    assert_eq!(b.pending_withdrawals.0, 0);
    assert_eq!(b.available(), 0);
}

#[test]
#[allow(deprecated)]
fn failed_withdrawal_restores_available_once() {
    let mut v = setup();
    caller("owner.testnet", 0, 100);
    drop(v.withdraw("out".into(), U128(NEAR)));
    let ctx = context("vault.testnet", "owner.testnet", 0, 200).build();
    testing_env_with_promise_results(ctx, PromiseResult::Failed);
    assert_eq!(
        v.on_withdraw_complete(account("owner.testnet"), "out".into())
            .status,
        Status::Failed
    );
    v.on_withdraw_complete(account("owner.testnet"), "out".into());
    assert_eq!(
        v.get_available_balance(account("owner.testnet")).0,
        10 * NEAR
    );
}

#[test]
fn all_seven_gates_and_extra_checks() {
    let v = setup();
    let g = v.grant(&"grant1".into());
    let b = v.balance(&account("owner.testnet"));
    let check = |g: &Grant,
                 b: &Balance,
                 n: u64,
                 asset: &str,
                 recipient: &str,
                 amount: u128,
                 hash: &str,
                 duplicate: bool,
                 now: u64| {
        evaluate(
            g,
            b,
            U64(n),
            asset,
            &account(recipient),
            U128(amount),
            hash,
            duplicate,
            now,
        )
    };
    let ok = |g: &Grant| {
        check(
            g,
            &b,
            0,
            "NEAR",
            "payee.testnet",
            NEAR,
            &"a".repeat(64),
            false,
            100,
        )
    };
    assert_eq!(ok(&g), Reason::Ok);
    let mut x = g.clone();
    x.active = false;
    assert_eq!(ok(&x), Reason::Revoked);
    let mut x = g.clone();
    x.policy.expires_at_ns = U64(100);
    assert_eq!(ok(&x), Reason::Expired);
    let mut x = g.clone();
    x.next_nonce = U64(1);
    assert_eq!(ok(&x), Reason::NonceReplay);
    assert_eq!(
        check(
            &g,
            &b,
            0,
            "FT",
            "payee.testnet",
            NEAR,
            &"a".repeat(64),
            false,
            100
        ),
        Reason::AssetNotAllowed
    );
    assert_eq!(
        check(
            &g,
            &b,
            0,
            "NEAR",
            "other.testnet",
            NEAR,
            &"a".repeat(64),
            false,
            100
        ),
        Reason::DestinationNotAllowed
    );
    let mut x = g.clone();
    x.pending_transactions = 5;
    assert_eq!(ok(&x), Reason::TxCapExceeded);
    let mut x = g.clone();
    x.pending_reserved = U128(5 * NEAR);
    assert_eq!(ok(&x), Reason::SpendCapExceeded);
    let mut x = g.clone();
    x.has_reserved = true;
    x.last_reserved_ns = U64(100);
    x.policy.cooldown_ns = U64(1);
    assert_eq!(ok(&x), Reason::CooldownActive);
    assert_eq!(
        check(
            &x,
            &b,
            0,
            "NEAR",
            "payee.testnet",
            NEAR,
            &"a".repeat(64),
            false,
            101
        ),
        Reason::Ok
    );
    assert_eq!(
        check(
            &g,
            &b,
            0,
            "NEAR",
            "payee.testnet",
            NEAR,
            &"b".repeat(64),
            false,
            100
        ),
        Reason::PolicyHashMismatch
    );
    assert_eq!(
        check(
            &g,
            &b,
            0,
            "NEAR",
            "payee.testnet",
            0,
            &"a".repeat(64),
            false,
            100
        ),
        Reason::InvalidAmount
    );
    assert_eq!(
        check(
            &g,
            &Balance::default(),
            0,
            "NEAR",
            "payee.testnet",
            NEAR,
            &"a".repeat(64),
            false,
            100
        ),
        Reason::InsufficientBalance
    );
    let mut x = g.clone();
    x.finalized_spent = U128(u128::MAX);
    x.pending_reserved = U128(1);
    assert_eq!(ok(&x), Reason::SpendCapExceeded);
}

#[test]
fn second_owner_cannot_borrow_first_owners_balance() {
    let mut v = setup();
    caller("second.testnet", NEAR, 100);
    v.storage_deposit();
    caller("second.testnet", 0, 101);
    v.create_grant("second".into(), policy());
    caller("agent.testnet", 0, 102);
    rejected(
        v.execute_transfer(
            "second".into(),
            "one".into(),
            U64(0),
            "NEAR".into(),
            account("payee.testnet"),
            U128(NEAR),
            "a".repeat(64),
        ),
        Reason::InsufficientBalance,
    );
    assert_eq!(
        v.get_available_balance(account("owner.testnet")).0,
        10 * NEAR
    );
}

#[test]
#[should_panic(expected = "EXECUTOR_ONLY")]
fn signer_spoofing_via_intermediary_is_rejected() {
    let mut v = setup();
    testing_env!(context("attacker.testnet", "agent.testnet", 0, 100).build());
    drop(execute(&mut v, "one", 0, NEAR));
}
#[test]
#[should_panic(expected = "OWNER_ONLY")]
fn foreign_owner_cannot_revoke() {
    let mut v = setup();
    caller("stranger.testnet", 0, 100);
    v.revoke_grant("grant1".into());
}
#[test]
#[should_panic(expected = "PRIVATE_CALLBACK")]
fn external_callback_cannot_settle() {
    let mut v = setup();
    caller("agent.testnet", 0, 100);
    drop(execute(&mut v, "one", 0, NEAR));
    v.on_transfer_complete("grant1".into(), "one".into());
}
#[test]
#[should_panic(expected = "INVALID_PROMISE_COUNT")]
fn callback_without_receipt_cannot_settle() {
    let mut v = setup();
    caller("agent.testnet", 0, 100);
    drop(execute(&mut v, "one", 0, NEAR));
    caller("vault.testnet", 0, 101);
    v.on_transfer_complete("grant1".into(), "one".into());
}

#[test]
#[should_panic(expected = "UNEXPECTED_TRANSFER_RESULT")]
fn unexpected_callback_payload_must_not_release_funds() {
    let mut v = setup();
    caller("agent.testnet", 0, 100);
    drop(execute(&mut v, "one", 0, NEAR));
    let ctx = context("vault.testnet", "agent.testnet", 0, 200).build();
    testing_env_with_promise_results(ctx, PromiseResult::Successful(vec![1]));
    v.on_transfer_complete("grant1".into(), "one".into());
}
#[test]
#[should_panic(expected = "INSUFFICIENT_AVAILABLE")]
fn withdraw_cannot_spend_transfer_reservation() {
    let mut v = setup();
    caller("agent.testnet", 0, 100);
    drop(execute(&mut v, "one", 0, 4 * NEAR));
    caller("owner.testnet", 0, 101);
    drop(v.withdraw("out".into(), U128(7 * NEAR)));
}
#[test]
#[should_panic(expected = "INSUFFICIENT_STORAGE_ALLOWANCE")]
fn storage_is_not_subsidized_by_other_owners_principal() {
    setup();
    caller("second.testnet", 1, 100);
    let mut v = Vault::new();
    v.storage_deposit();
}
#[test]
#[should_panic(expected = "INSUFFICIENT_GAS")]
fn low_gas_cannot_queue_money() {
    let mut v = setup();
    let mut ctx = context("agent.testnet", "agent.testnet", 0, 100);
    ctx.prepaid_gas(Gas::from_tgas(30));
    testing_env!(ctx.build());
    drop(execute(&mut v, "one", 0, NEAR));
}
#[test]
#[should_panic(expected = "INSUFFICIENT_CONTRACT_RESERVE")]
fn liquid_storage_and_operating_reserve_are_protected() {
    let mut v = setup();
    let mut ctx = context("agent.testnet", "agent.testnet", 0, 100);
    ctx.account_balance(NearToken::from_yoctonear(NEAR));
    testing_env!(ctx.build());
    drop(execute(&mut v, "one", 0, NEAR));
}
#[test]
#[should_panic(expected = "OVERFLOW")]
fn ledger_credit_overflow_fails_closed() {
    add(u128::MAX, 1);
}

#[test]
fn large_amounts_and_nanoseconds_are_json_strings() {
    let p = policy();
    let json = near_sdk::serde_json::to_value(p).unwrap();
    assert_eq!(json["spend_cap"], (5 * NEAR).to_string());
    assert_eq!(json["expires_at_ns"], "100000");
}
