/* PACO Operational Assistant V11.37.0
 * Intenciones locales y tolerancia a errores ortográficos.
 * Sin dependencias de red: este módulo solo clasifica y extrae entidades.
 */

const INTENTS=[
  {
    id:"REGISTER_ACTIVITY",
    phrases:[
      "registrar actividad","registar actividad","registrar una actividad","agregar actividad",
      "crear actividad","iniciar actividad","empezar actividad","poner actividad",
      "quiero registrar trabajo","voy a hacer una actividad","anotar actividad"
    ]
  },
  {
    id:"ORDER_STATUS",
    phrases:[
      "donde va el pedido","en que va el pedido","estado del pedido","estado pedido",
      "buscar pedido","consultar pedido","ver pedido","como va el pedido",
      "que paso con el pedido","pedido numero"
    ]
  },
  {
    id:"MY_WORK",
    phrases:[
      "mi actividad","mi jornada","que estoy haciendo","cuanto llevo",
      "actividad actual","que actividad tengo","mi trabajo actual","estado de mi actividad"
    ]
  },
  {
    id:"OPERATION_ALERTS",
    phrases:[
      "alertas","que esta demorado","que esta retrasado","pedidos demorados",
      "pedidos en cola","cola demorada","que requiere atencion","que esta pasando",
      "resumen operativo","problemas operativos"
    ]
  },
  {
    id:"IDLE_TEAM",
    phrases:[
      "quien esta libre","quien esta desocupado","quien no tiene actividad",
      "auxiliares libres","auxiliares desocupados","personal libre","equipo disponible",
      "quien lleva sin hacer nada","tiempo desocupado"
    ]
  },
  {
    id:"LONG_ACTIVITY",
    phrases:[
      "actividad demorada","actividad retrasada","quien se esta demorando",
      "quien lleva mucho tiempo","actividades largas","persona demorada",
      "trabajo demorado","quien lleva mucho en actividad"
    ]
  },
  {
    id:"NOVELTIES",
    phrases:[
      "novedades","hay novedades","novedad pedido","pedidos con novedad",
      "problemas de pedidos","reportes abiertos","excepciones"
    ]
  },
  {
    id:"INVENTORY",
    phrases:[
      "inventario","stock","existencias","disponibilidad material",
      "buscar material","buscar referencia","cuanto hay","material disponible"
    ]
  },
  {
    id:"OPEN_WORKFORCE",
    phrases:["abrir jornada","ir a jornada","ver cronograma","abrir cronograma","ver actividades"]
  },
  {
    id:"OPEN_ORDERS",
    phrases:["abrir pedidos","ir a pedidos","ver lista de pedidos"]
  },
  {
    id:"HELP",
    phrases:["ayuda","que puedes hacer","que sabes hacer","como me ayudas","opciones"]
  }
];

const STOPWORDS=new Set([
  "el","la","los","las","un","una","de","del","al","a","en","por","para","con","mi","me",
  "yo","que","quiero","necesito","favor","porfavor","porfa"
]);

