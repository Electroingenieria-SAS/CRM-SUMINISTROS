

export function roundToFiveMinutes(value){const d=new Date(value);d.setSeconds(0,0);const remainder=d.getMinutes()%5;if(remainder)d.setMinutes(d.getMinutes()+(5-remainder));return d}

export function localDateTimeInput(value){const d=new Date(value);const pad=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}

export function clock(seconds){const n=Math.max(0,Math.floor(Number(seconds||0))),h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=n%60;return [h,m,s].map(x=>String(x).padStart(2,"0")).join(":")}

export function isoDate(d){const date=new Date(d);const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),day=String(date.getDate()).padStart(2,"0");return `${y}-${m}-${day}`}

export function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}

export function addMonths(d,n){const x=new Date(d);x.setMonth(x.getMonth()+n);return x}

export function timeOnly(value){if(!value)return"—";return new Intl.DateTimeFormat("es-CO",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Bogota"}).format(new Date(value))}

export function weekdayShort(value){return new Intl.DateTimeFormat("es-CO",{weekday:"short",timeZone:"America/Bogota"}).format(new Date(value)).replace(".","").replace(/^./,c=>c.toUpperCase())}
