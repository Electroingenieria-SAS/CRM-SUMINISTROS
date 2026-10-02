import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';

const domain=new URL('../../assets/js/domains/orders/',import.meta.url);

test('orders has a composed public entry point before callers are redirected',()=>{
  assert.ok(fs.existsSync(new URL('index.js',domain)), 'Orders must be implemented in its domain');
});

test('closed and cancelled orders retain their business stage badges',async()=>{
  const {orderStageBadge}=await import(new URL('shared/order-status.js',domain));
  assert.match(orderStageBadge({status:'CLOSED'}),/>Cerrado<\/span>/);
  assert.match(orderStageBadge({status:'CANCELLED'}),/>Cancelado<\/span>/);
  const active=orderStageBadge({status:'IN_PROGRESS',stepName:'Corte <script>'});
  assert.ok(!active.includes('<script>'));
  assert.ok(active.includes('badge-blue'));
});

test('the initial routing conditions keep their original precedence',async()=>{
  const {initialRouteLabel}=await import(new URL('create/order-routing.js',domain));
  assert.equal(initialRouteLabel({orderType:'PVC',hasCreditArrears:true}), 'Cartera · cliente con mora');
  assert.equal(initialRouteLabel({orderType:'PVN',heldByCashier:true}), 'Caja · pedido retenido');
  assert.equal(initialRouteLabel({orderType:'PVE'}), 'Compras');
  assert.equal(initialRouteLabel({orderType:'PVC'}), 'Recepción de pedidos');
  assert.equal(initialRouteLabel({orderType:'PVC',requiresPurchase:true,hasCreditArrears:true}), 'Cartera · cliente con mora');
});