export function normalizeAssistantText(value){
  return String(value??"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9#._/\-\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

export function assistantIntent(input){
  const normalized=normalizeAssistantText(input);
  if(!normalized)return {id:"EMPTY",confidence:1,normalized};

  const orderRef=extractOrderReference(input);
  if(orderRef&&fuzzyAny(normalized,INTENTS.find(x=>x.id==="ORDER_STATUS").phrases,0.52)){
    return {id:"ORDER_STATUS",confidence:.98,normalized,orderRef};
  }

  let best={id:"UNKNOWN",confidence:0,normalized};
  for(const intent of INTENTS){
    let score=0;
    for(const phrase of intent.phrases)score=Math.max(score,phraseScore(normalized,phrase));
    if(score>best.confidence)best={id:intent.id,confidence:score,normalized};
  }

  if(orderRef&&best.confidence<.58)return {id:"ORDER_STATUS",confidence:.80,normalized,orderRef};

  const threshold=best.id==="INVENTORY"?.52:.58;
  if(best.confidence<threshold)return {id:"UNKNOWN",confidence:best.confidence,normalized};

  if(best.id==="ORDER_STATUS")best.orderRef=orderRef;
  if(best.id==="INVENTORY")best.searchTerm=extractInventoryTerm(input);
  return best;
}

export function extractOrderReference(input){
  const raw=String(input||"").trim();
  const explicit=raw.match(/(?:pedido|orden)\s*(?:(?:numero|n[uú]mero|nro|no)\.?|#)?\s*[:\-]?\s*([a-z0-9][a-z0-9._/\-]{2,})/i);
  if(explicit?.[1]&&!/^(?:esta|este|ese|eso|con|sin|que)$/i.test(explicit[1]))return explicit[1];

  const tokens=raw.match(/[a-z0-9][a-z0-9._/\-]*/gi)||[];
  return tokens.find(token=>/\d/.test(token)&&token.length>=3)||null;
}

export function extractInventoryTerm(input){
  const raw=String(input||"").trim();
  const explicit=raw.match(/(?:inventario|stock|material|referencia|ref(?:erencia)?)\s*(?:de|del|para|#|:|-)?\s*([a-z0-9][a-z0-9._/\-]{1,})/i);
  if(explicit?.[1]&&!/^(?:hay|de|del|para|disponible)$/i.test(explicit[1]))return explicit[1];

  const normalized=normalizeAssistantText(input);
  const words=normalized.split(" ").filter(word=>word.length>2&&!STOPWORDS.has(word));
  const generic=new Set(["inventario","stock","material","referencia","existencias","buscar","disponibilidad","disponible","cuanto","hay"]);
  return words.find(word=>!generic.has(word))||"";
}

export function matchesAssistantPhrase(input,phrase){
  return phraseScore(normalizeAssistantText(input),phrase)>=.58;
}

export function editDistance(a,b){
  const x=normalizeAssistantText(a);
  const y=normalizeAssistantText(b);
  if(x===y)return 0;
  if(!x.length)return y.length;
  if(!y.length)return x.length;

  const prev=Array.from({length:y.length+1},(_,i)=>i);
  const curr=new Array(y.length+1);

  for(let i=1;i<=x.length;i++){
    curr[0]=i;
    for(let j=1;j<=y.length;j++){
      const cost=x[i-1]===y[j-1]?0:1;
      curr[j]=Math.min(
        curr[j-1]+1,
        prev[j]+1,
        prev[j-1]+cost
      );
      if(i>1&&j>1&&x[i-1]===y[j-2]&&x[i-2]===y[j-1]){
        curr[j]=Math.min(curr[j],(j>1?prev[j-2]:i-2)+1);
      }
    }
    for(let j=0;j<=y.length;j++)prev[j]=curr[j];
  }

  return prev[y.length];
}

function fuzzyAny(normalized,phrases,threshold){
  return phrases.some(phrase=>phraseScore(normalized,phrase)>=threshold);
}

function phraseScore(normalized,phrase){
  const target=normalizeAssistantText(phrase);
  if(!target)return 0;
  if(normalized===target)return 1;
  if(normalized.includes(target))return .97;

  const inputTokens=meaningfulTokens(normalized);
  const phraseTokens=meaningfulTokens(target);
  if(!phraseTokens.length)return 0;

  let matched=0;
  let exact=0;
  for(const expected of phraseTokens){
    let best=0;
    for(const actual of inputTokens){
      const score=wordSimilarity(actual,expected);
      if(score>best)best=score;
    }
    matched+=best;
    if(best===1)exact+=1;
  }

  const coverage=matched/phraseTokens.length;
  const exactRatio=exact/phraseTokens.length;
  const lengthPenalty=inputTokens.length>phraseTokens.length*3?.08:0;
  return Math.max(0,Math.min(1,coverage*.82+exactRatio*.18-lengthPenalty));
}

function meaningfulTokens(value){
  return normalizeAssistantText(value)
    .split(" ")
    .filter(Boolean)
    .filter(token=>!STOPWORDS.has(token));
}

function wordSimilarity(actual,expected){
  if(actual===expected)return 1;
  if(actual.startsWith(expected)||expected.startsWith(actual)){
    const ratio=Math.min(actual.length,expected.length)/Math.max(actual.length,expected.length);
    if(ratio>=.72)return .90;
  }

  const distance=editDistance(actual,expected);
  const length=Math.max(actual.length,expected.length);
  const tolerance=length>=9?2:length>=5?1:0;
  if(distance<=tolerance)return Math.max(.72,1-distance/Math.max(1,length));

  return 0;
}
