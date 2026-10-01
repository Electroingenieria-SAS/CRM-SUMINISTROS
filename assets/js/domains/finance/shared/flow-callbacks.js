import { toast } from "../../../core/ui.js";

export function closeHost(host){host.replaceChildren()}

export function refresh(refreshLists){refreshLists?.()}

export async function guarded(action){try{return await action()}catch(error){toast(error.message||String(error),"error",7000)}}
