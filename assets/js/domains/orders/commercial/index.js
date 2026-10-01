import { install } from "./installation.js";

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
