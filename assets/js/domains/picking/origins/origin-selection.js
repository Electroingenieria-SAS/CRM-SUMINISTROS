

export function readOrigins(row){
  return [...(row?.querySelectorAll("[data-origin-option]")||[])].filter(option=>option.querySelector("[data-origin-check]")?.checked).map(option=>({lotId:option.querySelector("[data-origin-check]").value,quantity:Number(option.querySelector("[data-origin-qty]").value)||0})).filter(origin=>origin.quantity>0);
}

export function originSelectionValid(row){
  if(row.dataset.requiresCut==="true")return true;
  return row.dataset.originLoaded==="true"&&row.dataset.originValid==="true";
}

export function readRow(row){return {orderItemId:row.dataset.itemId,result:row.dataset.result||"",novelty:row.querySelector("textarea")?.value.trim()||"",origins:row.dataset.result==="FOUND"&&row.dataset.requiresCut!=="true"?readOrigins(row):[]}}
