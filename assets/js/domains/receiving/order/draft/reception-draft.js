

export const DRAFT_PREFIX="erp:recepcion-pedido:v10.6:";

export function loadDraft(data){
  const fallback={stage:"REVIEW",mode:null,lines:[],sourceFileId:"",sourceFileName:"",pickingProfileId:"",cutProfileId:"",readerVersion:null,rawPreview:""};
  try{
    const parsed=JSON.parse(localStorage.getItem(DRAFT_PREFIX+data.order.id)||"null");
    if(!parsed||parsed.orderVersion>data.order.version)return {...fallback,orderVersion:data.order.version};
    return {...fallback,...parsed,orderVersion:data.order.version};
  }catch{return {...fallback,orderVersion:data.order.version}}
}

export function persistDraft(orderId,draft){draft.updatedAt=new Date().toISOString();localStorage.setItem(DRAFT_PREFIX+orderId,JSON.stringify(draft))}

export function clearDraft(orderId){localStorage.removeItem(DRAFT_PREFIX+orderId)}
