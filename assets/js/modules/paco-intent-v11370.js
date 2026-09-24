const INTENTS=[
  {id:"REGISTER_ACTIVITY",phrases:[
    "registrar actividad","registar actividad","registrar actvidad","iniciar actividad",
    "empezar actividad","nueva actividad","voy a hacer una actividad","quiero registrar trabajo",
    "anotar actividad","crear actividad"
  ]},
  {id:"ORDER_STATUS",phrases:[
    "donde va el pedido","donde esta el pedido","en que parte va el pedido","estado del pedido",
    "buscar pedido","consultar pedido","ver pedido","revisar pedido","por donde va el pedido",
    "pedido demorado","pedido bloqueado","pedido no avanza"
  ]},
  {id:"MY_DAY",phrases:[
    "mi jornada","que estoy haciendo","actividad actual","mi actividad","como va mi jornada",
    "que tengo hoy","mis actividades"
  ]},
  {id:"ALERTS",phrases:[
    "novedades","alertas","que esta pasando","que pasa en la operacion","pendientes",
    "pedidos demorados","quien esta desocupado","personas desocupadas","cola"
  ]},
  {id:"HELP",phrases:[
    "que puedes hacer","ayuda","ayudame","como funcionas","que haces"
  ]},
  {id:"GREETING",phrases:["hola","buenas","hey","paco","buen dia","buenas tardes"]}
];

export function normalizePacoText(value){
  return String(value||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9#._/\-\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

export function extractOrderTerm(input){
  const raw=String(input||"");
  const explicit=raw.match(/(?:pedido|orden)\s*(?:#|numero|n[úu]mero|no\.?|nro\.?|:)?\s*([A-Za-z0-9][A-Za-z0-9._/-]{2,})/i)?.[1];
  if(explicit&&!/^(bloqueado|atascado|pendiente|demorado|que|como|donde|esta)$/i.test(explicit))return explicit;
  return raw.match(/\b[A-Za-z]{1,8}[-_]\d{2,}[A-Za-z0-9-]*\b/)?.[0]
    ||raw.match(/\b\d{4,}\b/)?.[0]
    ||"";
}

export function classifyPacoIntent(input){
  const text=normalizePacoText(input);
  if(!text)return {id:"EMPTY",score:1,text};

  const order=extractOrderTerm(input);
  if(order&&/(pedido|orden|donde|estado|buscar|consultar|revisar|va)/.test(text)){
    return {id:"ORDER_STATUS",score:1,text,order};
  }

  let best={id:"UNKNOWN",score:0,text};
  for(const intent of INTENTS){
    for(const phrase of intent.phrases){
      const score=phraseScore(text,normalizePacoText(phrase));
      if(score>best.score)best={id:intent.id,score,text,phrase};
    }
  }

  if(best.score<0.58)return {id:"UNKNOWN",score:best.score,text};
  return best;
}

export function rankActivityCatalog(input,catalog=[],limit=6){
  const query=normalizePacoText(input)
    .replace(/\b(registrar|registar|iniciar|empezar|actividad|trabajo|quiero|voy|hacer|una|un)\b/g," ")
    .replace(/\s+/g," ")
    .trim();

  const rows=(Array.isArray(catalog)?catalog:[])
    .filter(item=>item?.activityKind==="ACTIVITY");

  if(!query)return rows.slice(0,limit).map(item=>({item,score:0}));

  return rows
    .map(item=>{
      const fields=[
        item.name,
        item.code,
        item.uiCategoryLabel,
        item.uiCategory,
        item.uiSubcategory,
        item.activityGroup,
        item.description
      ].filter(Boolean).map(normalizePacoText);

      const score=Math.max(...fields.map(field=>fieldScore(query,field)),0);
      return {item,score};
    })
    .filter(row=>row.score>=0.46)
    .sort((a,b)=>b.score-a.score||String(a.item.name).localeCompare(String(b.item.name),"es"))
    .slice(0,limit);
}

export function fuzzyIncludes(input,target,threshold=0.68){
  const text=normalizePacoText(input);
  const wanted=normalizePacoText(target);
  if(!text||!wanted)return false;
  return phraseScore(text,wanted)>=threshold;
}

function phraseScore(text,phrase){
  if(text===phrase)return 1;
  if(text.includes(phrase))return 0.97;

  const source=text.split(" ").filter(Boolean);
  const target=phrase.split(" ").filter(Boolean);
  if(!source.length||!target.length)return 0;

  let total=0;
  for(const wanted of target){
    let best=0;
    for(const token of source)best=Math.max(best,wordSimilarity(token,wanted));
    total+=best;
  }

  const coverage=total/target.length;
  const lengthPenalty=Math.min(1,target.length/Math.max(target.length,source.length));
  return coverage*0.86+lengthPenalty*0.14;
}

function fieldScore(query,field){
  if(!field)return 0;
  if(field===query)return 1;
  if(field.includes(query))return 0.96;
  if(query.includes(field)&&field.length>=4)return 0.9;
  return phraseScore(query,field);
}

function wordSimilarity(a,b){
  if(a===b)return 1;
  if(a.includes(b)||b.includes(a))return Math.min(a.length,b.length)/Math.max(a.length,b.length)*0.92+0.08;
  const distance=levenshtein(a,b);
  return 1-distance/Math.max(a.length,b.length,1);
}

function levenshtein(a,b){
  const x=String(a),y=String(b);
  const prev=Array.from({length:y.length+1},(_,i)=>i);
  const curr=new Array(y.length+1);

  for(let i=1;i<=x.length;i++){
    curr[0]=i;
    for(let j=1;j<=y.length;j++){
      curr[j]=Math.min(
        curr[j-1]+1,
        prev[j]+1,
        prev[j-1]+(x[i-1]===y[j-1]?0:1)
      );
    }
    for(let j=0;j<=y.length;j++)prev[j]=curr[j];
  }
  return prev[y.length];
}
