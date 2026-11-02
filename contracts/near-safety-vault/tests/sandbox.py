"""Real local near-sandbox receipt tests, not SDK mocks or public Testnet proof.

Requires Linux, Python cryptography, compiled WASM and official near-sandbox binary.
Keys/home/logs stay in ignored .tooling. Exit nonzero on missing prerequisites/failure.
"""
import argparse
import base64
import concurrent.futures
import hashlib
import json
import pathlib
import socket
import struct
import subprocess
import tempfile
import threading
import time
import urllib.request
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

NEAR = 10**24
ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'


def decode58(value):
    n = 0
    for char in value:
        n = n * 58 + ALPHABET.index(char)
    return b'\0' * (len(value) - len(value.lstrip('1'))) + n.to_bytes((n.bit_length()+7)//8, 'big')


def encode58(value):
    n = int.from_bytes(value, 'big')
    out = ''
    while n:
        n, digit = divmod(n, 58)
        out = ALPHABET[digit] + out
    return '1' * (len(value) - len(value.lstrip(b'\0'))) + out


def blob(value):
    return struct.pack('<I', len(value)) + value


def string(value):
    return blob(value.encode())


def u128(value):
    return value.to_bytes(16, 'little')


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class Chain:
    def __init__(self, port):
        self.url = f'http://127.0.0.1:{port}'
        self.keys = {}
        self.nonces = {}
        self.lock = threading.Lock()
        self.proofs = []
        self.checks = []

    def rpc(self, method, params):
        request = urllib.request.Request(self.url, json.dumps({'jsonrpc': '2.0', 'id': 'redline', 'method': method, 'params': params}).encode(), {'Content-Type': 'application/json'})
        result = json.load(urllib.request.urlopen(request, timeout=90))
        if 'error' in result:
            raise RuntimeError(json.dumps(result['error']))
        return result['result']

    def transaction(self, who, to, actions):
        with self.lock:
            key = self.keys[who]
            public = key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
            access = self.rpc('query', {'request_type': 'view_access_key', 'finality': 'final', 'account_id': who, 'public_key': 'ed25519:' + encode58(public)})
            nonce = max(access['nonce'], self.nonces.get(who, 0)) + 1
            self.nonces[who] = nonce
            transaction = string(who) + b'\0' + public + struct.pack('<Q', nonce) + string(to) + decode58(access['block_hash']) + struct.pack('<I', len(actions)) + b''.join(actions)
            signed = transaction + b'\0' + key.sign(hashlib.sha256(transaction).digest())
            # Inclusion order consumes access-key nonces before another thread submits.
            # Receipts/callbacks remain free to overlap after this lock is released.
            self.rpc('send_tx', {'signed_tx_base64': base64.b64encode(signed).decode(), 'wait_until': 'INCLUDED'})
        # No retry with a new transaction/nonce if outcome is unknown.
        result = self.rpc('tx', {'tx_hash': encode58(hashlib.sha256(transaction).digest()), 'sender_account_id': who, 'wait_until': 'FINAL'})
        assert result['final_execution_status'] == 'FINAL', result['final_execution_status']
        self.proofs.append({'hash': result['transaction']['hash'], 'receiver': to, 'status': result['status'],
                            'receipt_outcomes': [{'id': r['id'], 'executor_id': r['outcome']['executor_id'], 'status': r['outcome']['status'], 'logs': r['outcome']['logs']} for r in result['receipts_outcome']]})
        return result

    def create(self, root, name):
        who = f'{name}.{root}'
        key = Ed25519PrivateKey.generate()
        self.keys[who] = key
        public = key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
        result = self.transaction(root, who, [b'\0', b'\3' + u128(25 * NEAR), b'\5\0' + public + struct.pack('<Q', 0) + b'\1'])
        assert 'SuccessValue' in result['status'], result['status']
        return who

    def call(self, who, method, args, deposit=0, gas=100*10**12, fail=False):
        action = b'\2' + string(method) + blob(json.dumps(args).encode()) + struct.pack('<Q', gas) + u128(deposit)
        result = self.transaction(who, self.vault, [action])
        if fail:
            assert 'Failure' in result['status'], result['status']
            if isinstance(fail, str):
                assert fail in json.dumps(result['status']), result['status']
            return result
        assert 'SuccessValue' in result['status'], result['status']
        raw = base64.b64decode(result['status']['SuccessValue'])
        return json.loads(raw) if raw else None

    def view(self, method, args):
        result = self.rpc('query', {'request_type': 'call_function', 'finality': 'final', 'account_id': self.vault, 'method_name': method, 'args_base64': base64.b64encode(json.dumps(args).encode()).decode()})
        return json.loads(bytes(result['result']))


def scenarios(c, root, wasm):
    c.vault = c.create(root, 'vault')
    owner, agent, payee, stranger = [c.create(root, n) for n in ['owner', 'agent', 'payee', 'stranger']]
    missing = f'missing.{root}'
    deploy = c.transaction(c.vault, c.vault, [b'\1' + blob(wasm.read_bytes())])
    assert 'SuccessValue' in deploy['status'], deploy['status']
    c.call(owner, 'new', {})
    c.call(owner, 'storage_deposit', {}, NEAR)
    c.call(agent, 'storage_deposit', {}, NEAR)
    c.call(owner, 'deposit', {}, 10 * NEAR)
    now = int(c.rpc('block', {'finality': 'final'})['header']['timestamp_nanosec'])
    policy = {'executor': agent, 'policy_hash': 'a'*64, 'spend_cap': str(5*NEAR), 'max_transactions': 5,
              'recipients': [payee, missing], 'expires_at_ns': str(now + 3600*10**9), 'cooldown_ns': '0'}

    def grant(name, **changes):
        c.call(owner, 'create_grant', {'grant_id': name, 'policy': {**policy, **changes}})

    def execute(g, name, nonce=0, amount=NEAR, **changes):
        args = {'grant_id': g, 'intent_id': name, 'nonce': str(nonce), 'asset': 'NEAR', 'recipient': payee,
                'amount': str(amount), 'policy_hash': 'a'*64}
        args.update(changes)
        return c.call(agent, 'execute_transfer', args)

    grant('happy')
    before = int(c.rpc('query', {'request_type': 'view_account', 'finality': 'final', 'account_id': payee})['amount'])
    assert execute('happy', 'one')['status'] == 'SETTLED'
    after = int(c.rpc('query', {'request_type': 'view_account', 'finality': 'final', 'account_id': payee})['amount'])
    assert after - before == NEAR
    assert execute('happy', 'one', nonce=1)['reason'] == 'NONCE_REPLAY'
    assert c.view('get_intent', {'grant_id': 'happy', 'intent_id': 'one'})['status'] == 'SETTLED'
    owner_storage = c.view('get_owner_balance', {'owner': owner})['storage_available']
    for name, changes, reason in [
        ('recipient', {'recipient': stranger}, 'DESTINATION_NOT_ALLOWED'),
        ('asset', {'asset': 'FT'}, 'ASSET_NOT_ALLOWED'),
        ('spend', {'amount': str(6*NEAR)}, 'SPEND_CAP_EXCEEDED'),
        ('nonce', {'nonce': '7'}, 'NONCE_REPLAY'),
        ('hash', {'policy_hash': 'b'*64}, 'POLICY_HASH_MISMATCH'),
        ('zero', {'amount': '0'}, 'INVALID_AMOUNT'),
    ]:
        result = execute('happy', name, **{'nonce': 1, **changes})
        assert result['status'] == 'REJECTED' and result['reason'] == reason, result
    assert c.view('get_owner_balance', {'owner': owner})['storage_available'] == owner_storage
    c.call(stranger, 'revoke_grant', {'grant_id': 'happy'}, fail='OWNER_ONLY')
    c.call(stranger, 'execute_transfer', {'grant_id': 'happy', 'intent_id': 'spoof', 'nonce': '1', 'asset': 'NEAR', 'recipient': payee, 'amount': str(NEAR), 'policy_hash': 'a'*64}, fail='EXECUTOR_ONLY')
    c.call(agent, 'on_transfer_complete', {'grant_id': 'happy', 'intent_id': 'one'}, fail=True)
    c.call(owner, 'revoke_grant', {'grant_id': 'happy'})
    assert execute('happy', 'revoked', nonce=1)['reason'] == 'REVOKED'

    grant('failure')
    available = c.view('get_available_balance', {'owner': owner})
    result = execute('failure', 'missing', recipient=missing)
    assert result['status'] == 'FAILED' and result['reason'] == 'TRANSFER_FAILED', result
    assert c.view('get_available_balance', {'owner': owner}) == available
    assert execute('failure', 'missing', nonce=1)['reason'] == 'NONCE_REPLAY'
    assert any('Failure' in r['status'] for r in c.proofs[-2]['receipt_outcomes'])

    grant('count', max_transactions=1)
    assert execute('count', 'one')['status'] == 'SETTLED'
    assert execute('count', 'two', nonce=1)['reason'] == 'TX_CAP_EXCEEDED'
    grant('cooldown', cooldown_ns=str(3600*10**9))
    assert execute('cooldown', 'one')['status'] == 'SETTLED'
    assert execute('cooldown', 'two', nonce=1)['reason'] == 'COOLDOWN_ACTIVE'
    # Fast-forward actual local runtime; not wall-clock sleep.
    expiry_now = int(c.rpc('block', {'finality': 'final'})['header']['timestamp_nanosec'])
    expiry = expiry_now + 3*10**9
    grant('expires', expires_at_ns=str(expiry))
    c.rpc('sandbox_fast_forward', {'delta_height': 300})
    # Height fast-forward alone does not guarantee wall-clock timestamp advancement.
    # Wait for the actual finalized block timestamp before asserting expiry.
    for _ in range(100):
        observed = int(c.rpc('block', {'finality': 'final'})['header']['timestamp_nanosec'])
        if observed >= expiry:
            break
        time.sleep(.1)
    else:
        raise TimeoutError('Finalized sandbox clock did not reach grant expiry')
    assert execute('expires', 'one')['reason'] == 'EXPIRED'
    c.checks.append({'scenario': 'expiry', 'expires_at_ns': str(expiry), 'observed_final_block_ns': str(observed)})

    grant('race')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(execute, 'race', f'race{i}', i, 3*NEAR) for i in range(2)]
        results = [f.result() for f in futures]
    assert sum(r['status'] == 'SETTLED' for r in results) == 1, results
    state = c.view('get_grant', {'grant_id': 'race'})
    assert int(state['finalized_spent']) == 3*NEAR and state['pending_reserved'] == '0', state

    c.call(stranger, 'storage_deposit', {}, 1, fail='INSUFFICIENT_STORAGE_ALLOWANCE')
    c.call(stranger, 'storage_deposit', {}, NEAR)
    c.call(stranger, 'create_grant', {'grant_id': 'isolated', 'policy': policy})
    assert execute('isolated', 'one')['reason'] == 'INSUFFICIENT_BALANCE'
    c.call(stranger, 'withdraw', {'withdrawal_id': 'steal', 'amount': '1'}, fail='INSUFFICIENT_AVAILABLE')
    grant('lowgas')
    c.call(agent, 'execute_transfer', {'grant_id': 'lowgas', 'intent_id': 'lowgas', 'nonce': '0', 'asset': 'NEAR', 'recipient': payee, 'amount': '1', 'policy_hash': 'a'*64}, gas=20*10**12, fail='INSUFFICIENT_GAS')
    available = int(c.view('get_available_balance', {'owner': owner}))
    assert available == 4*NEAR, available
    assert c.call(owner, 'withdraw', {'withdrawal_id': 'out', 'amount': str(available)})['status'] == 'SETTLED'
    c.call(owner, 'withdraw', {'withdrawal_id': 'out', 'amount': '1'}, fail=True)
    assert c.view('get_available_balance', {'owner': owner}) == '0'
    balance = c.view('get_owner_balance', {'owner': owner})
    assert balance['pending_reserved'] == '0' and balance['pending_withdrawals'] == '0'
    # Race a withdrawal and agent spend against the same five-NEAR ledger.
    racer = c.create(root, 'racer')
    c.call(racer, 'storage_deposit', {}, NEAR)
    c.call(racer, 'deposit', {}, 5*NEAR)
    c.call(racer, 'create_grant', {'grant_id': 'withdrawrace', 'policy': policy})
    def racing_withdrawal():
        try:
            return c.call(racer, 'withdraw', {'withdrawal_id': 'raceout', 'amount': str(4*NEAR)})
        except AssertionError as error:
            assert 'INSUFFICIENT_AVAILABLE' in str(error), error
            return {'status': 'REJECTED'}  # Runtime failure is retained in receipt evidence.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        transfer = pool.submit(execute, 'withdrawrace', 'one', 0, 4*NEAR)
        withdrawal = pool.submit(racing_withdrawal)
        outcomes = [transfer.result(), withdrawal.result()]
    assert sum(r['status'] == 'SETTLED' for r in outcomes) == 1, outcomes
    balance = c.view('get_owner_balance', {'owner': racer})
    assert int(balance['finalized_spent']) + int(balance['completed_withdrawals']) == 4*NEAR
    assert balance['pending_reserved'] == '0' and balance['pending_withdrawals'] == '0'
    assert c.view('get_available_balance', {'owner': racer}) == str(NEAR)
    print('PASS: real local receipt tests: allow, seven gates, replay, failure release, auth, isolation, concurrent caps, withdrawal.', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', required=True, type=pathlib.Path)
    parser.add_argument('--wasm', required=True, type=pathlib.Path)
    parser.add_argument('--evidence', required=True, type=pathlib.Path)
    args = parser.parse_args()
    assert args.binary.is_file() and args.wasm.is_file(), 'Binary/WASM missing: tests NOT RUN'
    workspace = pathlib.Path(__file__).resolve().parents[3]
    tooling = workspace / '.tooling'
    home = pathlib.Path(tempfile.mkdtemp(prefix='sandbox-', dir=tooling))
    binary = str(args.binary.resolve())
    subprocess.run([binary, '--home', str(home), 'init', '--fast'], check=True, capture_output=True)
    config_path = home/'config.json'
    config = json.loads(config_path.read_text())
    port = free_port()
    config['rpc']['addr'] = f'127.0.0.1:{port}'
    config['network']['addr'] = f'127.0.0.1:{free_port()}'
    config_path.write_text(json.dumps(config))
    root_key = json.loads((home/'validator_key.json').read_text())
    root = root_key['account_id']
    chain = Chain(port)
    chain.keys[root] = Ed25519PrivateKey.from_private_bytes(decode58(root_key['secret_key'].split(':')[1])[:32])
    with (home/'node.log').open('w') as log:
        process = subprocess.Popen([binary, '--home', str(home), 'run'], stdout=log, stderr=log)
        try:
            for _ in range(120):
                if process.poll() is not None:
                    raise RuntimeError(f'Sandbox stopped. Local log: {home}/node.log')
                try:
                    chain.rpc('status', [])
                    break
                except Exception:
                    time.sleep(.5)
            else:
                raise TimeoutError('Sandbox did not start')
            passed = False
            try:
                scenarios(chain, root, args.wasm)
                passed = True
            finally:
                report = {'network': 'local near-sandbox ONLY', 'binary_version': subprocess.check_output([binary, '--version']).decode().strip(),
                          'wasm_sha256': hashlib.sha256(args.wasm.read_bytes()).hexdigest(), 'result': 'PASS' if passed else 'FAIL', 'checks': chain.checks, 'transactions': chain.proofs}
                args.evidence.write_text(json.dumps(report, indent=2))
        finally:
            process.terminate()
            try:
                process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == '__main__':
    main()
