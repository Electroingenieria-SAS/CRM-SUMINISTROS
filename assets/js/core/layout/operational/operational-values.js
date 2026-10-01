import { fmt } from "../../format.js";

export function escapeText(value){return fmt.escape(String(value??""))}

export function num(value){const n=Number(value);return Number.isFinite(n)?n:0}

export function money(value,currency="COP"){try{return new Intl.NumberFormat("es-CO",{style:"currency",currency:currency||"COP",maximumFractionDigits:0}).format(num(value))}catch{return fmt.number(value)}}
