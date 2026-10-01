import { fmt } from "../../../../core/format.js";

export function esc(value){return fmt.escape(String(value??""))}

export function normalize(value){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}

export function n(value){const x=Number(value);return Number.isFinite(x)?x:0}

export function dateInput(date=new Date()){return new Date(date).toISOString().slice(0,10)}
