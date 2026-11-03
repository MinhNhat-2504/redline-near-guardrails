// USER-RUN. Reads only the local bearer session, prepares UNSIGNED owner actions.
// Never loads wallet/executor keys, invokes CLI signing, or submits an intent.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { formatNear } from "../src/near/units.js";
import { ledgerSchema, policySchema, recordId } from "../src/near/types.js";

const OWNER="nhat-redline-owner.testnet", VAULT="nhat-redline-vault.testnet", AGENT="nhat-redline-agent.testnet", PAYEE="nhat-redline-payee.testnet";
const PRINCIPAL=100000000000000000000000n, CAP="50000000000000000000000";
const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=resolve(root,'.tooling/near-api-demo');const pointer=resolve(directory,'latest-package.txt');
const quote=(value:string)=>"'"+value.replace(/'/g,"''")+"'";

async function main(){
  if(process.argv[2]==='--help'){
    console.log('USER-RUN: prepares unsigned API demo, target principal 0.1 NEAR, total grant cap 0.05 NEAR, max3, one payee, one-hour expiry. No signing/submission.');return;
  }
  if(process.argv.length>2)throw new Error('Only --help is supported');
  const session=JSON.parse(await readFile(resolve(root,'.tooling/near-local/session.json'),'utf8'));
  if(session.accountId!==OWNER||Date.parse(session.expiresAt)<=Date.now())throw new Error('Owner session expired; run near-login-cli.ts first');
  const api=async(path:string,body?:unknown)=>{
    const response=await fetch('http://127.0.0.1:8787'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+session.token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90_000)});
    if(!response.ok)throw new Error(`Local API HTTP ${response.status}; no transaction submitted. Do not repeat any prior funding blindly.`);
    return response.json();
  };
  assert.equal((await api('/near/auth/me')).accountId,OWNER);
  let packagePath:string|undefined;
  try{packagePath=(await readFile(pointer,'utf8')).trim();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  let prepared:any;
  if(packagePath){
    if(!resolve(packagePath).startsWith(directory+"\\")&&!resolve(packagePath).startsWith(directory+"/"))throw new Error('Unexpected package pointer');
    prepared=JSON.parse(await readFile(resolve(packagePath,'package.json'),'utf8'));
  }else{
    const expires=(BigInt(Date.now())+3600000n)*1000000n;
    const draft=await api('/near/owner-actions',{method:'create_grant',policy:{spend_cap:CAP,max_transactions:3,recipients:[PAYEE],expires_at_ns:expires.toString(),cooldown_ns:'0'}});
    assert.equal(draft.unsigned,true);assert.equal(draft.signerId,OWNER);assert.equal(draft.transaction.receiverId,VAULT);
    assert.equal(draft.transaction.actions.length,1);
    const call=draft.transaction.actions[0].params;assert.equal(call.methodName,'create_grant');assert.equal(call.deposit,'0');
    const policy=policySchema.parse(call.args.policy);
    assert.equal(policy.executor,AGENT);assert.equal(policy.spend_cap,CAP);assert.equal(policy.max_transactions,3);assert.deepEqual(policy.recipients,[PAYEE]);assert.equal(policy.cooldown_ns,'0');
    assert.equal(createHash('sha256').update(draft.canonicalPolicy).digest('hex'),policy.policy_hash);
    assert.equal(policy.expires_at_ns,expires.toString());
    const canonical=JSON.parse(draft.canonicalPolicy);assert.equal(canonical.network,'testnet');assert.equal(canonical.contract_id,VAULT);assert.equal(canonical.owner_id,OWNER);assert.equal(canonical.grant_id,call.args.grant_id);
    packagePath=resolve(directory,'api-'+randomUUID().replace(/-/g,''));await mkdir(packagePath,{recursive:true});
    prepared={grantArgs:call.args,canonical:draft.canonicalPolicy,depositInstructionIssued:false};
    await writeFile(resolve(packagePath,'grant.json'),JSON.stringify(call.args,null,2));
    await writeFile(resolve(packagePath,'policy-canonical.json'),draft.canonicalPolicy);
    await writeFile(resolve(packagePath,'package.json'),JSON.stringify(prepared,null,2));
    await writeFile(pointer,packagePath);
  }
  const policy=policySchema.parse(prepared.grantArgs.policy);recordId.parse(prepared.grantArgs.grant_id);
  assert.equal(policy.executor,AGENT);assert.equal(policy.spend_cap,CAP);assert.deepEqual(policy.recipients,[PAYEE]);assert.equal(policy.max_transactions,3);
  assert.equal(policy.cooldown_ns,'0');assert.equal(createHash('sha256').update(prepared.canonical).digest('hex'),policy.policy_hash);
  const canonical=JSON.parse(prepared.canonical);
  assert.equal(canonical.network,'testnet');assert.equal(canonical.contract_id,VAULT);assert.equal(canonical.owner_id,OWNER);assert.equal(canonical.grant_id,prepared.grantArgs.grant_id);
  for(const field of ['executor','spend_cap','max_transactions','recipients','expires_at_ns','cooldown_ns'])assert.deepEqual(canonical[field],(policy as any)[field]);
  assert.deepEqual(JSON.parse(await readFile(resolve(packagePath!,'grant.json'),'utf8')),prepared.grantArgs);
  if(BigInt(policy.expires_at_ns)<=BigInt(Date.now())*1000000n)throw new Error('Reviewed package expired; do not reuse or silently replace it');
  const existing=await fetch('http://127.0.0.1:8787/near/grants/'+prepared.grantArgs.grant_id,{signal:AbortSignal.timeout(90_000)});
  if(existing.ok){console.log('Grant already exists. Do not repeat funding/create_grant. Send its ID for reconciliation: '+prepared.grantArgs.grant_id);return;}
  if(existing.status!==404)throw new Error('Could not determine grant existence; no funding instruction generated');
  const ledger=ledgerSchema.parse((await api('/near/owners/'+OWNER+'/balance')).value);
  const available=BigInt(ledger.credited)-BigInt(ledger.finalized_spent)-BigInt(ledger.completed_withdrawals)-BigInt(ledger.pending_reserved)-BigInt(ledger.pending_withdrawals);
  const needed=PRINCIPAL>available?PRINCIPAL-available:0n;
  console.log('UNSIGNED API demo: owner '+OWNER+', executor '+AGENT+', only payee '+PAYEE);
  console.log('Grant total cap 0.05 NEAR; max3; cooldown0; expires '+new Date(Number(BigInt(policy.expires_at_ns)/1000000n)).toISOString());
  console.log('Review grant: '+resolve(packagePath!,'grant.json'));
  if(needed>0n){
    if(prepared.depositInstructionIssued)throw new Error('Funding instruction was already issued. Verify the prior deposit before repeating it; package retained.');
    const draft=await api('/near/owner-actions',{method:'deposit',amount:needed.toString()});
    assert.equal(draft.unsigned,true);assert.equal(draft.signerId,OWNER);assert.equal(draft.transaction.receiverId,VAULT);
    assert.equal(draft.transaction.actions[0].params.methodName,'deposit');assert.equal(draft.transaction.actions[0].params.deposit,needed.toString());
    prepared.depositInstructionIssued=true;await writeFile(resolve(packagePath!,'package.json'),JSON.stringify(prepared,null,2));
    console.log('\n1. Reviewed principal top-up: '+formatNear(needed.toString())+' NEAR (native Testnet only)');
    console.log(`near contract call-function as-transaction ${VAULT} deposit json-args '{}' prepaid-gas '100 Tgas' attached-deposit '${formatNear(needed.toString())} NEAR' sign-as ${OWNER} network-config testnet sign-with-keychain send`);
  }else console.log('Principal already sufficient; skip deposit.');
  console.log('\n2. After deposit succeeds, review grant.json then owner-sign this grant:');
  console.log(`near contract call-function as-transaction ${VAULT} create_grant file-args ${quote(resolve(packagePath!,'grant.json'))} prepaid-gas '100 Tgas' attached-deposit '0 NEAR' sign-as ${OWNER} network-config testnet sign-with-keychain send`);
  await writeFile(new URL('../../docs/evidence/phase3-api-demo-prepared.json',import.meta.url),JSON.stringify({status:'UNSIGNED',owner:OWNER,executor:AGENT,contract:VAULT,grantId:prepared.grantArgs.grant_id,policy,plannedTopupYocto:needed.toString(),financialActions:'NONE'},null,2)+'\n');
  console.log('\nNo transaction was submitted by this helper. Keep the package/IDs unchanged on retries.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Unsigned preparation failed');process.exitCode=1;});
