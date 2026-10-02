import { api } from "../../../services/api.js";
import { paginationHtml, empty, loading } from "../../../core/ui.js";
import { currentList } from "../orders-state.js";
import { ordersTable } from "./order-table.js";
import { openOrder } from "../detail/order-detail.js";

export async function loadOrders(page=1){
  const root=currentList.root;
  if(!root?.isConnected)return;
  const result=root.querySelector("#orders-result");
  result.innerHTML=loading("Consultando la operación…");
  const filters={search:root.querySelector("#f-search").value.trim(),step:root.querySelector("#f-step").value,status:root.querySelector("#f-status").value,orderType:root.querySelector("#f-type").value,route:root.querySelector("#f-route").value,assignment:root.querySelector("#f-assignment").value,includeHistory:root.querySelector("#f-history").checked,page,pageSize:50};
  currentList.filters=filters;
  currentList.data=await api.listOrders(filters);
  window.__erpOrderListRefresh=()=>loadOrders(currentList.filters.page||1);
  renderOrderResults();
}

export function renderOrderResults(){
  const root=currentList.root;
  const result=root?.querySelector("#orders-result");
  const data=currentList.data;
  if(!result||!data)return;
  const content=data.items.length?ordersTable(data.items):empty("No se encontraron pedidos","Ajusta los filtros o crea un pedido nuevo.");
  result.innerHTML=`${content}${data.items.length?paginationHtml(data.pagination):""}`;
  result.querySelectorAll("[data-order]").forEach(element=>element.onclick=()=>openOrder(element.dataset.order));
  result.querySelectorAll("[data-page]").forEach(element=>element.onclick=()=>loadOrders(Number(element.dataset.page)));
}
