// Real public RPC + isolated Postgres + real NEAR API routes. NO owner signatures/broadcasts.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { NearChain } from "../src/chain/near.js";
import { NearAuth, FinalAccessProvider } from "../src/near/auth.js";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import { NearIndexer } from "../src/near/indexer.js";
import { NearReceiptReader } from "../src/near/reader.js";
import { NearStore } from "../src/near/store.js";
import { buildNearApp } from "../src/near/server.js";

const url=new URL(process.env.NEAR_TEST_DATABASE_URL ?? '');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/redline_near_test');
const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
const config={rpcUrl:'https://test.rpc.fastnear.com',contractId:'nhat-redline-vault.testnet',executorId:'nhat-redline-agent.testnet'};
const rpc=new NearReadOnlyRpc(config.rpcUrl);const provider=new FinalAccessProvider({url:config.rpcUrl});
const chain=new NearChain(config,rpc,provider,db);
await chain.connect();assert.equal(chain.signingEnabled,false);
const app=await buildNearApp(chain,new NearAuth(db,provider,'localhost:5173','http://localhost:5173/near/auth/callback'),'http://localhost:5173',false);
try{
  const health=(await app.inject({method:'GET',url:'/health'})).json();assert.equal(health.chain,'near');assert.equal(health.signingEnabled,false);
  const grantResponse=await app.inject({method:'GET',url:'/near/grants/demo-86a101943e5f425e9376a1de84ed66cf'});
  assert.equal(grantResponse.statusCode,200);assert.equal(grantResponse.json().value.active,false);
  const ledgerResponse=await app.inject({method:'GET',url:'/near/owners/nhat-redline-owner.testnet/balance'});
  assert.equal(ledgerResponse.statusCode,200);const ledger=ledgerResponse.json().value;
  assert.equal(ledger.completed_withdrawals,'450000000000000000000000');assert.equal(ledger.pending_reserved,'0');assert.equal(ledger.pending_withdrawals,'0');
  assert.equal(BigInt(ledger.credited),BigInt(ledger.finalized_spent)+BigInt(ledger.completed_withdrawals));
  const ownerReceipt=JSON.parse(readFileSync(new URL('../../docs/evidence/phase2-owner-storage.json',import.meta.url),'utf8')).result;
  const publicKey=ownerReceipt.transaction.public_key;
  const access=await provider.viewAccessKey({accountId:'nhat-redline-owner.testnet',publicKey});assert.equal(access.permission,'FullAccess');
  const decisions=[];
  for(const [name,signer,state] of [
    ['grant-created','nhat-redline-owner.testnet','CONFIRMED'],['safe-transfer',config.executorId,'SETTLED'],
    ['cap-denial',config.executorId,'REJECTED'],['recipient-denial',config.executorId,'REJECTED'],
    ['revoke','nhat-redline-owner.testnet','CONFIRMED'],['post-revoke-denial',config.executorId,'REJECTED'],
    ['withdraw','nhat-redline-owner.testnet','SETTLED'],
  ]){
    const captured=JSON.parse(readFileSync(new URL(`../../docs/evidence/phase2-${name}.json`,import.meta.url),'utf8')).result;
    const observation=await chain.track(captured.transaction.hash,signer);
    assert.equal(observation.finalized,true);assert.equal(observation.state,state);
    decisions.push({hash:observation.transactionHash,state:observation.state,reason:observation.reason});
  }
  const count=await db.nearReceiptEvent.count({where:{scope:chain.store.scope}});
  await db.$disconnect(); // re-open a different Prisma client to prove durable checkpoint persistence
  const restartedDb=new PrismaClient({datasources:{db:{url:url.toString()}}});
  try{
    const reader=new NearReceiptReader(config.contractId,rpc,new NearStore(restartedDb,chain.store.scope));
    const repeat=await reader.reconcile({hash:decisions[1].hash,signer:config.executorId});assert.equal(repeat,null);
    assert.equal(await restartedDb.nearReceiptEvent.count({where:{scope:chain.store.scope}}),count);
    const restartedChain=new NearChain(config,rpc,provider,restartedDb);
    const latest=await rpc.finalBlock() as {header:{height:number}};
    const indexer=new NearIndexer(restartedChain,latest.header.height-1);
    const scanned=await indexer.scan(2);assert.equal(scanned,2);
    const cursor=await restartedDb.nearWatermark.findUniqueOrThrow({where:{scope:chain.store.scope}});
    const report={result:'PASS',scope:'real public Testnet RPC + isolated Postgres + NEAR API reads; no signing or broadcast',
      health,ledger,finalGrantActive:grantResponse.json().value.active,ownerKeyPermission:access.permission,ownerKeyNonce:access.nonce.toString(),
      decisions,storedEvents:count,restartDedupe:'PASS',recentFinalizedBlocksScanned:scanned,watermark:cursor.height.toString(),
      limitations:'Historical transactions reconciled from known proof hashes; block discovery smoke test covers two finalized blocks only. NEP-413 owner-wallet login and scoped-key execution against public Testnet require user signatures and are NOT RUN.'};
    const text=JSON.stringify(report,null,2)+'\n';writeFileSync(new URL('../../docs/evidence/phase3-live-api-proof.json',import.meta.url),text);console.log(text);
  }finally{await restartedDb.$disconnect();}
}finally{await app.close();await db.$disconnect();}
