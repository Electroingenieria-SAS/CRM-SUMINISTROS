import { ALERT_COOLDOWN_MS } from "../paco-config.js";
import { paco } from "../paco-state.js";
import { esc } from "../context/profile-context.js";
import { message, add } from "../ui/messages.js";
import { isOpen, setOpen, setBadge } from "../ui/panel.js";
import { speak } from "../voice/speech.js";

export function showProactive({text,title="PACO",tone="warning",actions=[],voice=true,voiceText=null,card=null,orderRows=[]}){
  const item=message({text,actions,card,orderRows,alert:{title,text:"",tone},type:"proactive"});
  add(item);
  if(!isOpen()){
    setBadge(1);
    const stack=paco.root?.querySelector("[data-paco-toast-stack]");
    if(stack){
      const note=document.createElement("button");
      note.type="button";
      note.className=`paco-op-toast ${tone}`;
      note.innerHTML=`<span>⚡</span><div><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
      note.onclick=()=>{note.remove();setOpen(true)};
      stack.prepend(note);
      while(stack.children.length>3)stack.lastElementChild?.remove();
      setTimeout(()=>note.remove(),18000);
    }
  }
  if(voice)speak(voiceText||text);
}

export function alertAllowed(key){
  const last=paco.alertMemory.get(key)||0;
  if(Date.now()-last<ALERT_COOLDOWN_MS)return false;
  paco.alertMemory.set(key,Date.now());
  return true;
}
