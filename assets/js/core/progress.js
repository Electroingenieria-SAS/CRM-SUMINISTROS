const EVENT_NAME="crm:operation-progress";

function emit(detail){
  window.dispatchEvent(new CustomEvent(EVENT_NAME,{detail}));
}

export function operationProgress({id,title="Procesando",message="Preparando operación…",fileName="",fileSize=0,kind="operation"}={}){
  const operationId=String(id||crypto.randomUUID?.()||`op_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const base={id:operationId,title,message,fileName,fileSize:Number(fileSize||0),kind};
  emit({...base,state:"start",progress:4,phase:"PREPARE",startedAt:Date.now()});
  return {
    id:operationId,
    update({progress,phase,message:nextMessage,title:nextTitle,fileName:nextFileName}={}){
      emit({...base,state:"update",progress:Number.isFinite(Number(progress))?Number(progress):null,phase:phase||null,message:nextMessage||message,title:nextTitle||title,fileName:nextFileName||fileName});
    },
    done(messageText="Operación completada"){
      emit({...base,state:"success",progress:100,phase:"DONE",message:messageText});
    },
    error(error){
      emit({...base,state:"error",progress:null,phase:"ERROR",message:error?.message||String(error||"No fue posible completar la operación.")});
    }
  };
}

export function installProgressApi(){
  if(window.crmProgress)return;
  window.crmProgress={start:operationProgress,eventName:EVENT_NAME};
}

installProgressApi();
