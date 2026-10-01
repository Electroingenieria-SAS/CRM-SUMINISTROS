let installed=false;

export function installGlobalNavigationEvents({openOrder,navigate,moduleForStep,toast}){
  if(installed)return;
  installed=true;
  window.addEventListener("erp:open-order",event=>openOrder(event.detail));
  document.addEventListener("click",event=>{
    const button=event.target.closest?.("[data-take-another]");
    if(!button)return;
    const step=button.dataset.takeAnother||"";
    document.querySelector("#modal-root")?.replaceChildren();
    navigate(moduleForStep(step),{step,assignment:"ALL"});
    toast("El pedido anterior continúa en Mis pedidos activos. Puedes tomar otro sin perder el avance.","success",6000);
  });
}
