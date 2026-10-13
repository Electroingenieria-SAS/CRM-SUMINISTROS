export function measurementSummary(materials){
 const result={count:materials.length,weightKg:0,volumeM3:0,weightCount:0,volumeCount:0};
 for(const m of materials)for(const [key,count] of [['weightKg','weightCount'],['volumeM3','volumeCount']]){
  if(m[key]===null||m[key]===undefined||m[key]==='')continue;
  const value=Number(m[key]);if(!Number.isFinite(value)||value<=0)throw Error('El peso o volumen debe ser mayor que cero.');
  result[key]+=value;result[count]++;
 }
 return result;
}
export function restoreMeasurements(input){
 if(input.measurementVersion===2)return input.materials;
 // Old package measurements have no verified allocation to material lines.
 return (input.materials||[]).map(m=>({...m,weightKg:null,volumeM3:null,measurementMode:'WEIGHT'}));
}
