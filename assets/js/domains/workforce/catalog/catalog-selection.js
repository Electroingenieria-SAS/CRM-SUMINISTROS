import { api } from "../../../services/api.js";
import { toast } from "../../../core/ui.js";
import { selectedActivityHtml } from "./index.js";
import { rerenderWorkforceContent } from "../today/today-controller.js";

export function bindCatalogSelection(browser){
browser.browser.addEventListener("click",async event=>{
    const back=event.target.closest("[data-work-level-back]");
    if(back){
      if(back.dataset.workLevelBack==="category")browser.renderCategories();
      else if(back.dataset.workLevelBack==="subcategory"&&browser.currentCategory)browser.renderSubcategories(browser.currentCategory);
      return;
    }

    const categoryButton=event.target.closest("[data-work-category]");
    if(categoryButton){
      const category=browser.tree.find(row=>row.key===categoryButton.dataset.workCategory);
      if(category)browser.renderSubcategories(category);
      return;
    }

    const subButton=event.target.closest("[data-work-subcategory]");
    if(subButton&&browser.currentCategory){
      const subcategory=browser.currentCategory.subcategories.find(row=>row.label===subButton.dataset.workSubcategory);
      if(subcategory)browser.renderActivities(browser.currentCategory,subcategory);
      return;
    }

    const activityButton=event.target.closest("[data-work-activity-select]");
    if(activityButton){
      const item=(browser.data.catalog||[]).find(row=>row.id===activityButton.dataset.workActivitySelect);
      if(!item)return;
      browser.stage.querySelectorAll("[data-work-activity-select]").forEach(node=>node.classList.toggle("selected",node===activityButton));
      browser.selected.innerHTML=selectedActivityHtml(item);
      requestAnimationFrame(()=>browser.selected.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"nearest"}));
      return;
    }

    if(event.target.closest("[data-work-selection-cancel]")){
      browser.selected.innerHTML="";
      browser.stage.querySelectorAll("[data-work-activity-select]").forEach(node=>node.classList.remove("selected"));
      return;
    }

    const confirmButton=event.target.closest("[data-work-start-confirmed]");
    if(confirmButton){
      confirmButton.disabled=true;
      try{
        await api.workStart(confirmButton.dataset.workStartConfirmed,null,{});
        toast("Actividad iniciada. El cronómetro ya está registrando tu tiempo.");
        await rerenderWorkforceContent(browser.content);
      }catch(error){
        toast(error.message,"error",7000);
        confirmButton.disabled=false;
      }
    }
  });
}
