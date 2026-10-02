import { uploadOrderFile } from "../../../../services/drive.js";

export async function storeShippingFile(data,file,category,taskId){return uploadOrderFile(data.order.id,file,category,taskId,data.order.order_number)}
