import {calculateTccReference} from "./tcc-reference.js";
import {calculateEnviaReference} from "./envia-reference.js";
export const carrierAdapters=Object.freeze({TCC:calculateTccReference,ENVIA:calculateEnviaReference});
export function quoteCanSaveCalculated(result){if(result.commercialEstimate)return result.commercialEstimate.available===true;return result.carrier==="ENVIA"?result.reference?.status==="ESTIMATED_REFERENCE":result.reference?.status==="HISTORICAL_REFERENCE"||!!result.prediction?.available;}
