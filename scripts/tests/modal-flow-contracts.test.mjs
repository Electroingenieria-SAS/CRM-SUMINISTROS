import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8');

test('acciones obligatorias de wizard, diálogo, tarea y despacho siguen explícitas',()=>{
 const wizard=read('assets/js/core/ui/wizard-shell.js');
 const dialog=read('assets/js/core/ui/dialog.js');
 const panel=read('assets/js/core/ui/task-panel.js');
 const shipping=read('assets/js/domains/logistics/shipping/ui/shipping-shell.js');
 for(const name of ['data-next','data-prev','data-close'])assert.ok(wizard.includes(name),name);
 for(const name of ['data-confirm','data-close'])assert.ok(dialog.includes(name),name);
 for(const name of ['data-task-panel-confirm','data-task-panel-close'])assert.ok(panel.includes(name),name);
 for(const name of ['data-shipping-next-core','data-shipping-close-another'])assert.ok(shipping.includes(name),name);
});

test('validaciones no deben cerrar ni bloquear el flujo cuando el resultado es false',()=>{
 const dialog=read('assets/js/core/ui/dialog.js');
 const wizard=read('assets/js/core/ui/wizard-navigation.js');
 const panel=read('assets/js/core/ui/task-panel.js');
 assert.match(dialog,/outcome!==false&&dialog\.isConnected/);
 assert.match(wizard,/outcome!==false&&wizardState\.form\.isConnected/);
 assert.match(wizard,/else if\(outcome===false&&wizardState\.next\.isConnected\)/);
 assert.match(panel,/finally\{if\(wrapper\.isConnected\)button\.disabled=false\}/);
});

test('mejoras transversales no alteran valores ni ejecutan botones por Enter implícito',()=>{
 const popup=read('assets/js/modules/popup-ux-v1190.js');
 const behavior=read('assets/js/modules/popup-ux-field-behavior.js');
 const policy=read('assets/js/modules/popup-explicit-action-policy.js');
 assert.match(popup,/import \{decorateFields,bindValidation\}/);
 assert.match(popup,/bindIntentionalConfirmation\(modal\)/);
 assert.doesNotMatch(popup,/bindAutomation\(|commercial-wizard-assist"\)\?\.remove/);
 assert.doesNotMatch(behavior,/control\.value=control\.value\.trim\(\)/);
 assert.match(behavior,/message\.textContent=/);
 assert.doesNotMatch(behavior,/alert\.innerHTML/);
 assert.match(policy,/dataset\.enterConfirms!=="true"/);
});

test('el inventario de modales es lectura y no altera el repositorio',()=>{
 const audit=read('scripts/architecture/audit-dialog-flows.mjs');
 assert.match(audit,/dialogueOwners/);
 assert.match(audit,/needsManualReview/);
 assert.doesNotMatch(audit,/writeFile|unlinkSync|rmSync|execSync/);
});
