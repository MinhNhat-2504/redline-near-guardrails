// Offline checks on saved REAL public RPC responses. No wallet/session/DB access.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseRpcJson } from "../src/near/rpc.js";
import { observeVaultTransaction, decodeBase64Json } from "../src/near/receipts.js";
import { grantSchema, ledgerSchema, transferSchema } from "../src/near/types.js";
const evidence = fileURLToPath(new URL("../../docs/evidence/", import.meta.url));
const AGENT="nhat-redline-agent.testnet", VAULT="nhat-redline-vault.testnet", PAYEE="nhat-redline-payee.testnet";
async function main(){
  const read=async(name:string):Promise<any>=>parseRpcJson((await readFile(resolve(evidence,name),"utf8")).replace(/^\uFEFF/,""));
  const result=async(name:string)=>{const r=await read('phase3-api-expired-'+name+'.json');assert(!r.error);return r.result;};
  const view=async(name:string)=>JSON.parse(Buffer.from((await result(name)).result).toString('utf8'));
  const response=await read('phase3-api-recovered-safe-response.json');
  const tx=await result('transaction');
  const observation=observeVaultTransaction(tx,VAULT,response.transactionHash,AGENT);
  assert.equal(tx.transaction.public_key,'ed25519:9hauPZp4YBAHNMNp8bf4ThyYuSMeVTrKn5twEU2JrCy3');
  assert.equal(tx.transaction.actions.length,1);
  const call=tx.transaction.actions[0].FunctionCall;
  assert.equal(call.method_name,'execute_transfer');assert.equal(call.deposit,'0');assert.equal(BigInt(call.gas),80000000000000n);
  const args=transferSchema.parse(decodeBase64Json(call.args));
  assert.equal(args.grant_id,response.grantId);assert.equal(args.intent_id,response.intentId);assert.equal(args.amount,response.amount);assert.equal(args.recipient,PAYEE);assert.equal(args.nonce,'0');
  assert.equal(observation.finalized,true);assert.equal(observation.state,'REJECTED');assert.equal(observation.reason,'EXPIRED');
  const stored=await view('intent');
  assert.deepEqual(stored,{nonce:'0',recipient:PAYEE,amount:args.amount,status:'REJECTED',reason:'EXPIRED'});
  assert.deepEqual(JSON.parse(Buffer.from(tx.status.SuccessValue,'base64').toString('utf8')),stored);
  assert(observation.events.some(e=>e.event==='intent_rejected'&&e.data.some((d:any)=>d.grant_id===args.grant_id&&d.intent_id===args.intent_id)));
  assert(!tx.receipts_outcome.some((r:any)=>r.outcome.executor_id===PAYEE),'Denied call must not schedule payee transfer');
  assert(!observation.events.some(e=>e.event==='intent_pending'||e.event==='intent_completed'));
  for(const r of [tx.transaction_outcome,...tx.receipts_outcome])assert(!('Failure' in r.outcome.status));
  const grant=grantSchema.parse(await view('grant'));
  assert.equal(grant.policy.policy_hash,args.policy_hash);assert.equal(grant.next_nonce,'0');
  assert.equal(grant.finalized_spent,'0');assert.equal(grant.pending_reserved,'0');assert.equal(grant.finalized_transactions,0);assert.equal(grant.pending_transactions,0);
  const ledger=ledgerSchema.parse(await view('owner'));
  const beforeOwner=await read('phase3-api-recovery-owner-before-transfer.json');const beforeLedger=JSON.parse(Buffer.from(beforeOwner.result.result).toString('utf8'));
  for(const field of ['credited','finalized_spent','completed_withdrawals','pending_reserved','pending_withdrawals'] as const)assert.equal(ledger[field],beforeLedger[field]);
  const available=BigInt(ledger.credited)-BigInt(ledger.finalized_spent)-BigInt(ledger.completed_withdrawals)-BigInt(ledger.pending_reserved)-BigInt(ledger.pending_withdrawals);
  assert.equal(available,100000000000000000000000n);
  const payee=await result('payee');assert.equal(payee.amount,(await read('phase3-api-recovery-payee-before-transfer.json')).result.amount);
  const key=await result('key');const beforeKey=(await read('phase3-api-recovery-executor-before-transfer.json')).result;
  assert.equal(BigInt(key.nonce),BigInt(tx.transaction.nonce));assert.equal(BigInt(key.nonce),BigInt(beforeKey.nonce)+1n);
  assert.equal(key.permission.FunctionCall.receiver_id,VAULT);assert.deepEqual(key.permission.FunctionCall.method_names,['execute_transfer']);
  const allowance=BigInt(key.permission.FunctionCall.allowance);assert(allowance>80000000000000000000000n&&allowance<=100000000000000000000000n);
  const block=await result('vault-block');
  assert(tx.receipts_outcome.some((r:any)=>r.outcome.executor_id===VAULT&&r.block_hash===block.header.hash));
  assert(BigInt(block.header.timestamp_nanosec)>=BigInt(grant.policy.expires_at_ns));
  const report={status:'PASS_FINAL_EXPIRED_REJECTION',transactionHash:response.transactionHash,grantId:args.grant_id,intentId:args.intent_id,
    state:'REJECTED',reason:'EXPIRED',finalized:true,executorPublicKey:tx.transaction.public_key,attachedGasTgas:80,
    expiryNs:grant.policy.expires_at_ns,executionTimestampNs:block.header.timestamp_nanosec,availableYocto:available.toString(),
    payeeAmount:payee.amount,keyNonce:key.nonce,keyAllowanceYocto:key.permission.FunctionCall.allowance,
    noPayeeReceipt:true,scope:'Actual scoped-key API rejection; principal/payee unchanged. Gas and intent storage still cost funds. No ALLOW/settlement proof yet.'};
  await writeFile(resolve(evidence,'phase3-api-expired-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Expired proof verification failed');process.exitCode=1;});
