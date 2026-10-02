import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedBridgeOrigin } from "../../assets/js/integrations/drive/bridge/post-message-request.js";

test("acepta los orígenes legítimos de Apps Script aunque rote el sandbox",()=>{
  assert.equal(isAllowedBridgeOrigin("https://script.google.com"),true);
  assert.equal(isAllowedBridgeOrigin("https://script.googleusercontent.com"),true);
  assert.equal(isAllowedBridgeOrigin("https://n-example-0lu-script.googleusercontent.com"),true);
  assert.equal(isAllowedBridgeOrigin("https://another-sandbox.script.googleusercontent.com"),true);
});

test("rechaza orígenes que solo imitan el dominio de Google",()=>{
  assert.equal(isAllowedBridgeOrigin("http://script.google.com"),false);
  assert.equal(isAllowedBridgeOrigin("https://script.google.com.evil.example"),false);
  assert.equal(isAllowedBridgeOrigin("https://script.googleusercontent.com.evil.example"),false);
  assert.equal(isAllowedBridgeOrigin("https://googleusercontent.com"),false);
  assert.equal(isAllowedBridgeOrigin("not-a-url"),false);
});

test("el bridge conserva validación por iframe y requestId",async()=>{
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../../assets/js/integrations/drive/bridge/post-message-request.js",import.meta.url),"utf8");
  assert.match(source,/belongsToBridgeFrame\(event\.source, iframe\.contentWindow\)/);
  assert.match(source,/data\?\.source !== "ERP_EI_DRIVE_BRIDGE"/);
  assert.match(source,/includes\(requestId\)/);
});
