// Reference adapter only. Backend is authoritative; never a current official price.
export const TCC_REFERENCE_POLICY=Object.freeze({version:'TCC_WEB_REFERENCE_1',volumetricFactor:400,realThresholdKg:50,volumeThresholdKg:86,surchargeCopKg:50,handlingThresholdCop:200000,handlingRate:.01});
export function calculateTccReference(rate,packages,declaredValue,policy=TCC_REFERENCE_POLICY){
 if(rate===null||rate===undefined)return {status:'UNAVAILABLE',reason:'RATE_UNAVAILABLE',official:false};
 if(!Number.isFinite(rate)||rate<=0)throw Error('Tarifa inválida');
 if(declaredValue===null||declaredValue===undefined||!packages?.length)return {status:'REQUIRES_INFORMATION',official:false};
 if(!Number.isFinite(declaredValue)||declaredValue<0)throw Error('Valor declarado inválido');
 const breakdown=packages.map(p=>{
  const quantity=p.quantity??1,volumeM3=p.volumeM3??p.lengthM*p.widthM*p.heightM;
  if(!Number.isFinite(p.weightKg)||p.weightKg<=0||!Number.isFinite(volumeM3)||volumeM3<=0||!Number.isInteger(quantity)||quantity<1)throw Error('Bulto inválido');
  const volumeWeightKg=volumeM3*policy.volumetricFactor,billableKg=Math.max(p.weightKg,volumeWeightKg);
  const surchargeCopKg=p.weightKg>policy.realThresholdKg||volumeWeightKg>policy.volumeThresholdKg?policy.surchargeCopKg:0;
  return {weightKg:p.weightKg,volumeM3,quantity,volumeWeightKg,billableKg,surchargeCopKg,baseCop:billableKg*(rate+surchargeCopKg)*quantity};
 });
 const baseCop=breakdown.reduce((sum,p)=>sum+p.baseCop,0),handlingCop=declaredValue>=policy.handlingThresholdCop?declaredValue*policy.handlingRate:0;
 return {status:'HISTORICAL_REFERENCE',official:false,policyVersion:policy.version,packages:breakdown,baseCop,handlingCop,subtotalCop:baseCop+handlingCop};
}
export const carrierAdapters=Object.freeze({TCC:calculateTccReference});
