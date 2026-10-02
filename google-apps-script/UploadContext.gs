// Shared Apps Script namespace; external entry points retain their names.
function resolveUploadContext_(request) {
  const inferred = request.contextType ? String(request.contextType) : (request.workExecutionId ? 'ACTIVITY' : 'ORDER');
  const type = inferred.toUpperCase();
  const id = request.contextId || request.workExecutionId || request.orderId;
  return {type: type, id: id, label: request.contextLabel || request.workTitle || request.orderNumber || id,
    prefix: type === 'ACTIVITY' ? 'ACTIVIDAD_' : 'PEDIDO_'};
}
