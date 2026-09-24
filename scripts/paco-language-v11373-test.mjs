import assert from "node:assert/strict";
import {
  normalizePacoText,
  detectPacoIntent,
  matchCrmModule,
  INTENT_ALIASES,
  CRM_MODULE_KNOWLEDGE,
  isCancelText,
  isRestartText
} from "../assets/js/modules/paco-language-v11373.js";

let checks=0;
function eq(actual,expected,label){
  checks++;
  assert.equal(actual,expected,label);
}

// 1) Todo alias productivo debe seguir clasificando correctamente.
for(const [intent,aliases] of Object.entries(INTENT_ALIASES)){
  for(const phrase of aliases)eq(detectPacoIntent(phrase),intent,`Intent ${intent}: ${phrase}`);
}

// 2) Errores y abreviaciones reales de chat/operación.
const noisyIntentCases=[
  ["q pedios estan demroados","delayed"],
  ["cuales peddo estan atrasdo","delayed"],
  ["q lleva mas tienpo en cola","delayed"],
  ["mostrame los pedios pegados","delayed"],
  ["peddo demorado","delayed"],
  ["q pedidos no tienn responzable","unassigned"],
  ["pedios sin encagado","unassigned"],
  ["cuales estan sin asiganr","unassigned"],
  ["nadie tien el peddo","unassigned"],
  ["qn esta desocpado","idle"],
  ["q auxiliar esta libre","idle"],
  ["qn no esta asiendo nada","idle"],
  ["auxliar sin actvidad","idle"],
  ["personal disponble","idle"],
  ["qn lleva rato sin acer nada","idle"],
  ["q esta asiendo juan","team"],
  ["q ase el auxliar","team"],
  ["en q anda juan","team"],
  ["actividad d juan","team"],
  ["q estan asiendo","team"],
  ["qn sta trabajando","team"],
  ["qn termino","recentWork"],
  ["q activdades terminaron","recentWork"],
  ["qn ya finalizo actvidad","recentWork"],
  ["q acabaron oy","recentWork"],
  ["q se despcaho","shipped"],
  ["q pedios salieron","shipped"],
  ["ultmos despachos","shipped"],
  ["q se envio oy","shipped"],
  ["q entregaron","shipped"],
  ["q novedades ai","novelties"],
  ["ai blokqueos","novelties"],
  ["q problemas ai","novelties"],
  ["exepciones abiertas","novelties"],
  ["pedios blokqeados","novelties"],
  ["resumne operacoin","operation"],
  ["dame un resumn","operation"],
  ["como va todoo","operation"],
  ["q esta pasando en operacoin","operation"],
  ["parte operatibo","operation"],
  ["resumen aora","operation"],
  ["q estoy asiendo","myDay"],
  ["q actvidad tngo","myDay"],
  ["mi jornad","myDay"],
  ["q tngo activo","myDay"],
  ["mi tarea atual","myDay"],
  ["registar actvidad","activity"],
  ["registrr actividad","activity"],
  ["meter actvidad","activity"],
  ["voi a acer una actividad","activity"],
  ["anotar lo q ago","activity"],
  ["empezar tarea","activity"],
  ["qiero registrar actvidad","activity"],
  ["activdad nueva","activity"],
  ["qn lleva mucho tienpo","longWork"],
  ["actvidad muy larga","longWork"],
  ["qn lleva mas d una ora","longWork"],
  ["tarea prolongda","longWork"],
  ["q puedes acer","capabilities"],
  ["como m ayudas","capabilities"],
  ["q sabe acer paco","capabilities"],
  ["pa q sirves","capabilities"],
  ["funcioens paco","capabilities"],
  ["dnde va el peddo","order"],
  ["en q parte va pedido","order"],
  ["qn tiene el peddo","order"],
  ["por dnde va la orden","order"],
  ["rastrear pedio","order"],
  ["ubicacoin pedido","order"],
  ["estado del peddo","order"]
];
for(const [phrase,intent] of noisyIntentCases)eq(detectPacoIntent(phrase),intent,`Noisy intent ${intent}: ${phrase}`);

