import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');

test('inicio del CRM carga solo dependencias esenciales, no exportadores ni escáner',async()=>{
 const index=await source('index.html');
 const startVendors=[
  /<script[^>]+xlsx\.full\.min/i,
  /<script[^>]+jspdf/i,
  /<script[^>]+JsBarcode/i,
  /<script[^>]+qrcode\.min/i,
  /<script[^>]+@zxing\/browser/i
 ];
 for(const marker of startVendors)assert.doesNotMatch(index,marker);
 assert.match(index,/@supabase\/supabase-js@2\.111\.0/);
 assert.match(index,/app-entry\.js\?v=11\.46\.0/);
 assert.equal((index.match(/<script defer/g)||[]).length,2);
});

test('proveedor de librerías se comparte entre llamadas y permite reintentos',async()=>{
 const vendors=await source('assets/js/integrations/documents/optional-vendors.js');
 assert.match(vendors,/const pending=new Map\(\)/);
 assert.match(vendors,/if\(pending\.has\(key\)\)/);
 assert.match(vendors,/pending\.delete\(key\)/);
 assert.match(vendors,/loadPdfExporter/);
 assert.match(vendors,/loadInventoryLabels/);
 assert.match(vendors,/loadScannerFallback/);
});

test('exportar Excel, PDF o imprimir etiquetas solicita el proveedor solo al usarlo',async()=>{
 const [spreadsheet,history,report,analytics,ledger,inventory]=await Promise.all([
  source('assets/js/integrations/documents/spreadsheet-runtime.js'),
  source('assets/js/domains/history/exports/history-export.js'),
  source('assets/js/domains/analytics/reports/exports/download-report.js'),
  source('assets/js/domains/analytics/reports/exports/report-export.js'),
  source('assets/js/domains/logistics/local-dispatch/local-dispatch-ledger.js'),
  source('assets/js/modules/inventory-scan-v116.js')
 ]);
 assert.match(spreadsheet,/async function loadSheetJs/);
 assert.match(history,/await loadSheetJs\(\)/);
 assert.match(report,/await loadSheetJs\(\)/);
 assert.match(analytics,/await downloadXlsx\(/);
 assert.match(ledger,/await loadPdfExporter\(\)/);
 assert.match(ledger,/await loadSheetJs\(\)/);
 assert.match(inventory,/await loadInventoryLabels\(\)/);
 assert.match(inventory,/await loadScannerFallback\(\)/);
});

test('observadores de modificaciones no programan trabajo duplicado',async()=>{
 const guide=await source('assets/js/modules/bootstrap-v113.js');
 const inventory=await source('assets/js/modules/inventory-scan-v116.js');
 assert.match(guide,/if\(scheduled\)return/);
 assert.match(guide,/requestAnimationFrame/);
 assert.match(inventory,/if\(inventoryEnhanceTimer!==null\)return/);
});
