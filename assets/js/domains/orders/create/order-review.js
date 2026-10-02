import { fmt } from "../../../core/format.js";
import { serializeForm } from "../../../core/ui.js";
import { summaryItem } from "../../../core/guided.js";
import { estimatedSalesWeight } from "../freight/material-weight.js";
import { collectSalesItems } from "./validation.js";
import { initialRouteLabel } from "./order-routing.js";

export function renderOrderReview({root,form}){
        const d=serializeForm(form),items=collectSalesItems(root),cards=[...root.querySelectorAll("[data-sales-material]")];
        const cutLines=items.filter(item=>item.requiresCut).length;
        const shortageCards=cards.filter(card=>Number(card.dataset.shortage||0)>0).length;
        const freightWeight=estimatedSalesWeight(root);
        root.querySelector("#order-review").innerHTML=[summaryItem("Pedido",d.orderNumber),summaryItem("Cliente",d.clientName),summaryItem("Segmento cliente",root.dataset.customerSegmentLabel||"Normal · aprendiendo"),summaryItem("Tipo",fmt.label(d.orderType)),summaryItem("Pago",fmt.payment(d.paymentCondition)),summaryItem("Entrega",fmt.route(d.deliveryRoute)),summaryItem("Destino",`${d.clientCity}, ${d.clientDepartment}`),summaryItem("Peso estimado",freightWeight.complete?`${fmt.number(freightWeight.weightKg,2)} kg`:"Pendiente de completar materiales"),summaryItem("Flete estimado",root.dataset.freightEstimateLabel||"Aprendiendo con históricos"),summaryItem("Dirección",d.clientAddress),summaryItem("Materiales",String(cards.length)),summaryItem("Líneas operativas",String(items.length)),summaryItem("Cortes",cutLines?`${cutLines} línea(s) de corte`:"Sin cortes"),summaryItem("Disponibilidad",shortageCards?`${shortageCards} material(es) con faltante proyectado`:"Disponible según maestro actual"),summaryItem("Ruta inicial",initialRouteLabel(d))].join("");
      }
