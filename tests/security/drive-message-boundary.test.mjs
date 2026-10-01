import assert from 'node:assert/strict';
import test from 'node:test';
import {postToBridge} from '../../assets/js/integrations/drive/bridge/post-message-request.js';

const sandboxOrigin='https://n-bxf2muk7rmihub4iuwdqznurqcm6ax6w26p5jdy-0lu-script.googleusercontent.com';

function bridgeHarness(t){
  const listeners=new Map(),removed=[];
  const top={};top.parent=top;
  const outer={parent:top},sandbox={parent:outer},nested={parent:sandbox};
  const previous={window:globalThis.window,document:globalThis.document};
  globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  globalThis.document={body:{appendChild(){}},createElement:tag=>({
    contentWindow:tag==='iframe'?outer:null,
    setAttribute(){},appendChild(){},submit(){},remove(){removed.push(tag)}
  })};
  t.after(()=>Object.assign(globalThis,previous));
  const pending=postToBridge({requestId:'boundary-fixture',action:'UPLOAD'});
  const send=(origin=sandboxOrigin,source=nested,data={})=>listeners.get('message')?.({
    origin,source,data:{source:'ERP_EI_DRIVE_BRIDGE',requestId:'boundary-fixture',ok:true,file:{id:'fixture'},...data}
  });
  return {listeners,removed,outer,nested,top,pending,send};
}

test('Drive accepts the nested Apps Script callback and cleans up',async t=>{
  const h=bridgeHarness(t);h.send();
  assert.equal((await h.pending).file.id,'fixture');
  assert.equal(h.listeners.size,0);
  assert.deepEqual(h.removed,['form','iframe']);
});

test('Drive rejects unrelated windows even with the exact origin and request ID',async t=>{
  const h=bridgeHarness(t);
  h.send(sandboxOrigin,{parent:h.top});
  assert.equal(h.listeners.size,1);
  h.send();await h.pending;
});

test('Drive rejects broad Google hosts, unexpected ports and forged request IDs',async t=>{
  const h=bridgeHarness(t);
  for(const origin of [
    'https://attacker.googleusercontent.com','https://script.google.com:8443',
    `${sandboxOrigin}.attacker.test`,'null','https://script.google.com.attacker.test'
  ]){h.send(origin);assert.equal(h.listeners.size,1,origin)}
  h.send(sandboxOrigin,h.nested,{requestId:'another-request'});
  assert.equal(h.listeners.size,1);
  h.send();await h.pending;
});

test('Drive accepts a direct bridge error and releases the request',async t=>{
  const h=bridgeHarness(t);
  h.send('https://script.google.com',h.outer,{ok:false,error:'Fixture rejection'});
  await assert.rejects(h.pending,/Fixture rejection/);
  assert.equal(h.listeners.size,0);
});
