// Enter must not accidentally save/approve orders from unrelated fields.
// Native form submission remains native. Other dialogs can opt in explicitly.
export function bindIntentionalConfirmation(modal){
  if(modal.dataset.popupConfirmationBound)return;
  modal.dataset.popupConfirmationBound="1";
  modal.addEventListener("keydown",event=>{
    if(event.key!=="Enter"||event.repeat||event.isComposing||event.defaultPrevented)return;
    if(event.shiftKey||event.ctrlKey||event.altKey||event.metaKey)return;
    if(modal.classList.contains("wizard-modal")||modal.dataset.enterConfirms!=="true")return;
    const target=event.target;
    if(!(target instanceof HTMLInputElement))return;
    if(["checkbox","radio","file","button","submit","search"].includes(target.type))return;
    if(target.closest("form,[contenteditable='true'],[role='combobox']"))return;
    const confirm=modal.querySelector("[data-confirm]:not(:disabled)");
    if(confirm&&confirm.offsetParent!==null){
      event.preventDefault();
      confirm.click();
    }
  });
}
