import {decimal,multiply,divide,maximum,ceil,floor,halfUp,displayDecimal} from './decimal-ratio.js';
export function calculateEnviaReference(rule,packages,policy){
 if(!rule)return {status:'UNAVAILABLE',reason:'ROUTE_UNDOCUMENTED',official:false};
 if(!Array.isArray(packages)||!packages.length)return {status:'REQUIRES_INFORMATION',official:false};
 const warnings=['DIVISOR_ASSUMED_5000','SOURCE_CONFIDENCE_NOT_STATISTICAL','ORIGIN_NOT_VERIFIED'];
 const parsed=packages.map(p=>{
  const weight=decimal(p.weightKg),qty=decimal(p.quantity??1);
  if(weight.n<=0n||qty.n<qty.d||qty.n%qty.d!==0n)throw Error('Peso o cantidad inválidos');
  let volume=null,partialDimensions=false;
  const dimensions=[p.lengthM,p.widthM,p.heightM];
  for(const d of dimensions)if(d!==null&&d!==undefined&&decimal(d).n<=0n)throw Error('Dimensión inválida');
  if(p.volumeM3!==null&&p.volumeM3!==undefined){volume=decimal(p.volumeM3);if(volume.n<=0n)throw Error('Volumen inválido');}
  else if(dimensions.every(v=>v!==null&&v!==undefined))volume=dimensions.map(decimal).reduce(multiply);
  else if(dimensions.some(v=>v!==null&&v!==undefined))partialDimensions=true;
  return {weight,qty,volume,partialDimensions};
 });
 if(parsed.length!==1||parsed[0].qty.n!==parsed[0].qty.d)return {status:'PENDING_PACKAGING_RULE',official:false,warnings:[...warnings,'MULTI_PACKAGE_POLICY_UNCONFIRMED']};
 const p=parsed[0];if(p.partialDimensions)return {status:'REQUIRES_INFORMATION',official:false,warnings};
 const volumetric=p.volume?divide(multiply(p.volume,decimal('1000000')),decimal(policy.divisor_volumetrico_cm3_por_kg)):decimal(0);
 const billable=ceil(maximum(p.weight,volumetric));
 if(billable>1000000n)throw Error('Peso fuera de rango');
 const rate=decimal(rule.rate_per_kg_cop),minimum=decimal(rule.min_base_cop);
 const base=halfUp(maximum(minimum,multiply({n:billable,d:1n},rate))),total=base+BigInt(rule.fixed_variable_cop);
 const threshold=floor(divide(minimum,rate))+1n;
 const distance=billable>threshold?billable-threshold:threshold-billable;
 const cautious=rule.source_confidence==='media'||distance<BigInt(policy.caution_threshold_distance_kg);
 const margin=decimal(cautious?policy.caution_margin:policy.default_margin);
 const low=halfUp({n:total*(margin.d-margin.n),d:margin.d}),high=halfUp({n:total*(margin.d+margin.n),d:margin.d});
 if(!p.volume)warnings.push('DIMENSIONS_NOT_CONFIRMED');if(billable>BigInt(policy.max_verified_weight_kg))warnings.push('EXTRAPOLATED_OVER_100_KG');
 return {status:'ESTIMATED_REFERENCE',official:false,ruleKey:rule.key,weightKg:displayDecimal(p.weight),volumeWeightKg:displayDecimal(volumetric),billableKg:Number(billable),rateCopKg:rule.rate_per_kg_cop,minimumCop:rule.min_base_cop,baseCop:Number(base),variableCop:rule.fixed_variable_cop,totalCop:Number(total),rangeLowCop:Number(low),rangeHighCop:Number(high),thresholdKg:Number(threshold),marginPct:displayDecimal(margin)*100,sourceConfidence:rule.source_confidence,provisionalDimensions:!p.volume,warnings};
}
