import { fmt } from "../../../core/format.js";
import { customerRankingHtml } from "./customer-ranking.js";

export function analyticsCustomersSectionHtml(analytics){return `${analytics.customerRanking?`<section class="work-indicator-section-v11383">
        <header class="work-indicator-section-head-v11383">
          <div><span>VALOR COMERCIAL</span><h3>Pareto y ranking automático de clientes</h3><p>Combina 50% frecuencia de pedidos y 50% valor económico reconocido. Usa pago confirmado de Caja cuando existe y factura como respaldo provisional mientras no exista ese dato.</p></div>
        </header>
        <section class="work-indicator-panel-v11363 work-indicator-panel-featured-v11383">
          <header><div><span>CLIENTES</span><h3>Quién concentra más compras y valor</h3><p>${analytics.customerRanking.learningActive?"Segmentación activa en Básico, Normal, Premium y Urgente.":"Modo aprendizaje: todos permanecen en Normal hasta contar con suficiente historia."}</p></div><b class="work-customer-learning-v11390">${fmt.number(analytics.customerRanking.sampleOrders||0)} pedidos</b></header>
          <div class="work-indicator-panel-body-v11363">${customerRankingHtml(analytics.customerRanking)}</div>
        </section>
      </section>`:""}`;}
