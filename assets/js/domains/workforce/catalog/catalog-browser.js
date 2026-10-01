import { catalogTaxonomy, catalogBrowserHtml } from "./index.js";
import { prepareCatalogNavigation } from "./catalog-navigation.js";
import { bindCatalogSelection } from "./catalog-selection.js";

export function catalogHtml(catalog,disabled){
  return catalogBrowserHtml(catalog,disabled);
}

export function bindCatalogBrowser(content,data){
const browser={content,data};
prepareCatalogBrowser(browser);
if(!browser.browser)return;
prepareCatalogNavigation(browser);
bindCatalogSelection(browser);
}

export function prepareCatalogBrowser(browser){
browser.browser=browser.content.querySelector("[data-work-catalog-browser]");
if(!browser.browser)return;
browser.tree=catalogTaxonomy(browser.data.catalog||[]);
browser.stage=browser.browser.querySelector("[data-work-catalog-stage]");
browser.selected=browser.browser.querySelector("[data-work-selected]");
browser.breadcrumb=browser.browser.querySelector("[data-work-catalog-breadcrumb]");
browser.currentCategory=null;
browser.currentSubcategory=null;
}
