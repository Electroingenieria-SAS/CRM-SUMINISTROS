const EVENT_NAME="crm:operation-progress";
const REMOVE_SUCCESS_MS=1700;
const REMOVE_ERROR_MS=8000;
const cards=new Map();
let root=null;
let clock=null;

function ensureRoot(){
  if(root?.isConnected)return root;
  root=document.createElement("section");
  root.id="crm-progress-root";
  root.className="crm-progress-root-v11100";
  root.setAttribute("aria-label","Procesos en curso");
  root.setAttribute("aria-live","polite");
  root.setAttribute("aria-relevant","additions text");
  document.body.append(root);
  startClock();
  return root;
}

function startClock(){
  if(clock)return;
  clock=setInterval(()=>{
    const now=Date.now();
    cards.forEach(entry=>{
      if(!entry.node?.isConnected)return;
      const seconds=Math.max(0,Math.floor((now-entry.startedAt)/1000));
      const elapsed=entry.node.querySelector("[data-progress-elapsed]");
      if(elapsed)elapsed.textContent=seconds<60?`${seconds} s`:`${Math.floor(seconds/60)} min ${seconds%60}s`;
      const wait=entry.node.querySelector("[data-progress-wait]");
      if(wait)wait.hidden=!(seconds>=8&&entry.state!=="success"&&entry.state!=="error");
    });
  },1000);
}

function stopClockIfIdle(){
  if(cards.size||!clock)return;
  clearInterval(clock);clock=null;
}

function phaseLabel(phase){
  return ({PREPARE:"Preparando",SESSION:"Validando",ENCODE:"Procesando",UPLOAD:"Subiendo a Drive",REGISTER:"Registrando",DONE:"Completado",ERROR:"Error"})[phase]||"Procesando";
}

function formatSize(bytes){
  const n=Number(bytes||0);
  if(!n)return "";
  if(n>=1024*1024)return `${(n/(1024*1024)).toFixed(n>=10*1024*1024?0:1)} MB`;
  if(n>=1024)return `${Math.round(n/1024)} KB`;
  return `${n} B`;
}

function escapeHtml(value){
  return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

function createCard(detail){
  const node=document.createElement("article");
  node.className="crm-progress-card-v11100";
  node.dataset.progressId=detail.id;
  node.dataset.progressState=detail.state||"start";
  node.dataset.progressPhase=detail.phase||"PREPARE";
  const size=formatSize(detail.fileSize);
  node.innerHTML=`
    <div class="crm-progress-head-v11100">
      <span class="crm-progress-icon-v11100" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V5m0 0-4 4m4-4 4 4"/><path d="M5 15v4h14v-4"/></svg></span>
      <div class="crm-progress-title-v11100"><span data-progress-phase>${escapeHtml(phaseLabel(detail.phase))}</span><strong data-progress-title>${escapeHtml(detail.title||"Procesando")}</strong></div>
      <span class="crm-progress-time-v11100" data-progress-elapsed>0 s</span>
    </div>
    <div class="crm-progress-file-v11100" ${detail.fileName?"":"hidden"}><strong data-progress-file>${escapeHtml(detail.fileName||"")}</strong><span>${escapeHtml(size)}</span></div>
    <p class="crm-progress-message-v11100" data-progress-message>${escapeHtml(detail.message||"Preparando operación…")}</p>
    <div class="crm-progress-track-v11100" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.max(0,Math.min(100,Number(detail.progress||4)))}">
      <span class="crm-progress-fill-v11100" data-progress-fill style="width:${Math.max(4,Math.min(100,Number(detail.progress||4)))}%"></span>
    </div>
    <div class="crm-progress-foot-v11100"><span class="crm-progress-pulse-v11100" aria-hidden="true"></span><span data-progress-wait hidden>El CRM sigue trabajando. No cierres esta ventana.</span><button type="button" data-progress-dismiss aria-label="Ocultar estado">Ocultar</button></div>`;
  node.querySelector("[data-progress-dismiss]")?.addEventListener("click",()=>removeCard(detail.id));
  ensureRoot().append(node);
  requestAnimationFrame(()=>node.classList.add("is-visible"));
  return {node,startedAt:detail.startedAt||Date.now(),state:detail.state||"start",removeTimer:null,lastProgress:Number(detail.progress||4)};
}

function updateCard(detail){
  let entry=cards.get(detail.id);
  if(!entry){entry=createCard(detail);cards.set(detail.id,entry)}
  const {node}=entry;
  entry.state=detail.state||entry.state;
  node.dataset.progressState=entry.state;
  if(detail.phase)node.dataset.progressPhase=detail.phase;
  const title=node.querySelector("[data-progress-title]");if(title&&detail.title)title.textContent=detail.title;
  const message=node.querySelector("[data-progress-message]");if(message&&detail.message)message.textContent=detail.message;
  const phase=node.querySelector("[data-progress-phase]");if(phase)phase.textContent=phaseLabel(detail.phase||node.dataset.progressPhase);
  const file=node.querySelector("[data-progress-file]");if(file&&detail.fileName)file.textContent=detail.fileName;
  const fileWrap=node.querySelector(".crm-progress-file-v11100");if(fileWrap&&detail.fileName)fileWrap.hidden=false;
  const nextProgress=Number.isFinite(Number(detail.progress))?Math.max(entry.lastProgress,Math.min(100,Number(detail.progress))):entry.lastProgress;
  entry.lastProgress=nextProgress;
  const fill=node.querySelector("[data-progress-fill]");if(fill)fill.style.width=`${nextProgress}%`;
  const track=node.querySelector("[role=progressbar]");if(track)track.setAttribute("aria-valuenow",String(Math.round(nextProgress)));
  node.classList.toggle("is-uploading",(detail.phase||node.dataset.progressPhase)==="UPLOAD"&&entry.state!=="success"&&entry.state!=="error");
  node.classList.toggle("is-success",entry.state==="success");
  node.classList.toggle("is-error",entry.state==="error");
  if(entry.removeTimer){clearTimeout(entry.removeTimer);entry.removeTimer=null}
  if(entry.state==="success")entry.removeTimer=setTimeout(()=>removeCard(detail.id),REMOVE_SUCCESS_MS);
  else if(entry.state==="error")entry.removeTimer=setTimeout(()=>removeCard(detail.id),REMOVE_ERROR_MS);
}

function removeCard(id){
  const entry=cards.get(id);if(!entry)return;
  if(entry.removeTimer)clearTimeout(entry.removeTimer);
  entry.node.classList.remove("is-visible");
  setTimeout(()=>{entry.node.remove();cards.delete(id);if(root&&!root.children.length)root.remove();stopClockIfIdle()},220);
}

window.addEventListener(EVENT_NAME,event=>{
  const detail=event.detail||{};
  if(!detail.id)return;
  updateCard(detail);
});
