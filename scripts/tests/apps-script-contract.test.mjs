import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {readAppsScriptSource} from './read-apps-script-source.mjs';

const source=process.env.CRM_GAS_REFERENCE?fs.readFileSync(process.env.CRM_GAS_REFERENCE,'utf8'):readAppsScriptSource();
function runtime(authStatus=200){
  const events=[];
  const file={getId:()=> 'file-fixture',getName:()=> 'imagen.png',getUrl:()=> 'https://drive.google.com/file-fixture',
    setDescription:text=>events.push(['description',text]),setSharing:()=>events.push(['sharing'])};
  const folder=name=>({getId:()=>name,getFoldersByName:()=>({hasNext:()=>false}),
    createFolder:child=>{events.push(['folder',child]);return folder(child);},
    createFile:blob=>{events.push(['file',blob.name]);return file;}});
  const context=vm.createContext({console,URL,encodeURIComponent,Date,
    DriveApp:{getFolderById:()=>folder('root')},
    LockService:{getScriptLock:()=>({waitLock:ms=>events.push(['lock',ms]),releaseLock:()=>events.push(['unlock'])})},
    Utilities:{base64Decode:value=>Array.from(Buffer.from(value,'base64')),newBlob:(bytes,mimeType,name)=>({bytes,mimeType,name})},
    HtmlService:{createHtmlOutput:text=>({text,setTitle(){return this;},setXFrameOptionsMode(){return this;}}),XFrameOptionsMode:{ALLOWALL:'ALLOWALL'}},
    UrlFetchApp:{fetch:(url,options)=>{
      events.push(['auth',url,options.headers.Authorization]);
      return {getResponseCode:()=>authStatus,getContentText:()=>JSON.stringify({profile:{id:'profile-fixture'}})};
    }}
  });
  new vm.Script(source).runInContext(context);
  return {context,events};
}

test('Drive upload preserves private storage, lock lifecycle and response contract',()=>{
  const {context,events}=runtime();
  const request={dataBase64:'YWJj',fileName:'imagen.png',mimeType:'image/png',orderId:'order-fixture',orderNumber:'PVC-FIXTURE',category:'EVIDENCE'};
  const session={profile:{id:'profile-fixture',name:'Persona sintética',email:'fixture@example.invalid'}};
  const result=context.saveFile_(request,session);
  assert.equal(result.id,'file-fixture');
  assert.equal(result.size,3);
  assert.equal(result.mimeType,'image/png');
  assert.equal(result.ownerMode,'INSTITUTIONAL_APPS_SCRIPT');
  assert.equal(result.uploadedByProfileId,'profile-fixture');
  assert.equal(events.filter(e=>e[0]==='sharing').length,0);
  assert.equal(events.filter(e=>e[0]==='lock').length,1);
  assert.equal(events.filter(e=>e[0]==='unlock').length,1);
  assert.ok(events.some(e=>e[0]==='folder'&&e[1]==='PEDIDO_PVC-FIXTURE'));
  assert.ok(events.find(e=>e[0]==='description')[1].includes('Contexto: order-fixture'));
});

test('POST validates the ERP session before creating any Drive file',()=>{
  const request={requestId:'post-fixture',accessToken:'fixture-session',origin:'https://crm-suministros-amber.vercel.app',
    orderId:'order-fixture',fileName:'imagen.png',dataBase64:'YWJj',mimeType:'image/png',sizeBytes:3};
  const denied=runtime(401);
  const rejection=denied.context.doPost({parameter:{payload:JSON.stringify(request)}});
  assert.match(rejection.text,/sesión del ERP venció/);
  assert.equal(denied.events.filter(e=>e[0]==='file').length,0);
  const allowed=runtime();
  allowed.context.doPost({parameter:{payload:JSON.stringify(request)}});
  assert.equal(allowed.events.filter(e=>e[0]==='file').length,1);
  assert.equal(allowed.events.find(e=>e[0]==='auth')[2],'Bearer fixture-session');
});

test('activity folders and identities remain separate from order folders',()=>{
  const {context,events}=runtime();
  context.saveFile_({dataBase64:'YWJj',fileName:'imagen.png',mimeType:'image/png',workExecutionId:'activity-fixture',workTitle:'Trabajo sintético'}, {profile:{id:'profile-fixture'}});
  assert.ok(events.some(e=>e[0]==='folder'&&e[1]==='ACTIVIDAD_Trabajo sintético'));
  assert.ok(events.find(e=>e[0]==='description')[1].includes('Actividad: Trabajo sintético'));
});

test('envelope/file validation and callback response keep their contracts',()=>{
  const {context}=runtime();
  assert.throws(()=>context.validateEnvelope_({requestId:'fixture'}),/sesión del ERP/);
  assert.throws(()=>context.validateUploadRequest_({orderId:'fixture',fileName:'unsafe.html',dataBase64:'eA==',sizeBytes:1,mimeType:'text/html'}),/no está permitido/);
  const callback=context.callbackPage_({requestId:'fixture',origin:'https://crm-suministros-amber.vercel.app'},{ok:true});
  assert.match(callback.text,/ERP_EI_DRIVE_BRIDGE/);
  assert.match(callback.text,/window\.top/);
  assert.match(callback.text,/window\.parent/);
  assert.match(context.doGet().text,/3\.5\.1/);
});
