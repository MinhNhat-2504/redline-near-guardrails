import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { NearReadOnlyRpc, parseRpcJson } from "../src/near/rpc.js";
import { FinalAccessProvider } from "../src/near/auth.js";
import { observeVaultTransaction } from "../src/near/receipts.js";
import { broadcastPrepared } from "../src/near/broadcast.js";
import { grantSchema } from "../src/near/types.js";
import { prepareExecutor } from "../scripts/prepare-near-executor.js";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const fixture = (n: string) => JSON.parse(readFileSync(new URL(`../../docs/evidence/phase2-${n}.json`, import.meta.url), "utf8")).result;

describe("finalized key ownership transport and exact nonce", () => {
  it("preserves a JSON u64 nonce at maximum, before IEEE-754 rounding", () => {
    expect(parseRpcJson('{"nonce":18446744073709551615,"block_height":42}')).toEqual({ nonce: "18446744073709551615", block_height: 42 });
    expect(parseRpcJson('{"nonce":9007199254740993}')).toEqual({ nonce: "9007199254740993" });
  });
  it("forces finalized key queries even when caller requested optimistic", async () => {
    const calls: Record<string, unknown>[] = [];
    const fake = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body=JSON.parse(String(init?.body));calls.push(body);
      if(body.method==='status') return Response.json({jsonrpc:'2.0',id:body.id,result:{chain_id:'testnet',sync_info:{syncing:false}}});
      return new Response('{"jsonrpc":"2.0","id":"'+body.id+'","result":{"nonce":18446744073709551615,"permission":"FullAccess","block_height":42,"block_hash":"'+fixture('final-grant').block_hash+'"}}');
    }) as unknown as typeof fetch;
    const rpc=new NearReadOnlyRpc(undefined,fake);
    const provider=new FinalAccessProvider({url:'https://rpc.testnet.near.org'},rpc);
    const key=await provider.viewAccessKey({accountId:'owner.testnet',publicKey:'ed25519:public',finalityQuery:{finality:'optimistic'}});
    expect(key.nonce).toBe((1n<<64n)-1n);
    expect(calls[1].params).toMatchObject({request_type:'view_access_key',finality:'final',account_id:'owner.testnet'});
  });
});

describe("owner receipt observations from recorded public Testnet data", () => {
  it.each([['owner-storage','CONFIRMED'],['agent-storage','CONFIRMED'],['owner-deposit','CONFIRMED'],['grant-created','CONFIRMED'],['revoke','CONFIRMED'],['withdraw','SETTLED']])('%s -> %s',(name,state)=>{
    const tx=fixture(name);expect(observeVaultTransaction(tx,'nhat-redline-vault.testnet',tx.transaction.hash,tx.transaction.signer_id).state).toBe(state);
  });
  it("refuses a withdrawal callback attributed to another owner",()=>{
    const tx=fixture('withdraw');
    for(const r of tx.receipts_outcome) r.outcome.logs=r.outcome.logs.map((s:string)=>s.replaceAll('nhat-redline-owner.testnet','stranger.testnet'));
    expect(observeVaultTransaction(tx,'nhat-redline-vault.testnet',tx.transaction.hash,tx.transaction.signer_id).state).toBe('UNKNOWN');
  });
  it("rejects inconsistent grant reservation data",()=>{
    const g=JSON.parse(Buffer.from(fixture('final-grant').result).toString());
    g.pending_reserved=g.policy.spend_cap;expect(()=>grantSchema.parse(g)).toThrow();
  });
});

describe("bounded persisted-packet broadcast transport (mock fetch, no chain submission)",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it("sends the supplied packet once with INCLUDED and no redirect",async()=>{
    const fake=vi.fn(async(_url:unknown,init?:RequestInit)=>{
      expect(JSON.parse(String(init?.body))).toMatchObject({method:'send_tx',params:{signed_tx_base64:'test-packet',wait_until:'INCLUDED'}});
      expect(init?.redirect).toBe('error');expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json({jsonrpc:'2.0',id:'redline-prepared',result:{final_execution_status:'INCLUDED'}});
    });vi.stubGlobal('fetch',fake);
    await broadcastPrepared('https://rpc.testnet.near.org','test-packet');expect(fake).toHaveBeenCalledTimes(1);
  });
  it("leaves rejected or mismatched responses uncertain",async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'wrong',result:{}})));
    await expect(broadcastPrepared('https://rpc.testnet.near.org','test-packet')).rejects.toThrow();
  });
});

describe('local executor candidate helper (temporary test directory only)',()=>{
  it('never overwrites a generated key on retry and returns only public metadata',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'redline-near-key-test-'));
    try{
      const first=await prepareExecutor(directory);const before=await readFile(first.credentialPath,'utf8');
      const again=await prepareExecutor(directory);
      expect(again).toEqual(first);expect(await readFile(first.credentialPath,'utf8')).toBe(before);
      expect(first).not.toHaveProperty('private_key');expect(first.publicKey.startsWith('ed25519:')).toBe(true);
      expect(JSON.parse(before)).toMatchObject({account_id:first.accountId,public_key:first.publicKey});
    }finally{await unlink(join(directory,'public.json'));await unlink(join(directory,'executor.json'));await rmdir(directory);}
  });
});
