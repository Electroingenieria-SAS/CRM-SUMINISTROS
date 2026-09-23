import {renderAdmin as renderAdminBase} from "./admin-center-v11160.js";
import {enhanceAdminUserVerification} from "./admin-user-verification-v11320.js";

/* V11.32.0 · Composición de Administración.
   El centro administrativo conserva la UI/configuración y la verificación
   privilegiada vive en un módulo separado para reducir acoplamiento. */
const observers=new WeakMap();

export async function renderAdmin(root){
  observers.get(root)?.disconnect();
  await renderAdminBase(root);
  enhanceAdminUserVerification(root);
  const observer=new MutationObserver(()=>{
    if(!root.querySelector(".admin-center-v11160")){
      observer.disconnect();
      observers.delete(root);
      return;
    }
    enhanceAdminUserVerification(root);
  });
  observer.observe(root,{childList:true,subtree:true});
  observers.set(root,observer);
}
