import { normalizePacoText as norm } from "../language/index.js";
import { paco } from "../paco-state.js";
import { esc } from "../context/profile-context.js";

export const MALE_VOICE_HINTS=[
  "raul","gonzalo","carlos","diego","juan","jorge","luis","miguel","andres","andrés","alejandro",
  "antonio","enrique","pablo","pedro","ricardo","roberto","manuel","mario","fernando","javier",
  "sergio","mateo","santiago","martin","martín","nicolas","nicolás","sebastian","sebastián","daniel"
];

export const LATAM_SPANISH=/^es-(CO|MX|US|419|AR|CL|PE|VE|EC|UY|PY|BO|CR|PA|DO|GT|HN|NI|SV|PR|CU)/i;

export function voiceId(voice){return voice?.voiceURI||voice?.name||""}

export function availableSpanishVoices(){
  if(!("speechSynthesis" in window))return [];
  return (speechSynthesis.getVoices?.()||[]).filter(voice=>/^es(?:-|$)/i.test(voice.lang||""));
}

export function isLikelyMaleVoice(voice){
  const label=norm([voice?.name,voice?.voiceURI].filter(Boolean).join(" "));
  return MALE_VOICE_HINTS.some(name=>label.includes(norm(name)));
}

export function voiceScore(voice){
  let score=0;
  const lang=String(voice?.lang||"");
  if(paco.preferredVoiceId&&voiceId(voice)===paco.preferredVoiceId)score+=10000;
  if(isLikelyMaleVoice(voice))score+=1000;
  if(/^es-CO/i.test(lang))score+=400;
  else if(/^es-MX/i.test(lang))score+=350;
  else if(/^es-(US|419)/i.test(lang))score+=320;
  else if(LATAM_SPANISH.test(lang))score+=280;
  else if(/^es/i.test(lang))score+=80;
  if(voice?.localService)score+=10;
  if(voice?.default)score+=5;
  return score;
}

export function latinVoice(){
  const all=availableSpanishVoices();
  const latam=all.filter(voice=>LATAM_SPANISH.test(voice.lang||""));
  const pool=latam.length?latam:all;
  return pool.slice().sort((a,b)=>voiceScore(b)-voiceScore(a))[0]||null;
}

export function renderVoiceOptions(){
  const select=paco.root?.querySelector("[data-paco-voice-select]");
  if(!select)return;
  const voices=availableSpanishVoices()
    .filter(voice=>LATAM_SPANISH.test(voice.lang||"")||/^es-CO|^es-MX|^es-US|^es-419/i.test(voice.lang||""))
    .sort((a,b)=>voiceScore(b)-voiceScore(a)||String(a.name).localeCompare(String(b.name),"es"));
  const chosen=latinVoice();
  if(!voices.length){
    select.innerHTML='<option value="">Latino automática</option>';
    select.disabled=true;
    return;
  }
  select.disabled=false;
  select.innerHTML=voices.map(voice=>{
    const id=voiceId(voice);
    const male=isLikelyMaleVoice(voice)?" · masculina":"";
    const selected=chosen&&voiceId(chosen)===id?" selected":"";
    return `<option value="${esc(id)}"${selected}>${esc(voice.name||"Voz española")} · ${esc(voice.lang||"es")}${male}</option>`;
  }).join("");
}