// 3) Variaciones mecánicas para simular tecleo rápido.
function swapMiddle(value){
  const words=value.split(" ");
  const idx=words.findIndex(word=>word.length>=7);
  if(idx<0)return value;
  const word=words[idx],i=Math.max(1,Math.floor(word.length/2)-1);
  words[idx]=word.slice(0,i)+word[i+1]+word[i]+word.slice(i+2);
  return words.join(" ");
}
function dropMiddle(value){
  const words=value.split(" ");
  const idx=words.findIndex(word=>word.length>=8);
  if(idx<0)return value;
  const word=words[idx],i=Math.floor(word.length/2);
  words[idx]=word.slice(0,i)+word.slice(i+1);
  return words.join(" ");
}
const mutationSeeds=[
  ["registrar actividad","activity"],
  ["pedidos demorados","delayed"],
  ["quien esta desocupado","idle"],
  ["quien termino actividad","recentWork"],
  ["pedidos despachados","shipped"],
  ["que novedades hay","novelties"],
  ["resumen operativo","operation"],
  ["mi actividad actual","myDay"],
  ["que esta haciendo el equipo","team"],
  ["pedidos sin responsable","unassigned"],
  ["actividad prolongada","longWork"],
  ["que puedes hacer","capabilities"],
  ["donde va el pedido","order"]
];
for(const [phrase,intent] of mutationSeeds){
  eq(detectPacoIntent(swapMiddle(phrase)),intent,`Swap typo ${intent}: ${swapMiddle(phrase)}`);
  eq(detectPacoIntent(dropMiddle(phrase)),intent,`Drop typo ${intent}: ${dropMiddle(phrase)}`);
}

// 3.1) Mutaciones sistemáticas sobre TODO el vocabulario entrenado.
for(const [intent,aliases] of Object.entries(INTENT_ALIASES)){
  for(const phrase of aliases){
    const swapped=swapMiddle(phrase);
    if(swapped!==phrase)eq(detectPacoIntent(swapped),intent,`All-alias swap ${intent}: ${swapped}`);
    const dropped=dropMiddle(phrase);
    if(dropped!==phrase)eq(detectPacoIntent(dropped),intent,`All-alias drop ${intent}: ${dropped}`);
  }
}

// 4) Conocimiento de los 20 módulos del CRM.
for(const [id,info] of Object.entries(CRM_MODULE_KNOWLEDGE)){
  for(const alias of info.aliases){
    const hit=matchCrmModule(alias);
    eq(hit?.id,id,`Module ${id}: ${alias}`);
  }
}

const noisyModuleCases=[
  ["abre el dashbord","dashboard"],
  ["quiero ver pedios","orders"],
  ["modulo d ventass","sales"],
  ["solicitud d credtio","credit"],
  ["revisar cartra","cartera"],
  ["ir a cja y pagos","caja"],
  ["abrir comprs","purchasing"],
  ["como va la resepcion","receiving"],
  ["ir a alistamieto","picking"],
  ["centro d cortte","cutting"],
  ["abrir facturacoin","billing"],
  ["ver despcaho y entregas","shipping"],
  ["revisar inbentario","inventory"],
  ["abrir crongrama d activdades","workforce"],
  ["ver exepciones y aprovaciones","approvals"],
  ["ver fluho y tienpos","vsm"],
  ["abrir reprotes e indicadores","reports"],
  ["ver historcio","imports"],
  ["abrir audtoria","audit"],
  ["gestionar usarios y roles","admin"]
];
for(const [phrase,id] of noisyModuleCases)eq(matchCrmModule(phrase)?.id,id,`Noisy module ${id}: ${phrase}`);

// 4.1) PACO debe entender cada módulo dentro de frases conversacionales, no solo el nombre aislado.
const navigationPrefixes=["abre ","quiero ver ","llevame a ","necesito revisar "];
for(const [id,info] of Object.entries(CRM_MODULE_KNOWLEDGE)){
  for(const alias of info.aliases){
    for(const prefix of navigationPrefixes){
      eq(matchCrmModule(prefix+alias)?.id,id,`Module sentence ${id}: ${prefix+alias}`);
    }
    const swapped=swapMiddle(alias);
    if(swapped!==alias)eq(matchCrmModule("abre "+swapped)?.id,id,`Module typo ${id}: ${swapped}`);
  }
}

// 5) Comandos de recuperación de contexto.
for(const phrase of ["cancelar","canselar consulta","cancelr consulta","olvidalo","dejar asi","parar consulta","me equivoque","no era eso"])eq(isCancelText(phrase),true,`Cancel: ${phrase}`);
for(const phrase of ["reiniciar","reiniciar paco","reinicar paco","empezar de nuevo","nueba consulta","volver a empezar","borra y empieza otra vez"])eq(isRestartText(phrase),true,`Restart: ${phrase}`);

// 6) Normalización de escritura casual.
eq(normalizePacoText("Q ESTA ASIENDO JUAN?"),"que esta haciendo juan","normalize q/asiendo");
eq(normalizePacoText("DNDE VA EL PEDDO"),"donde va el pedido","normalize dnde/peddo");
eq(normalizePacoText("REGISTAR ACTVIDAD"),"registar actividad","normalize activity typo");
eq(normalizePacoText("REVISAR INBENTARIO"),"revisar inventario","normalize inventory typo");

console.log(`PACO language training V11.37.3: ${checks} checks OK`);
