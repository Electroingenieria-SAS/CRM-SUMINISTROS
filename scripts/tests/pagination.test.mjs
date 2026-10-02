import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { paginationHtml } from "../../assets/js/core/ui/pagination.js";

function pageNumbers(html){
  return [...html.matchAll(/class="pagination-page(?: active)?"[^>]*>(\d+)<\/button>/g)].map(match=>Number(match[1]));
}

test("pagination returns an empty fragment without metadata",()=>{
  assert.equal(paginationHtml(null),"");
});

test("pagination renders every page when total pages is seven or fewer",()=>{
  const html=paginationHtml({page:4,totalPages:7,totalItems:71});
  assert.deepEqual(pageNumbers(html),[1,2,3,4,5,6,7]);
  assert.match(html,/class="pagination pagination-commerce"/);
  assert.match(html,/class="pagination-summary"/);
  assert.match(html,/71<\/strong><span>registros · Página 4 de 7<\/span>/);
});

test("pagination renders compact sequences at the beginning, middle and end",()=>{
  const start=paginationHtml({page:1,totalPages:10,totalItems:100});
  const middle=paginationHtml({page:5,totalPages:10,totalItems:100});
  const end=paginationHtml({page:10,totalPages:10,totalItems:100});

  assert.deepEqual(pageNumbers(start),[1,2,3,10]);
  assert.equal((start.match(/pagination-ellipsis/g)||[]).length,1);

  assert.deepEqual(pageNumbers(middle),[1,3,4,5,6,7,10]);
  assert.equal((middle.match(/pagination-ellipsis/g)||[]).length,2);

  assert.deepEqual(pageNumbers(end),[1,8,9,10]);
  assert.equal((end.match(/pagination-ellipsis/g)||[]).length,1);
});

test("pagination preserves data-page navigation, ARIA current and boundary disabled states",()=>{
  const first=paginationHtml({page:1,totalPages:10,totalItems:100});
  assert.match(first,/pagination-previous" data-page="0"[^>]*disabled/);
  assert.match(first,/pagination-next" data-page="2"/);
  assert.match(first,/pagination-page active" data-page="1" aria-label="Página 1, actual" aria-current="page" disabled/);
  assert.match(first,/pagination-page" data-page="2" aria-label="Ir a la página 2"/);
  assert.match(first,/class="pagination-ellipsis" aria-hidden="true"/);

  const last=paginationHtml({page:10,totalPages:10,totalItems:100});
  assert.match(last,/pagination-previous" data-page="9"/);
  assert.match(last,/pagination-next" data-page="11"[^>]*disabled/);
});

test("Orders still consumes pagination through the stable data-page contract",()=>{
  const source=readFileSync(new URL("../../assets/js/domains/orders/list/load-orders.js",import.meta.url),"utf8");
  assert.match(source,/querySelectorAll\("\[data-page\]"\)/);
  assert.match(source,/loadOrders\(Number\(element\.dataset\.page\)\)/);
});

test("the legacy pagination enhancer stays retired from runtime",()=>{
  const appEntry=readFileSync(new URL("../../assets/js/app-entry.js",import.meta.url),"utf8");
  assert.doesNotMatch(appEntry,/pagination-v1184\.js/);
  assert.equal(existsSync(new URL("../../assets/js/modules/pagination-v1184.js",import.meta.url)),false);
});
