import {LOCAL_TARIFF_ROWS} from './local-tariff-data.js';
// Canonical 54 internal-route quotes transcribed from tarifas_rutas_luis_ibarra_CRM.csv.
// These are documented supplier rates, not independently verified active contracts.
// Source raw CSV SHA-256: 7be632a885a842222e97f86ae4f6c5af2b1b696aac43bbf43fc4d1169ff97f5d
export const LOCAL_DISPATCH_TARIFF_VERSION='LUIS_IBARRA_CSV_2026_10_14';
export const LOCAL_DISPATCH_TARIFFS=Object.freeze(LOCAL_TARIFF_ROWS);
export const LOCAL_DISPATCH_BRANCHES=['D0604','D0605','D0607','D4599-A12','D6099P'];
export function normalizeDestination(value=''){
 return String(value||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
}
const aliases=new Map([['RIO FRIO','RIOFRÍO'],['CAMPA LA LUISA','CAMPA. LA LUISA'],['CAMP. LA LUISA','CAMPA. LA LUISA'],['MEDIA CANOA','MEDIACANOA'],['CALIMA DARIEN','CALIMA - DARIÉN']]);
export function tariffFor(destination){
 const key=normalizeDestination(destination);
 const alias=aliases.get(key);
 return LOCAL_DISPATCH_TARIFFS.find(item=>normalizeDestination(item.code)===normalizeDestination(alias||key))||null;
}
export function calculateLocalDispatch(destination,weightKg,unloading=0,diversion=0){
 const tariff=tariffFor(destination),weight=Number(weightKg);
 const unload=Number(unloading),detour=Number(diversion);
 const validExtras=Number.isFinite(unload)&&unload>=0&&Number.isFinite(detour)&&detour>=0;
 if(!tariff)return {available:false,reason:'RUTA_SIN_TARIFA',tariff:null,tariffBase:0,extraKg:0,extraCost:0,total:0};
 if(!Number.isFinite(weight)||weight<=0)return {available:false,reason:'PESO_REQUERIDO',tariff,tariffBase:tariff.base,extraKg:0,extraCost:0,total:0};
 if(weight>tariff.maxKg)return {available:false,reason:'PESO_FUERA_DE_RANGO',tariff,tariffBase:tariff.base,extraKg:0,extraCost:0,total:0};
 if(!validExtras)return {available:false,reason:'EXTRAS_INVALIDOS',tariff,tariffBase:tariff.base,extraKg:0,extraCost:0,total:0};
 // Fractional weights above 1,000 kg are rounded UP to the next chargeable kilogram.
 const extraKg=Math.max(0,Math.ceil(weight-tariff.limitKg));
 const extraCost=extraKg*tariff.extraPerKg;
 return {available:true,reason:null,tariffBase:tariff.base,extraKg,extraCost,unloadingCost:unload,diversionCost:detour,total:tariff.base+extraCost+unload+detour,tariff,sourceVersion:LOCAL_DISPATCH_TARIFF_VERSION};
}
export function suggestedDestination(city=''){
 const normalized=normalizeDestination(city);
 return tariffFor(normalized)?.code||'';
}
export function latestInvoiceDefaults(invoices=[]){
 const rows=[...(invoices||[])].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
 const numbers=[...new Set(rows.map(row=>String(row.invoice_number||'').trim()).filter(Boolean))];
 const weight=rows.reduce((sum,row)=>sum+(Number(row.package_weight_kg)||0),0);
 return {invoiceNumber:numbers.join(', '),weightKg:weight||0};
}
export function currencyCOP(value){
 return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(value)||0);
}
