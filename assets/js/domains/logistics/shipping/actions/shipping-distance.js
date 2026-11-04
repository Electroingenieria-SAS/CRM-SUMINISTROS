import { colombianDepartments, colombianMunicipalities } from "../../../../services/location.js";
import { api } from "../../../../services/api.js";

// La distancia vial estimada no equivale al kilometraje real registrado por GPS.
// Nunca se calcula a partir de kilómetros en línea recta ni de factores arbitrarios.
const ROUTER="https://routing.openstreetmap.de/routed-car/route/v1/driving/";
const CACHE_PREFIX="erp_shipping_route_km_v1:";
const CACHE_TTL=30*24*60*60*1000;
const memoryCache=new Map();

function normalize(value){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLocaleUpperCase("es-CO").replace(/[^A-Z0-9]+/g," ").trim().replace(/\s+/g," ");
}
function validPoint(point){
  return point&&Number.isFinite(Number(point.latitude))&&Number.isFinite(Number(point.longitude))
    &&point.latitude>=-5&&point.latitude<=14&&point.longitude>=-83&&point.longitude<=-66;
}
export function routeCacheKey(origin,destination){
  return [origin.code,destination.code].join(":");
}

async function municipalityPoint(departmentName,cityName){
  const department=colombianDepartments().find(item=>normalize(item.name)===normalize(departmentName));
  if(!department)throw new Error("No se pudo identificar el departamento de la ruta.");
  const city=normalize(cityName);
  if(!city)throw new Error("El destino del envío no tiene municipio.");
  const municipalities=await colombianMunicipalities(department.code);
  const municipality=municipalities.find(item=>normalize(item.name)===city);
  if(!municipality||!validPoint(municipality))throw new Error("El municipio del envío no tiene coordenadas oficiales suficientes.");
  return municipality;
}

function fromCache(key){
  const cached=memoryCache.get(key);
  if(cached&&cached.at+CACHE_TTL>Date.now())return cached.value;
  try{
    const saved=JSON.parse(localStorage.getItem(CACHE_PREFIX+key));
    if(saved&&saved.at+CACHE_TTL>Date.now()&&saved.value?.distanceKm>0){
      memoryCache.set(key,saved);
      return saved.value;
    }
  }catch{}
  return null;
}
function intoCache(key,value){
  const data={at:Date.now(),value};
  memoryCache.set(key,data);
  try{localStorage.setItem(CACHE_PREFIX+key,JSON.stringify(data))}catch{}
}
async function roadDistance(origin,destination){
  const path=[origin,destination]
    .map(point=>`${Number(point.longitude).toFixed(6)},${Number(point.latitude).toFixed(6)}`).join(";");
  const url=`${ROUTER}${path}?overview=false&steps=false&alternatives=false`;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error("El servicio de rutas no respondió.");
    const data=await response.json();
    const meters=Number(data?.routes?.[0]?.distance);
    if(data?.code!=="Ok"||!Number.isFinite(meters)||meters<=0||meters>100_000_000){
      throw new Error("El servicio no encontró una ruta vial.");
    }
    return Math.round(meters/100)/10;
  }finally{clearTimeout(timeout)}
}

// Únicamente se transfieren coordenadas del centro de los municipios: no se envía
// la dirección privada del cliente a terceros. Limitado a una consulta por confirmación.
export async function estimateShipmentDistance(orderId){
  const context=await api.shippingDistanceContext(orderId);
  if(context?.distanceKm!=null&&Number(context.distanceKm)>0){
    return {distanceKm:Number(context.distanceKm),distanceSource:context.distanceSource||null,previouslyRecorded:true};
  }
  if(!["LOCAL_DISPATCH","NATIONAL_DISPATCH"].includes(context?.route)){
    return {distanceKm:null,distanceSource:null,notApplicable:true};
  }
  const origin=await municipalityPoint(context.originDepartment,context.originCity);
  const destination=await municipalityPoint(context.destinationDepartment,context.destinationCity);
  if(origin.code===destination.code){
    return {distanceKm:null,distanceSource:null,reason:"El origen y destino están en el mismo municipio; faltan coordenadas de calle para calcular el recorrido."};
  }
  const key=routeCacheKey(origin,destination);
  const cached=fromCache(key);
  if(cached)return cached;
  const km=await roadDistance(origin,destination);
  const value={
    distanceKm:km,
    distanceSource:"ROUTE_ESTIMATE",
    estimated:true,
    origin:origin.name,
    destination:destination.name,
    sourceLabel:"Ruta vial estimada · © OpenStreetMap contributors"
  };
  intoCache(key,value);
  return value;
}
