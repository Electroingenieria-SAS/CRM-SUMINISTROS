import { paco } from "../paco-state.js";

export function readVoicePreference(){
  try{return localStorage.getItem("paco_voice_v11370")!=="0"}catch{return true}
}

export function saveVoicePreference(){
  try{localStorage.setItem("paco_voice_v11370",paco.voiceEnabled?"1":"0")}catch{}
}

export function readPreferredVoice(){
  try{return localStorage.getItem("paco_voice_id_v11372")||""}catch{return ""}
}

export function savePreferredVoice(value=""){
  paco.preferredVoiceId=String(value||"");
  try{
    if(paco.preferredVoiceId)localStorage.setItem("paco_voice_id_v11372",paco.preferredVoiceId);
    else localStorage.removeItem("paco_voice_id_v11372");
  }catch{}
}
