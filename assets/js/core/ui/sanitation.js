

export const BLOCKED_HTML_TAGS=new Set(["SCRIPT","STYLE","LINK","IFRAME","OBJECT","EMBED","META","BASE"]);

export const URL_ATTRIBUTES=new Set(["href","src","action","formaction","xlink:href"]);

export const UNSAFE_URL=/^\s*(?:javascript|vbscript|data\s*:\s*text\/html)/i;

export const UNSAFE_STYLE=/(?:expression\s*\(|behavior\s*:|url\s*\()/i;

export function sanitizeHtml(value=""){
  const template=document.createElement("template");
  template.innerHTML=String(value??"");
  template.content.querySelectorAll("*").forEach(node=>{
    if(BLOCKED_HTML_TAGS.has(node.tagName)){
      node.remove();
      return;
    }
    for(const attribute of [...node.attributes]){
      const name=attribute.name.toLowerCase();
      const raw=String(attribute.value||"");
      if(name.startsWith("on")||name==="srcdoc"){
        node.removeAttribute(attribute.name);
        continue;
      }
      if(URL_ATTRIBUTES.has(name)&&UNSAFE_URL.test(raw)){
        node.removeAttribute(attribute.name);
        continue;
      }
      if(name==="style"&&UNSAFE_STYLE.test(raw))node.removeAttribute(attribute.name);
    }
  });
  return template.innerHTML;
}
