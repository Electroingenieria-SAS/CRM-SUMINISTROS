import { categoryStageHtml, subcategoryStageHtml, activityStageHtml, catalogBreadcrumbHtml } from "./index.js";

export function prepareCatalogNavigation(browser){
browser.setProgress=level=>{
    browser.browser.dataset.level=level;
    const levels=["category","subcategory","activity"];
    const index=levels.indexOf(level);
    browser.browser.querySelectorAll("[data-catalog-progress]").forEach(node=>{
      const nodeIndex=levels.indexOf(node.dataset.catalogProgress);
      node.classList.toggle("active",nodeIndex===index);
      node.classList.toggle("done",nodeIndex<index);
    });
  };
browser.renderCategories=()=>{
    browser.currentCategory=null;
    browser.currentSubcategory=null;
    browser.stage.innerHTML=categoryStageHtml(browser.tree,Boolean(browser.data.active));
    browser.selected.innerHTML="";
    browser.breadcrumb.innerHTML=catalogBreadcrumbHtml();
    browser.setProgress("category");
  };
browser.renderSubcategories=category=>{
    browser.currentCategory=category;
    browser.currentSubcategory=null;
    browser.stage.innerHTML=subcategoryStageHtml(category);
    browser.selected.innerHTML="";
    browser.breadcrumb.innerHTML=catalogBreadcrumbHtml({category});
    browser.setProgress("subcategory");
  };
browser.renderActivities=(category,subcategory)=>{
    browser.currentCategory=category;
    browser.currentSubcategory=subcategory;
    browser.stage.innerHTML=activityStageHtml(category,subcategory);
    browser.selected.innerHTML="";
    browser.breadcrumb.innerHTML=catalogBreadcrumbHtml({category,subcategory});
    browser.setProgress("activity");
  };
}
