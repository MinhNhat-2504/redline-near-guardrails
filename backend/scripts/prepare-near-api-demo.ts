// USER-RUN. Reads only the local bearer session, prepares UNSIGNED owner actions.
// Never loads wallet/executor keys, invokes CLI signing, or submits an intent.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { formatNear } from "../src/near/units.js";
import { ledgerSchema, policySchema, recordId } from "../src/near/types.js";
import { parseDemoGrantOptions, makeDemoValidity, checkStoredDemoValidity } from "../src/near/demo-validity.js";

const OWNER="nhat-redline-owner.testnet", VAULT="nhat-redline-vault.testnet", AGENT="nhat-redline-agent.testnet", PAYEE="nhat-redline-payee.testnet";
const PRINCIPAL=100000000000000000000000n, CAP="50000000000000000000000";
const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=resolve(root,'.tooling/near-api-demo');const latestPointer=resolve(directory,'latest-package.txt');
const quote=(value:string)=>"'"+value.replace(/'/g,"''")+"'";

async function main(){
  if(process.argv[2]==='--help'){
    console.log('USER-RUN: unsigned demo target0.1/cap0.05/max3/payee-only. --grant-hours <1..8>, default1h for NEW proposals; retries preserve exact stored deadline. --after-key-reset or --renew-expired-grant preserves old packages, never recovery topups. No signing/submission.');return;
  }
  const options=parseDemoGrantOptions(process.argv.slice(2));
  const renewing=options.mode==='renew-expired-grant';
  const recovering=options.mode==='after-key-reset'||renewing;
  let pointer=recovering?resolve(directory,'recovery-package.txt'):latestPointer;
  let recovery:any;
  if(recovering){
    recovery=JSON.parse(await readFile(resolve(root,'docs/evidence/phase3-executor-journal-recovery.json'),'utf8'));
    assert.equal(recovery.status,'INVALIDATED_BY_FINAL_KEY_RESET');assert.equal(recovery.disposition.state,'INVALIDATED');
    assert.equal(recovery.disposition.finalized,false);assert.equal(recovery.disposition.keyResetProof.status,'VERIFIED_KEY_RESET_ONLY');
    assert.equal(recovery.disposition.keyResetProof.executor,AGENT);assert.equal(recovery.disposition.keyResetProof.contract,VAULT);
    assert.equal(recovery.disposition.keyResetProof.resetTransactionHash,recovery.resetTransactionHash);
    assert.equal(recovery.disposition.transactionHash,recovery.originalTransactionHash);
  }
  let session;
  try{session=JSON.parse(await readFile(resolve(root,'.tooling/near-local/session.json'),'utf8'));}
  catch{throw new Error('Local session unavailable; run near-login-cli.ts. Do not share session.json.');}
  if(session.accountId!==OWNER||!(Date.parse(session.expiresAt)>Date.now()))throw new Error('Owner session expired; run near-login-cli.ts first');
  const api=async(path:string,body?:unknown)=>{
    const response=await fetch('http://127.0.0.1:8787'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+session.token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90_000)});
    if(!response.ok)throw new Error(`Local API HTTP ${response.status}; no transaction submitted. Do not repeat any prior funding blindly.`);
    return response.json();
  };
  assert.equal((await api('/near/auth/me')).accountId,OWNER);
  let renewal:any;
  if(renewing){
    const previousPath=(await readFile(latestPointer,'utf8')).trim();
    if(!resolve(previousPath).startsWith(directory+"\\")&&!resolve(previousPath).startsWith(directory+"/"))throw new Error('Unexpected package pointer');
    const previous=JSON.parse(await readFile(resolve(previousPath,'package.json'),'utf8'));
    const previousArgs=JSON.parse(await readFile(resolve(previousPath,'grant.json'),'utf8'));
    assert.deepEqual(previous.grantArgs,previousArgs);
    if(BigInt(previousArgs.policy.expires_at_ns)>BigInt(Date.now())*1000000n){
      assert(previous.renewalOf,'Current grant has not expired; retain existing package');
      renewal=previous.renewalOf;pointer=latestPointer; // Retry the same unsigned renewal; never mint another ID.
    }else{
      const response=await fetch('http://127.0.0.1:8787/near/grants/'+recordId.parse(previousArgs.grant_id),{signal:AbortSignal.timeout(90_000)});
      if(response.ok){
        const current=(await response.json()).value;
        assert.equal(current.owner,OWNER);assert.equal(current.active,true,'Revoked grant needs a separate owner decision');
        assert.deepEqual(current.policy,previousArgs.policy);
        assert(BigInt(current.policy.expires_at_ns)<=BigInt(Date.now())*1000000n,'On-chain grant not expired');
        assert.equal(current.pending_reserved,'0');assert.equal(current.pending_transactions,0);
        const journal=await api('/near/transactions?grantId='+previousArgs.grant_id);assert(Array.isArray(journal));
        assert(journal.every(row=>['SETTLED','FAILED','REJECTED','RUNTIME_FAILED','CONFIRMED','INVALIDATED'].includes(row.state)),'Unresolved intent requires reconciliation, not grant renewal');
      }else if(response.status!==404)throw new Error('Cannot verify expired grant; renewal stopped');
      // An expired unsigned draft (404) may also be replaced only by this explicit owner action.
      renewal={grantId:previousArgs.grant_id,policyHash:previousArgs.policy.policy_hash,previousPackagePath:previousPath};
      pointer=resolve(directory,'renewal-'+recordId.parse(previousArgs.grant_id)+'.txt');
    }
  }
  let packagePath:string|undefined;
  try{packagePath=(await readFile(pointer,'utf8')).trim();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  let prepared:any;
  if(packagePath){
    if(!resolve(packagePath).startsWith(directory+"\\")&&!resolve(packagePath).startsWith(directory+"/"))throw new Error('Unexpected package pointer');
    prepared=JSON.parse(await readFile(resolve(packagePath,'package.json'),'utf8'));
  }else{
    const validity=makeDemoValidity(options.hours??1);
    const expires=BigInt(validity.expiresAtNs);
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
    prepared={grantArgs:call.args,canonical:draft.canonicalPolicy,depositInstructionIssued:false,validity,
      ...(recovering?{recoveryOf:{transactionHash:recovery.originalTransactionHash,resetTransactionHash:recovery.resetTransactionHash,previousPackagePath:(await readFile(latestPointer,'utf8')).trim()}}:{}),...(renewing?{renewalOf:renewal}:{})};
    await writeFile(resolve(packagePath,'grant.json'),JSON.stringify(call.args,null,2));
    await writeFile(resolve(packagePath,'policy-canonical.json'),draft.canonicalPolicy);
    await writeFile(resolve(packagePath,'package.json'),JSON.stringify(prepared,null,2));
    await writeFile(pointer,packagePath);
  }
  const policy=policySchema.parse(prepared.grantArgs.policy);recordId.parse(prepared.grantArgs.grant_id);
  const validityHours=checkStoredDemoValidity(prepared.validity,policy.expires_at_ns,options.hours);
  assert.equal(policy.executor,AGENT);assert.equal(policy.spend_cap,CAP);assert.deepEqual(policy.recipients,[PAYEE]);assert.equal(policy.max_transactions,3);
  assert.equal(policy.cooldown_ns,'0');assert.equal(createHash('sha256').update(prepared.canonical).digest('hex'),policy.policy_hash);
  const canonical=JSON.parse(prepared.canonical);
  assert.equal(canonical.network,'testnet');assert.equal(canonical.contract_id,VAULT);assert.equal(canonical.owner_id,OWNER);assert.equal(canonical.grant_id,prepared.grantArgs.grant_id);
  for(const field of ['executor','spend_cap','max_transactions','recipients','expires_at_ns','cooldown_ns'])assert.deepEqual(canonical[field],(policy as any)[field]);
  assert.deepEqual(JSON.parse(await readFile(resolve(packagePath!,'grant.json'),'utf8')),prepared.grantArgs);
  if(recovering){
    assert.equal(prepared.recoveryOf?.transactionHash,recovery.originalTransactionHash);
    assert.equal(prepared.recoveryOf?.resetTransactionHash,recovery.resetTransactionHash);
    assert.notEqual(prepared.grantArgs.grant_id,recovery.originalGrantId,'Never reuse expired/recovered grant ID');
  }
  if(renewing){assert.deepEqual(prepared.renewalOf,renewal);assert.notEqual(prepared.grantArgs.grant_id,renewal.grantId);}
  if(BigInt(policy.expires_at_ns)<=BigInt(Date.now())*1000000n)throw new Error('Reviewed package expired; do not reuse or silently replace it');
  const existing=await fetch('http://127.0.0.1:8787/near/grants/'+prepared.grantArgs.grant_id,{signal:AbortSignal.timeout(90_000)});
  if(existing.ok){if(recovering)await writeFile(latestPointer,packagePath!);console.log('Grant already exists. Do not repeat funding/create_grant. Send its ID for reconciliation: '+prepared.grantArgs.grant_id);return;}
  if(existing.status!==404)throw new Error('Could not determine grant existence; no funding instruction generated');
  const ledger=ledgerSchema.parse((await api('/near/owners/'+OWNER+'/balance')).value);
  const available=BigInt(ledger.credited)-BigInt(ledger.finalized_spent)-BigInt(ledger.completed_withdrawals)-BigInt(ledger.pending_reserved)-BigInt(ledger.pending_withdrawals);
  const needed=PRINCIPAL>available?PRINCIPAL-available:0n;
  if(recovering&&needed>0n)throw new Error('Recovery principal differs from expected0.1. Reconcile first; no topup instruction generated.');
  if(recovering)await writeFile(latestPointer,packagePath!); // Explicit recovery only; old package stays untouched.
  console.log('UNSIGNED API demo: owner '+OWNER+', executor '+AGENT+', only payee '+PAYEE);
  console.log('Grant total cap 0.05 NEAR; max3; cooldown0; validity '+validityHours+'h; expires '+new Date(Number(BigInt(policy.expires_at_ns)/1000000n)).toISOString());
  console.log('Deadline (UTC+7): '+new Date(Number(BigInt(policy.expires_at_ns)/1000000n)).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})+'. Login does not extend this grant.');
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
  console.log(recovering?'\nReview and owner-sign this NEW grant (no deposit required):':'\n2. After deposit succeeds, review grant.json then owner-sign this grant:');
  console.log(`near contract call-function as-transaction ${VAULT} create_grant file-args ${quote(resolve(packagePath!,'grant.json'))} prepaid-gas '100 Tgas' attached-deposit '0 NEAR' sign-as ${OWNER} network-config testnet sign-with-keychain send`);
  const report=JSON.stringify({status:'UNSIGNED',owner:OWNER,executor:AGENT,contract:VAULT,grantId:prepared.grantArgs.grant_id,policy,validityHours,validity:prepared.validity,plannedTopupYocto:needed.toString(),financialActions:'NONE',...(recovering?{recoveryOf:prepared.recoveryOf}:{}),...(renewing?{renewalOf:prepared.renewalOf}:{})},null,2)+'\n';
  await writeFile(resolve(root,'docs/evidence',renewing?'phase3-api-renewal-prepared.json':recovering?'phase3-api-recovery-prepared.json':'phase3-api-demo-prepared.json'),report);
  await writeFile(resolve(root,'docs/evidence','phase3-api-grant-'+prepared.grantArgs.grant_id+'-prepared.json'),report);
  console.log('\nNo transaction was submitted by this helper. Keep the package/IDs unchanged on retries.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Unsigned preparation failed');process.exitCode=1;});
