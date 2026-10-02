

export function toast(message,type="success",duration=4200){
  const root=document.querySelector("#toast-root");
  if(!root)return;
  const node=document.createElement("div");
  node.className=`toast ${type}`;
  node.setAttribute("role",type==="error"?"alert":"status");
  node.setAttribute("aria-live",type==="error"?"assertive":"polite");
  node.textContent=message;
  root.append(node);
  setTimeout(()=>node.remove(),duration);
}
