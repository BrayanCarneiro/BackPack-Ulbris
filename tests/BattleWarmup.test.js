import test from 'node:test';
import assert from 'node:assert/strict';
import { PendingBattleTextureFile } from '../src/utils/battleWarmup.js';

function loaderStub() {
  const files = new Set(), completed = [];
  const loader = {path:'assets/',prefix:'',isLoading:()=>true,
    queue:{contains:file=>files.has(file)},fileProcessComplete:file=>completed.push(file)};
  return {loader,files,completed};
}

test('foreground loader joins a pending texture and only completes when it settles', async () => {
  const {loader,files,completed}=loaderStub();
  let finish;
  const job=new Promise(resolve=>{finish=resolve;});
  const file=new PendingBattleTextureFile(loader,'arthur-battle-body',job);
  files.add(file);file.onProcess();
  assert.equal(completed.length,0);
  finish();await job;await Promise.resolve();
  assert.deepEqual(completed,[file]);
});

test('background failure releases the foreground loader for PNG fallback', async () => {
  const {loader,files,completed}=loaderStub();
  let fail;
  const job=new Promise((_,reject)=>{fail=reject;});
  const file=new PendingBattleTextureFile(loader,'arthur-battle-body',job);
  files.add(file);file.onProcess();
  fail(new Error('Offline'));await job.catch(()=>{});await Promise.resolve();
  assert.deepEqual(completed,[file]);
});

test('a stopped loader is not revived by a late background image', async () => {
  const {loader,files,completed}=loaderStub();
  let finish;
  const job=new Promise(resolve=>{finish=resolve;});
  const file=new PendingBattleTextureFile(loader,'arthur-battle-body',job);
  files.add(file);file.onProcess();loader.isLoading=()=>false;
  finish();await job;await Promise.resolve();
  assert.equal(completed.length,0);
  assert.equal(file.loader,null);
});
