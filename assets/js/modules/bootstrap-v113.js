import {installGuidesV113} from "./guides-v113.js";
import {installActivityBrowserV113} from "./activity-browser-v113.js";

installGuidesV113();

const startActivityBrowser=()=>{
  if(document.querySelector("#page-content")){
    installActivityBrowserV113();
    return true;
  }
  return false;
};

if(!startActivityBrowser()){
  const app=document.querySelector("#app");
  if(app){
    const observer=new MutationObserver(()=>{if(startActivityBrowser())observer.disconnect()});
    observer.observe(app,{childList:true,subtree:true});
  }
}
