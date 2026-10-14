import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {quoteView} from '../../assets/js/domains/freight-quotes/quote-view.js';
import {measurementCardHtml} from '../../assets/js/domains/freight-quotes/measurement-view.js';

test('premium logistics header and navigation share a clear hierarchy',()=>{
 const html=quoteView();
 assert.match(html,/freight-premium-head/);
 assert.match(html,/freight-premium-nav/);
 assert.match(html,/freight-hero-logos/);
 assert.match(html,/Cotización de fletes/);
 assert.doesNotMatch(html,/freight-head-icon/);
 const banners=html.match(/data-freight-service-banner/g)||[];
 assert.equal(banners.length,1);
 assert.match(html,/data-freight-retry/);
});
test('historic dashboard metrics have differentiated display containers',()=>{
 const html=quoteView();
 assert.equal((html.match(/class="freight-history-metric"/g)||[]).length,3);
 for(const id of ['data-history-count','data-history-priced','data-history-actual'])assert.ok(html.includes(id));
});
test('offer tiles show branded identity and preserve all actual estimated values',()=>{
 const shape={status:'REQUIRES_INFORMATION',amount:0,complete:false,totalMaterials:1,measuredMaterials:0};
 const snapshot={carrier:'TCC',origin:'TULUA',destination:'BOGOTA',measurementScenarios:{weight:shape,volume:shape},
  commercialEstimate:{available:true,source:'TCC_2024_IPC_2026',statisticalRange:true,totalCop:89000,rangeLowCop:80000,rangeHighCop:100000,baseCop:70000,variableCop:19000},
  tariffVersion:'2024',selectedBasis:null,measurementWarning:'',warning:''};
 const html=measurementCardHtml(snapshot);
 for(const marker of ['freight-carrier-heading','freight-company-symbol','freight-carrier-route','80.000','100.000','70.000','19.000','Consultar referencia original'])
 assert.ok(html.includes(marker),'expected '+marker);
 assert.match(measurementCardHtml({...snapshot,carrier:'ENVIA'}),/ENVÍA/);
 const unavailable=measurementCardHtml({...snapshot,commercialEstimate:{available:false}});
 assert.match(unavailable,/Estimación todavía no disponible/);
});
test('503 retry is limited to read-only freight calls; no mutation replay',()=>{
 const src=fs.readFileSync(new URL('../../assets/js/services/api.js',import.meta.url),'utf8');
 assert.match(src,/freightReadRpc/);
 assert.match(src,/freightQuoteCatalog:.*freightReadRpc/);
 assert.match(src,/freightQuoteList:.*freightReadRpc/);
 assert.match(src,/freightQuoteSave:.*mutationRpc/);
 assert.match(src,/freightQuoteLink:.*mutationRpc/);
 const controller=fs.readFileSync(new URL('../../assets/js/domains/freight-quotes/quote-controller.js',import.meta.url),'utf8');
 assert.match(controller,/data-freight-retry/);
 assert.match(controller,/showReadFailure/);
});
test('responsive surfaces, prices and reduced-motion overrides are present',()=>{
 const css=fs.readFileSync(new URL('../../assets/css/modules/freight/freight-premium-v3.css',import.meta.url),'utf8');
 for(const marker of ['freight-premium-head','freight-offer[data-offer-carrier=ENVIA]','freight-price-hero','freight-history-metric','@media(max-width:700px)','prefers-reduced-motion'])
 assert.ok(css.includes(marker),marker);
 assert.ok(css.split('\n').length<=300);
});
