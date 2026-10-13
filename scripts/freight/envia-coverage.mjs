export const territoryKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[.,]/g,'').replace(/\s+/g,' ').trim();
export function coverageFor(sourceKey){
 const mixed={'Tolima (Ibagué)':['TOLIMA','IBAGUE'],'Nariño (Pasto)':['NARINO','PASTO'],'Cauca (Popayán)':['CAUCA','POPAYAN'],'Atlántico (Barranquilla)':['ATLANTICO','BARRANQUILLA'],'Casanare (Yopal)':['CASANARE','YOPAL'],'Córdoba (Montería)':['CORDOBA','MONTERIA'],'Boyacá (Tunja)':['BOYACA','TUNJA']};
 if(mixed[sourceKey])return {departmentKey:mixed[sourceKey][0],cityKey:mixed[sourceKey][1],scope:'CITY',priority:100};
 const department=({'Valle del Cauca (Cali)':'VALLE DEL CAUCA','Caquetá (Florencia)':'CAQUETA','Boyacá (general)':'BOYACA','Bogotá':'BOGOTA DC'})[sourceKey]||territoryKey(sourceKey);
 return {departmentKey:department,cityKey:sourceKey==='Bogotá'?'BOGOTA':'',scope:sourceKey==='Bogotá'?'CITY':'DEPARTMENT',priority:sourceKey==='Bogotá'?100:10};
}
export function resolveEnviaRule(entries,department,city){
 let dep=territoryKey(department),locality=territoryKey(city).replace(/\s*\([^)]*\)\s*$/,'').trim();
 if(['BOGOTA','BOGOTA DC'].includes(locality)&&['CUNDINAMARCA','BOGOTA DC','BOGOTA'].includes(dep)){dep='BOGOTA DC';locality='BOGOTA';}
 if(!dep||!locality)return null;
 const matches=entries.map(r=>({...r,coverageResolved:coverageFor(r.key)})).filter(r=>r.coverageResolved.departmentKey===dep&&(r.coverageResolved.scope==='DEPARTMENT'||r.coverageResolved.cityKey===locality));
 matches.sort((a,b)=>b.coverageResolved.priority-a.coverageResolved.priority);
 return matches[0]||null;
}
