// Real compiled CHAIN=near entry point, isolated DB, no executor credential.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { writeFileSync } from "node:fs";
import { NearReadOnlyRpc } from "../src/near/rpc.js";
import assert from "node:assert/strict";

const url=new URL(process.env.NEAR_TEST_DATABASE_URL??'');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/redline_near_test');
const socket=createServer();await new Promise<void>(resolve=>socket.listen(0,'127.0.0.1',resolve));
const port=(socket.address() as {port:number}).port;await new Promise<void>(resolve=>socket.close(()=>resolve()));
const rpc=new NearReadOnlyRpc();await rpc.connect();
const block=await rpc.finalBlock() as {header:{height:number}};
const child=spawn(process.execPath,['dist/server.js'],{env:{...process.env,DATABASE_URL:url.toString(),CHAIN:'near',PORT:String(port),
  NEAR_APP_ORIGIN:'http://localhost:5173',NEAR_NETWORK:'testnet',NEAR_RPC_URL:'https://test.rpc.fastnear.com',
  NEAR_CONTRACT_ID:'nhat-redline-vault.testnet',NEAR_EXECUTOR_ID:'nhat-redline-agent.testnet',NEAR_EXECUTOR_PUBLIC_KEY:'',NEAR_EXECUTOR_CREDENTIAL_PATH:'',
  NEAR_START_BLOCK:String(block.header.height)},stdio:'ignore',windowsHide:true});
let spawnError=false;child.on('error',()=>{spawnError=true;});
try{
  let health:unknown;
  for(let attempt=0;attempt<60;attempt++){
    if(spawnError||child.exitCode!==null)throw new Error('Isolated NEAR server did not start');
    try{const response=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(1000)});if(response.ok){health=await response.json();break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(health);assert.equal((health as {chain:string}).chain,'near');assert.equal((health as {signingEnabled:boolean}).signingEnabled,false);
  const denied=await fetch(`http://127.0.0.1:${port}/near/owner-actions`,{method:'POST',headers:{'content-type':'application/json','x-redline-key':'test-only'},body:JSON.stringify({method:'deposit',amount:'1'})});
  assert.equal(denied.status,401);
  const legacy=await fetch(`http://127.0.0.1:${port}/grants`);assert.equal(legacy.status,404);
  const report={result:'PASS',scope:'actual compiled server entry point with CHAIN=near, public Testnet RPC identity and isolated Postgres',
    health,unauthenticatedOwnerAction:denied.status,legacyRoute:legacy.status,signingOrBroadcast:'NOT CONFIGURED / NOT RUN'};
  const text=JSON.stringify(report,null,2)+'\n';writeFileSync(new URL('../../docs/evidence/phase3-startup-smoke.json',import.meta.url),text);console.log(text);
}finally{
  if(child.pid&&child.exitCode===null&&child.signalCode===null){const closed=new Promise<void>(resolve=>child.once('close',()=>resolve()));child.kill();await closed;}
}
