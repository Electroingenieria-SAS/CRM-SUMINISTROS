import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');

test('impresión de recepción carga QR y CODE128 antes de utilizarlos',async()=>{
  const text=await source('assets/js/domains/receiving/goods/detail/print-receipt.js');
  assert.match(text,/export async function printGoodsReceipt/);
  assert.match(text,/await loadInventoryLabels\(\)/);
  assert.ok(text.indexOf('await loadInventoryLabels()')<text.indexOf('window.JsBarcode('));
  assert.ok(text.indexOf('window.open(')<text.indexOf('await loadInventoryLabels()'),
    'La ventana debe abrirse antes del await para evitar bloqueadores de ventanas emergentes');
});

test('impresión y cámara del conteo cargan bibliotecas opcionales',async()=>{
  const text=await source('assets/js/modules/inventory-operator-v11250.js');
  assert.match(text,/import \{loadInventoryLabels,loadScannerFallback\}/);
  assert.match(text,/async function printLabels\(lots\)/);
  assert.ok(text.indexOf('await loadInventoryLabels()')<text.indexOf('window.JsBarcode(svg,'));
  assert.match(text,/await loadScannerFallback\(\)/);
  assert.match(text,/#\/dashboard\?scan=/);
});

test('lector universal conserva los saldos protegidos y la captura por rol',async()=>{
  const [text,migration]=await Promise.all([
    source('assets/js/modules/inventory-scan-v116.js'),
    source('supabase/migrations/20261104081000_inventory_scan_identify_all_profiles.sql')
  ]);
  assert.match(text,/data-v116-global-scan/);
  assert.match(text,/erp_x_inventory_scan_resolve/);
  assert.match(text,/erp_x_inventory_scan_identify/);
  assert.match(text,/const canShowStock=data\.canViewStock!==false/);
  assert.match(text,/\$\{stockCards\}/);
  assert.match(text,/canOpenInventory&&state\.currentModule/);
  assert.match(text,/pendingDeepLink/);
  assert.match(text,/params\.get\("countScan"\)/);
  assert.match(text,/function showReceiptScanResult/);
  assert.match(text,/await loadInventoryLabels\(\)/);
  assert.match(migration,/perform erp_supply\.require_profile\(\)/);
  assert.match(migration,/i\.organization_id=v_org/);
  assert.match(migration,/'canViewStock',false/);
  assert.match(migration,/'kind','WAREHOUSE_RECEIPT'/);
  assert.match(migration,/w\.barcode_value=v_raw or w\.qr_value=v_raw/);
  assert.doesNotMatch(migration,/'available'|'reserved'|'blocked'|'quantity_available'/);
  assert.match(migration,/revoke all on function public\.erp_x_inventory_scan_identify\(text\) from public, anon/);
  assert.match(migration,/grant execute on function public\.erp_x_inventory_scan_identify\(text\) to authenticated/);
});
