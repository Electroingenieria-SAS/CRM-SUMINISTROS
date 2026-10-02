import { toast } from "../../../core/ui.js";
import { paco } from "../paco-state.js";
import { saveVoicePreference } from "./preferences.js";
import { message, add } from "../ui/messages.js";
import { isLikelyMaleVoice, latinVoice, renderVoiceOptions } from "./voice-selection.js";

export function updateVoiceButton(){
  const button=paco.root?.querySelector("[data-paco-voice]");
  button?.classList.toggle("is-on",paco.voiceEnabled);
  const icon=button?.querySelector("[data-paco-voice-icon]");
  if(icon)icon.textContent=paco.voiceEnabled?"🔊":"🔇";
  if(button)button.title=paco.voiceEnabled?"Voz masculina latinoamericana activa · clic para silenciar":"Voz silenciada · clic para activar";
  renderVoiceOptions();
}

export function speak(text,{force=false}={}){
  if((!paco.voiceEnabled&&!force)||!("speechSynthesis" in window)||!text)return false;
  try{
    speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(String(text).slice(0,420));
    const voice=latinVoice();
    utterance.lang=voice?.lang||"es-CO";
    if(voice)utterance.voice=voice;
    utterance.rate=.96;
    utterance.pitch=isLikelyMaleVoice(voice)?0.92:0.88;
    utterance.volume=.96;
    speechSynthesis.speak(utterance);
    return true;
  }catch{return false}
}

export function toggleVoice(){
  paco.voiceEnabled=!paco.voiceEnabled;
  saveVoicePreference();
  updateVoiceButton();
  toast(paco.voiceEnabled?"PACO usará preferentemente una voz masculina latinoamericana.":"Voz de PACO silenciada.");
  if(paco.voiceEnabled)speak("Listo. Mi voz masculina latinoamericana está activa y te avisaré sobre la operación.");
}

export function testVoice(){
  paco.voiceEnabled=true;
  saveVoicePreference();
  updateVoiceButton();
  const voice=latinVoice();
  const voiceLabel=voice?[voice.name,voice.lang,isLikelyMaleVoice(voice)?"preferencia masculina":"mejor voz latina disponible"].filter(Boolean).join(" · "):"español latino del dispositivo";
  const ok=speak("Hola. Soy PACO. Esta es mi voz masculina latinoamericana. Te avisaré cuando haya pedidos demorados, personas sin actividad y cambios importantes en la operación.",{force:true});
  add(message({
    type:ok?"success":"normal",
    text:ok?`Prueba enviada. Estoy usando ${voiceLabel}. Puedes cambiarla en el selector Voz si tu dispositivo ofrece otras opciones.`:"El navegador no permitió reproducir voz. Revisa el volumen del equipo y vuelve a pulsar Probar voz.",
    actions:[{label:"Resumen ahora",action:"summary-now",icon:"↗"}]
  }));
}
