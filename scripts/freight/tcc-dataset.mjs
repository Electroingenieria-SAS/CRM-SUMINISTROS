import crypto from 'node:crypto';
export const SOURCE_SHA256='0a56ce97012329b5fa5a7fc758f628416a544e54ecd8417a0f26ddc595b98bb2';
export function parseTariffs(text){
 const lines=text.replace(/^\uFEFF/,'').trimEnd().split(/\r?\n/);
 const parse=line=>{const fields=[];let field='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){fields.push(field);field='';}else field+=c;}if(quoted)throw Error('CSV sin cierre');fields.push(field);return fields;};
 const headers=parse(lines.shift());
 return lines.map(line=>{const fields=parse(line);if(fields.length!==headers.length)throw Error('Esquema CSV inválido');const row=Object.fromEntries(headers.map((h,i)=>[h,fields[i]]));row.paq_rate_cop_kg_reference=row.paq_rate_cop_kg_reference===''?null:Number(row.paq_rate_cop_kg_reference);return row;});
}
export function validateTariffs(rows){
 const ids=new Set();
 for(const r of rows){
  if(ids.has(r.tcc_row_id)||!/^TCC_\d{4}_\d{2}$/.test(r.tcc_row_id))throw Error('ID inválido o repetido');ids.add(r.tcc_row_id);
  if(r.source_sha256!==SOURCE_SHA256||r.tariff_version!=='TRADICIONALES_2023_2024'||r.carrier!=='TCC'||r.service_type!=='PAQ'||!['N','O','Z','R','U','E'].includes(r.msj_code))throw Error('Contrato de datos inválido');
  const rate=r.paq_rate_cop_kg_reference;
  if(rate!==null&&(!Number.isInteger(rate)||rate<=0||Number(r.paq_rate_source_text.replaceAll('.',''))!==rate))throw Error('Tarifa inválida');
  if(rate===null&&(r.data_status!=='FUENTE_DANADA_O_ILEGIBLE'||r.source_page!=='4'||!r.destination_pdf.startsWith('BARRANCABERMEJA')))throw Error('NULL no autorizado');
 }
 const result={rows:rows.length,rates:rows.filter(r=>r.paq_rate_cop_kg_reference!==null).length,missing:rows.filter(r=>r.paq_rate_cop_kg_reference===null).length,origins:new Set(rows.map(r=>r.origin_city)).size,msj:rows.filter(r=>r.msj_code).length};
 if(JSON.stringify(result)!==JSON.stringify({rows:30107,rates:30086,missing:21,origins:23,msj:30107}))throw Error('Lote incompleto');
 return result;
}
export const datasetChecksum=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
