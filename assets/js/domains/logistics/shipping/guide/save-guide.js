import { api } from "../../../../services/api.js";

export async function saveShippingGuideExplicit(orderId,payload,{save=api.saveShippingGuide}={}){
  return save(orderId,payload);
}
