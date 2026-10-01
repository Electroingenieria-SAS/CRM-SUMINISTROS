import assert from 'node:assert/strict';
import test from 'node:test';
import {parseInvoiceText} from '../../assets/js/domains/billing/invoice-reader/parse/invoice-text.js';

test('invoice amount does not use quantity or weight totals as money',()=>{
  const invoice=parseInvoiceText('Factura No. FE12345\nProveedor: Suministros SAS\nFecha: 25/09/2026\nTotal a pagar: $ 1.234.567,89\nPeso total: 12,5 kg\nCantidad total: 3');
  assert.equal(invoice.amount,1234567.89);
  assert.equal(invoice.packageQuantity,3);
  assert.equal(invoice.packageWeightKg,12.5);
  assert.equal(invoice.invoiceNumber,'FE12345');
  assert.equal(invoice.invoiceDate,'2026-09-25');
});

test('a document with only physical totals has no monetary amount',()=>{
  assert.equal(parseInvoiceText('Cantidad total: 3\nPeso total: 8 kg').amount,null);
});

test('amount below a total label and final payable total remain supported',()=>{
  assert.equal(parseInvoiceText('TOTAL A PAGAR\n1.234,50\nCantidad total: 3').amount,1234.5);
  assert.equal(parseInvoiceText('SUBTOTAL 1.000\nTOTAL A PAGAR 1.190').amount,1190);
});
