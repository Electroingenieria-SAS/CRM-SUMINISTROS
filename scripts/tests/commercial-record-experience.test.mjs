import assert from "node:assert/strict";
import test from "node:test";
import { enhanceCommercialRecords } from "../../assets/js/domains/orders/commercial/record-experience.js";

function classList(initial=[]){
  const values=new Set(initial);
  return {
    add(...names){for(const name of names)values.add(name)},
    contains(name){return values.has(name)},
    values
  };
}

function node(initialClasses=[]){
  const children=[];
  return {
    classList:classList(initialClasses),
    children,
    prepend(child){children.unshift(child)},
    querySelector(selector){
      if(selector===".record-figure-v1188"){
        return children.find(child=>String(child.className||"").split(/\s+/).includes("record-figure-v1188"))||null;
      }
      return null;
    }
  };
}

function figureCount(target){
  return target.children.filter(child=>String(child.className||"").split(/\s+/).includes("record-figure-v1188")).length;
}

globalThis.document={
  createElement(){
    return {
      className:"",
      innerHTML:"",
      attributes:{},
      setAttribute(name,value){this.attributes[name]=value}
    };
  }
};

test("commercial record experience decorates order and credit records exactly once across rerenders",()=>{
  const action=node();
  const order=node();
  const header=node();
  const credit=node();
  credit.querySelector=selector=>selector==="header"?header:null;

  const root={
    classList:classList(["commercial-v1187"]),
    querySelectorAll(selector){
      if(selector===".commercial-action-card")return [action];
      if(selector==="#orders-result .orders-master-row")return [order];
      if(selector==="#credit-result .credit-card")return [credit];
      return [];
    }
  };

  enhanceCommercialRecords(root);
  enhanceCommercialRecords(root);

  assert.ok(action.classList.contains("ops-action-card-v1188"));
  assert.ok(order.classList.contains("compact-record-v1188"));
  assert.ok(order.classList.contains("compact-order-record-v1188"));
  assert.ok(credit.classList.contains("compact-record-v1188"));
  assert.ok(credit.classList.contains("compact-credit-record-v1188"));

  assert.equal(figureCount(order),1);
  assert.equal(figureCount(header),1);

  const orderFigure=order.children[0];
  const creditFigure=header.children[0];
  assert.match(orderFigure.className,/record-figure-order-v1188/);
  assert.match(creditFigure.className,/record-figure-credit-v1188/);
  assert.equal(orderFigure.attributes["aria-hidden"],"true");
  assert.equal(creditFigure.attributes["aria-hidden"],"true");
  assert.match(orderFigure.innerHTML,/record-icon-v1188/);
  assert.match(creditFigure.innerHTML,/record-icon-v1188/);
});
