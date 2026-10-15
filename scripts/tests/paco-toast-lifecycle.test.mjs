import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');

function harness(code){
 const shown=[],badges=[],voices=[],timers=[],stack={
  children:[],
  replaceChildren(...items){this.children=items},
 };
 const paco={root:{querySelector:selector=>selector==='[data-paco-toast-stack]'?stack:null},alertMemory:new Map()};
 const document={
  createElement:()=>({type:'',className:'',innerHTML:'',onclick:null,remove(){stack.children=stack.children.filter(item=>item!==this)}})
 };
 const script=code.replace(/^import .*;\s*$/gm,'').replace(/export function /g,'function ');
 const evaluate=new Function('ALERT_COOLDOWN_MS','PACO_TOAST_DURATION_MS','paco','message','add',
  'isOpen','setBadge','esc','speak','document','setTimeout','setOpen',
  script+';return {showProactive,alertAllowed};');
 const methods=evaluate(30*60*1000,6000,paco,payload=>payload,item=>shown.push(item),
  ()=>false,count=>badges.push(count),s=>String(s),s=>voices.push(s),document,
  (fn,delay)=>{timers.push({fn,delay})},()=>{});
 return {methods,stack,shown,badges,voices,timers,paco};
}

test('las tarjetas de PACO duran seis segundos y nunca se apilan',async()=>{
 const p=harness(await source('assets/js/domains/paco/alerts/proactive.js'));
 for(let n=0;n<3;n++)p.methods.showProactive({title:'20 min sin actividad',text:'Ejemplo '+n,voice:false});
 assert.equal(p.shown.length,3,'los mensajes permanecen consultables en PACO');
 assert.equal(p.badges.length,3);
 assert.equal(p.stack.children.length,1,'solo una tarjeta superpuesta');
 assert.match(p.stack.children[0].innerHTML,/Ejemplo 2/);
 assert.equal(p.timers.length,3);
 assert.ok(p.timers.every(item=>item.delay===6000));
 for(const timer of p.timers)timer.fn();
 assert.equal(p.stack.children.length,0,'el aviso se retira del DOM');
});

test('alertas informativas sin tarjeta siguen dentro de PACO',async()=>{
 const p=harness(await source('assets/js/domains/paco/alerts/proactive.js'));
 p.methods.showProactive({title:'Inactividad',text:'Equipo disponible',voice:false,showToast:false});
 assert.equal(p.stack.children.length,0);
 assert.equal(p.shown.length,1);
 assert.equal(p.badges.length,1);
 assert.equal(p.timers.length,0);
});

test('ventanas de repetición para inactividad y protección de avisos críticos',async()=>{
 const p=harness(await source('assets/js/domains/paco/alerts/proactive.js'));
 const {alertAllowed}=p.methods;
 assert.equal(alertAllowed('idle:one',2*60*60*1000),true);
 assert.equal(alertAllowed('idle:one',2*60*60*1000),false);
 p.paco.alertMemory.set('idle:one',Date.now()-40*60*1000);
 assert.equal(alertAllowed('idle:one',2*60*60*1000),false,'no regresar cada media hora');
 assert.equal(alertAllowed('order:two'),true);
 assert.equal(alertAllowed('order:two'),false);
 const monitor=await source('assets/js/domains/paco/alerts/monitor.js');
 assert.match(monitor,/alertAllowed\(key,IDLE_ALERT_COOLDOWN_MS\)/);
 assert.match(monitor,/showToast:!initial&&index===0/);
 assert.match(monitor,/title:"Pedido demorado"/);
 const config=await source('assets/js/domains/paco/paco-config.js');
 assert.match(config,/PACO_TOAST_DURATION_MS=6000/);
 assert.match(config,/IDLE_ALERT_COOLDOWN_MS=2\*60\*60\*1000/);
});
