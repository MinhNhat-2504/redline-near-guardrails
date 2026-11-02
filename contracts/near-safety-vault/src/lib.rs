//! Native NEAR vault. No owner key, timeout unlock, token or swap support.
#[cfg(all(target_arch = "wasm32", not(near)))]
compile_error!(
    "NEAR WASM requires --cfg near; build from the repository root using .cargo/config.toml"
);

use near_sdk::collections::LookupMap;
use near_sdk::json_types::{U128, U64};
use near_sdk::{
    env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError,
    PromiseOrValue,
};

const CALLBACK_GAS: Gas = Gas::from_tgas(20);
const MIN_CALL_GAS: u64 = 60_000_000_000_000;
const LIQUID_RESERVE: u128 = 100_000_000_000_000_000_000_000; // 0.1 NEAR, operator-funded

#[near(serializers = [borsh, json])]
#[derive(Clone, Default, Debug)]
pub struct Balance {
    pub credited: U128,
    pub finalized_spent: U128,
    pub pending_reserved: U128,
    pub completed_withdrawals: U128,
    pub pending_withdrawals: U128,
    pub storage_available: U128,
}

impl Balance {
    pub fn available(&self) -> u128 {
        self.credited
            .0
            .checked_sub(self.finalized_spent.0)
            .and_then(|v| v.checked_sub(self.pending_reserved.0))
            .and_then(|v| v.checked_sub(self.completed_withdrawals.0))
            .and_then(|v| v.checked_sub(self.pending_withdrawals.0))
            .expect("LEDGER_INVARIANT")
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Policy {
    pub executor: AccountId,
    pub policy_hash: String,
    pub spend_cap: U128,
    pub max_transactions: u32,
    pub recipients: Vec<AccountId>,
    pub expires_at_ns: U64,
    pub cooldown_ns: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Grant {
    pub owner: AccountId,
    pub policy: Policy,
    pub active: bool,
    pub finalized_spent: U128,
    pub pending_reserved: U128,
    pub finalized_transactions: u32,
    pub pending_transactions: u32,
    pub next_nonce: U64,
    // Fixed-size representation: callbacks never grow storage.
    pub has_reserved: bool,
    pub last_reserved_ns: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Status {
    Rejected,
    Pending,
    Settled,
    Failed,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Reason {
    Ok,
    Revoked,
    Expired,
    NonceReplay,
    AssetNotAllowed,
    DestinationNotAllowed,
    TxCapExceeded,
    SpendCapExceeded,
    CooldownActive,
    PolicyHashMismatch,
    InvalidAmount,
    InsufficientBalance,
    TransferFailed,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Intent {
    pub nonce: U64,
    pub recipient: AccountId,
    pub amount: U128,
    pub status: Status,
    pub reason: Reason,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Withdrawal {
    pub amount: U128,
    pub status: Status,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Vault {
    balances: LookupMap<AccountId, Balance>,
    grants: LookupMap<String, Grant>,
    intents: LookupMap<Vec<u8>, Intent>,
    withdrawals: LookupMap<Vec<u8>, Withdrawal>,
}

#[near]
impl Vault {
    #[init]
    pub fn new() -> Self {
        Self {
            balances: LookupMap::new(b"b"),
            grants: LookupMap::new(b"g"),
            intents: LookupMap::new(b"i"),
            withdrawals: LookupMap::new(b"w"),
        }
    }

    /// Separate, non-transferable storage allowance. No storage refunds in MVP.
    #[payable]
    pub fn storage_deposit(&mut self) -> Balance {
        let owner = direct_owner();
        let before = env::storage_usage();
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "INVALID_AMOUNT");
        let mut balance = self.balances.get(&owner).unwrap_or_default();
        balance.storage_available = U128(add(balance.storage_available.0, amount));
        self.balances.insert(&owner, &balance);
        self.charge_storage(&owner, before);
        self.balance(&owner)
    }

    #[payable]
    pub fn deposit(&mut self) -> Balance {
        let owner = direct_owner();
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "INVALID_AMOUNT");
        let mut balance = self.balance(&owner);
        balance.credited = U128(add(balance.credited.0, amount));
        self.balances.insert(&owner, &balance);
        event(
            "deposit",
            near_sdk::serde_json::json!({"owner": owner, "amount": U128(amount)}),
        );
        balance
    }

    pub fn create_grant(&mut self, grant_id: String, policy: Policy) -> Grant {
        valid_id(&grant_id);
        let owner = direct_owner();
        require!(self.grants.get(&grant_id).is_none(), "GRANT_EXISTS");
        require!(
            policy.executor != env::current_account_id(),
            "INVALID_EXECUTOR"
        );
        require!(
            policy.spend_cap.0 > 0 && policy.max_transactions > 0,
            "INVALID_CAP"
        );
        require!(
            policy.expires_at_ns.0 > env::block_timestamp(),
            "INVALID_EXPIRY"
        );
        require!(
            policy.policy_hash.len() == 64
                && policy.policy_hash.bytes().all(|c| c.is_ascii_hexdigit()),
            "INVALID_POLICY_HASH"
        );
        require!(
            !policy.recipients.is_empty() && policy.recipients.len() <= 4,
            "INVALID_ALLOWLIST"
        );
        require!(
            policy
                .recipients
                .iter()
                .all(|id| id != &env::current_account_id()),
            "SELF_RECIPIENT"
        );
        // Funds and storage cannot be borrowed from another owner.
        self.balance(&owner);
        let before = env::storage_usage();
        let grant = Grant {
            owner: owner.clone(),
            policy,
            active: true,
            finalized_spent: U128(0),
            pending_reserved: U128(0),
            finalized_transactions: 0,
            pending_transactions: 0,
            next_nonce: U64(0),
            has_reserved: false,
            last_reserved_ns: U64(0),
        };
        self.grants.insert(&grant_id, &grant);
        self.charge_storage(&owner, before);
        event(
            "grant_created",
            near_sdk::serde_json::json!({"grant_id": grant_id, "grant": grant}),
        );
        grant
    }

    pub fn revoke_grant(&mut self, grant_id: String) {
        let mut grant = self.grant(&grant_id);
        require!(direct_owner() == grant.owner, "OWNER_ONLY");
        grant.active = false;
        self.grants.insert(&grant_id, &grant);
        event(
            "grant_revoked",
            near_sdk::serde_json::json!({"grant_id": grant_id}),
        );
    }

    /// Rejections are successful receipts with persisted REJECTED state/events.
    /// Duplicate IDs never overwrite original evidence.
    #[allow(clippy::too_many_arguments)]
    pub fn execute_transfer(
        &mut self,
        grant_id: String,
        intent_id: String,
        nonce: U64,
        asset: String,
        recipient: AccountId,
        amount: U128,
        policy_hash: String,
    ) -> PromiseOrValue<Intent> {
        valid_id(&intent_id);
        let mut grant = self.grant(&grant_id);
        require!(
            env::predecessor_account_id() == grant.policy.executor,
            "EXECUTOR_ONLY"
        );
        let storage_payer = env::predecessor_account_id();
        let key = record_key(&grant_id, &intent_id);
        let duplicate = self.intents.get(&key).is_some();
        let balance = self.balance(&grant.owner);
        let reason = evaluate(
            &grant,
            &balance,
            nonce,
            &asset,
            &recipient,
            amount,
            &policy_hash,
            duplicate,
            env::block_timestamp(),
        );
        let mut intent = Intent {
            nonce,
            recipient,
            amount,
            status: Status::Rejected,
            reason,
        };
        if duplicate {
            event(
                "intent_rejected",
                near_sdk::serde_json::json!({"grant_id": grant_id, "intent_id": intent_id, "intent": intent, "duplicate": true}),
            );
            return PromiseOrValue::Value(intent);
        }
        let before = env::storage_usage();
        if reason != Reason::Ok {
            self.intents.insert(&key, &intent);
            self.charge_storage(&storage_payer, before);
            event(
                "intent_rejected",
                near_sdk::serde_json::json!({"grant_id": grant_id, "intent_id": intent_id, "intent": intent}),
            );
            return PromiseOrValue::Value(intent);
        }
        enough_gas();
        let mut balance = balance;
        balance.pending_reserved = U128(add(balance.pending_reserved.0, amount.0));
        grant.pending_reserved = U128(add(grant.pending_reserved.0, amount.0));
        grant.pending_transactions = grant.pending_transactions.checked_add(1).expect("OVERFLOW");
        grant.next_nonce = U64(grant.next_nonce.0.checked_add(1).expect("OVERFLOW"));
        grant.last_reserved_ns = U64(env::block_timestamp());
        grant.has_reserved = true;
        intent.status = Status::Pending;
        self.balances.insert(&grant.owner, &balance);
        self.grants.insert(&grant_id, &grant);
        self.intents.insert(&key, &intent);
        self.charge_storage(&storage_payer, before);
        enough_liquid(amount.0);
        event(
            "intent_pending",
            near_sdk::serde_json::json!({"grant_id": grant_id, "intent_id": intent_id, "intent": intent}),
        );
        PromiseOrValue::Promise(
            Promise::new(intent.recipient)
                .transfer(NearToken::from_yoctonear(amount.0))
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(CALLBACK_GAS)
                        .on_transfer_complete(grant_id, intent_id),
                ),
        )
    }

    #[private]
    pub fn on_transfer_complete(&mut self, grant_id: String, intent_id: String) -> Intent {
        private_callback();
        let key = record_key(&grant_id, &intent_id);
        let mut intent = self.intents.get(&key).expect("INTENT_NOT_FOUND");
        if intent.status != Status::Pending {
            return intent;
        }
        let success = promise_success();
        let mut grant = self.grant(&grant_id);
        let mut balance = self.balance(&grant.owner);
        balance.pending_reserved = U128(sub(balance.pending_reserved.0, intent.amount.0));
        grant.pending_reserved = U128(sub(grant.pending_reserved.0, intent.amount.0));
        grant.pending_transactions = grant
            .pending_transactions
            .checked_sub(1)
            .expect("LEDGER_INVARIANT");
        if success {
            grant.finalized_spent = U128(add(grant.finalized_spent.0, intent.amount.0));
            grant.finalized_transactions = grant
                .finalized_transactions
                .checked_add(1)
                .expect("OVERFLOW");
            balance.finalized_spent = U128(add(balance.finalized_spent.0, intent.amount.0));
            intent.status = Status::Settled;
        } else {
            intent.status = Status::Failed;
            intent.reason = Reason::TransferFailed;
        }
        self.balances.insert(&grant.owner, &balance);
        self.grants.insert(&grant_id, &grant);
        self.intents.insert(&key, &intent);
        event(
            "intent_completed",
            near_sdk::serde_json::json!({"grant_id": grant_id, "intent_id": intent_id, "intent": intent}),
        );
        intent
    }

    pub fn withdraw(&mut self, withdrawal_id: String, amount: U128) -> Promise {
        valid_id(&withdrawal_id);
        let owner = direct_owner();
        enough_gas();
        let mut balance = self.balance(&owner);
        require!(
            amount.0 > 0 && amount.0 <= balance.available(),
            "INSUFFICIENT_AVAILABLE"
        );
        let key = record_key(owner.as_str(), &withdrawal_id);
        require!(self.withdrawals.get(&key).is_none(), "WITHDRAWAL_EXISTS");
        let before = env::storage_usage();
        balance.pending_withdrawals = U128(add(balance.pending_withdrawals.0, amount.0));
        self.balances.insert(&owner, &balance);
        self.withdrawals.insert(
            &key,
            &Withdrawal {
                amount,
                status: Status::Pending,
            },
        );
        self.charge_storage(&owner, before);
        enough_liquid(amount.0);
        event(
            "withdrawal_pending",
            near_sdk::serde_json::json!({"owner": owner, "withdrawal_id": withdrawal_id, "amount": amount}),
        );
        Promise::new(owner.clone())
            .transfer(NearToken::from_yoctonear(amount.0))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(CALLBACK_GAS)
                    .on_withdraw_complete(owner, withdrawal_id),
            )
    }

    #[private]
    pub fn on_withdraw_complete(&mut self, owner: AccountId, withdrawal_id: String) -> Withdrawal {
        private_callback();
        let key = record_key(owner.as_str(), &withdrawal_id);
        let mut withdrawal = self.withdrawals.get(&key).expect("WITHDRAWAL_NOT_FOUND");
        if withdrawal.status != Status::Pending {
            return withdrawal;
        }
        let success = promise_success();
        let mut balance = self.balance(&owner);
        balance.pending_withdrawals = U128(sub(balance.pending_withdrawals.0, withdrawal.amount.0));
        if success {
            balance.completed_withdrawals =
                U128(add(balance.completed_withdrawals.0, withdrawal.amount.0));
            withdrawal.status = Status::Settled;
        } else {
            withdrawal.status = Status::Failed;
        }
        self.balances.insert(&owner, &balance);
        self.withdrawals.insert(&key, &withdrawal);
        event(
            "withdrawal_completed",
            near_sdk::serde_json::json!({"owner": owner, "withdrawal_id": withdrawal_id, "withdrawal": withdrawal}),
        );
        withdrawal
    }

    pub fn get_grant(&self, grant_id: String) -> Option<Grant> {
        self.grants.get(&grant_id)
    }
    pub fn get_intent(&self, grant_id: String, intent_id: String) -> Option<Intent> {
        self.intents.get(&record_key(&grant_id, &intent_id))
    }
    pub fn get_withdrawal(&self, owner: AccountId, withdrawal_id: String) -> Option<Withdrawal> {
        self.withdrawals
            .get(&record_key(owner.as_str(), &withdrawal_id))
    }
    pub fn get_owner_balance(&self, owner: AccountId) -> Balance {
        self.balance(&owner)
    }
    pub fn get_available_balance(&self, owner: AccountId) -> U128 {
        U128(self.balance(&owner).available())
    }
}

impl Vault {
    fn balance(&self, owner: &AccountId) -> Balance {
        self.balances
            .get(owner)
            .expect("STORAGE_REGISTRATION_REQUIRED")
    }
    fn grant(&self, id: &String) -> Grant {
        self.grants.get(id).expect("GRANT_NOT_FOUND")
    }
    fn charge_storage(&mut self, owner: &AccountId, before: u64) {
        let bytes = env::storage_usage()
            .checked_sub(before)
            .expect("STORAGE_INVARIANT");
        let cost = u128::from(bytes)
            .checked_mul(env::storage_byte_cost().as_yoctonear())
            .expect("OVERFLOW");
        let mut balance = self.balance(owner);
        balance.storage_available = U128(
            balance
                .storage_available
                .0
                .checked_sub(cost)
                .expect("INSUFFICIENT_STORAGE_ALLOWANCE"),
        );
        self.balances.insert(owner, &balance);
    }
}

#[allow(clippy::too_many_arguments)]
fn evaluate(
    g: &Grant,
    b: &Balance,
    nonce: U64,
    asset: &str,
    to: &AccountId,
    amount: U128,
    hash: &str,
    duplicate: bool,
    now: u64,
) -> Reason {
    if !g.active {
        return Reason::Revoked;
    }
    if now >= g.policy.expires_at_ns.0 {
        return Reason::Expired;
    }
    if duplicate || nonce != g.next_nonce {
        return Reason::NonceReplay;
    }
    if asset != "NEAR" {
        return Reason::AssetNotAllowed;
    }
    if !g.policy.recipients.contains(to) {
        return Reason::DestinationNotAllowed;
    }
    let count = u64::from(g.finalized_transactions) + u64::from(g.pending_transactions);
    if count >= u64::from(g.policy.max_transactions) {
        return Reason::TxCapExceeded;
    }
    if g.finalized_spent
        .0
        .checked_add(g.pending_reserved.0)
        .and_then(|s| s.checked_add(amount.0))
        .is_none_or(|s| s > g.policy.spend_cap.0)
    {
        return Reason::SpendCapExceeded;
    }
    if g.has_reserved && now.saturating_sub(g.last_reserved_ns.0) < g.policy.cooldown_ns.0 {
        return Reason::CooldownActive;
    }
    if hash != g.policy.policy_hash {
        return Reason::PolicyHashMismatch;
    }
    if amount.0 == 0 {
        return Reason::InvalidAmount;
    }
    if amount.0 > b.available() {
        return Reason::InsufficientBalance;
    }
    Reason::Ok
}

fn direct_owner() -> AccountId {
    let caller = env::predecessor_account_id();
    require!(
        caller == env::signer_account_id() && caller != env::current_account_id(),
        "DIRECT_OWNER_ONLY"
    );
    caller
}
fn private_callback() {
    require!(
        env::predecessor_account_id() == env::current_account_id(),
        "PRIVATE_CALLBACK"
    );
}
fn promise_success() -> bool {
    require!(env::promise_results_count() == 1, "INVALID_PROMISE_COUNT");
    // Native transfer results are empty. An unexpected payload must lock the
    // reservation, never be misclassified as a failed transfer and released.
    match env::promise_result_checked(0, 0) {
        Ok(_) => true,
        Err(PromiseError::Failed) => false,
        Err(_) => env::panic_str("UNEXPECTED_TRANSFER_RESULT"),
    }
}
fn enough_gas() {
    require!(
        env::prepaid_gas()
            .as_gas()
            .saturating_sub(env::used_gas().as_gas())
            >= MIN_CALL_GAS,
        "INSUFFICIENT_GAS"
    );
}
fn enough_liquid(amount: u128) {
    let storage = u128::from(env::storage_usage())
        .checked_mul(env::storage_byte_cost().as_yoctonear())
        .expect("OVERFLOW");
    require!(
        env::account_balance().as_yoctonear() >= add(add(storage, LIQUID_RESERVE), amount),
        "INSUFFICIENT_CONTRACT_RESERVE"
    );
}
fn valid_id(id: &str) {
    require!(
        !id.is_empty()
            && id.len() <= 64
            && id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_'),
        "INVALID_ID"
    );
}
fn record_key(scope: &str, id: &str) -> Vec<u8> {
    env::sha256(near_sdk::serde_json::to_vec(&(scope, id)).expect("SERIALIZATION"))
}
fn add(a: u128, b: u128) -> u128 {
    a.checked_add(b).expect("OVERFLOW")
}
fn sub(a: u128, b: u128) -> u128 {
    a.checked_sub(b).expect("LEDGER_INVARIANT")
}
fn event(name: &str, data: near_sdk::serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        near_sdk::serde_json::json!({"standard": "redline", "version": "1.0.0", "event": name, "data": [data]})
    ));
}

#[cfg(test)]
mod tests;
