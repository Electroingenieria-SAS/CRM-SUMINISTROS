import { fmt } from "../../../core/format.js";

export function orderTypeOptions(items=[]){
  return (items||[]).map(item=>({
    ...item,
    name:fmt.label(item?.code)
  }));
}
