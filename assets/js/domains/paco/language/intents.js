import { normalizePacoText } from "./normalize.js";
import { editDistance, fuzzyPhrase, matchesAny } from "./fuzzy-match.js";
import { INTENT_ALIASES, anchorScore } from "./aliases.js";

export function intentAliasScore(text,alias){
  const normalized=normalizePacoText(text),candidate=normalizePacoText(alias);
  if(!normalized||!candidate)return 0;
  if(normalized===candidate)return 1000+candidate.length;
  if(normalized.includes(candidate))return 900+candidate.length;
  if(candidate.includes(normalized)&&normalized.length>=5)return 780+normalized.length;
  if(!fuzzyPhrase(normalized,candidate))return 0;
  const words=normalized.split(" ").filter(Boolean);
  const targets=candidate.split(" ").filter(Boolean);
  let exact=0;
  let similarity=0;
  for(const target of targets){
    let best=0;
    for(const word of words){
      if(word===target){best=1;break}
      const max=Math.max(word.length,target.length);
      if(max)best=Math.max(best,1-editDistance(word,target)/max);
    }
    if(best===1)exact++;
    similarity+=Math.max(0,best);
  }
  const average=targets.length?similarity/targets.length:0;
  return 500+exact*35+Math.round(average*100)+candidate.length/10;
}

export function detectPacoIntent(text){
  const normalized=normalizePacoText(text);
  if(!normalized)return null;
  let bestIntent=null,bestScore=0;
  for(const [intent,aliases] of Object.entries(INTENT_ALIASES)){
    let score=anchorScore(intent,normalized);
    for(const alias of aliases)score=Math.max(score,intentAliasScore(normalized,alias));
    if(score>bestScore){bestIntent=intent;bestScore=score}
  }
  return bestScore>=500?bestIntent:null;
}

export function isCancelText(text){
  return matchesAny(normalizePacoText(text),[
    "cancelar","cancelar consulta","cancelar esto","salir","olvidalo","dejar asi","parar consulta","abortar","me equivoque","no era eso"
  ]);
}

export function isRestartText(text){
  return matchesAny(normalizePacoText(text),[
    "reiniciar","reiniciar paco","reinicar paco","empezar de nuevo","volver a empezar","nueva consulta","borrar consulta","comenzar otra vez","borra y empieza otra vez"
  ]);
}
