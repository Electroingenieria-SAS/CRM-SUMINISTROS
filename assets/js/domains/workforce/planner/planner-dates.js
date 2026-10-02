

export function toMinutes(value){const [h,m]=String(value||"0:0").split(":").map(Number);return h*60+m}

export function hourMarks(start,end){const s=toMinutes(start),e=toMinutes(end),duration=e-s,result=[];for(let m=Math.ceil(s/60)*60;m<e;m+=60)result.push({label:`${String(Math.floor(m/60)).padStart(2,"0")}:00`,left:100*(m-s)/duration});return result}

export function bogotaMinutes(value){const parts=new Intl.DateTimeFormat("en-CA",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Bogota"}).formatToParts(new Date(value));return Number(parts.find(x=>x.type==="hour")?.value||0)*60+Number(parts.find(x=>x.type==="minute")?.value||0)}

export function timeOnly(value){if(!value)return"—";return new Intl.DateTimeFormat("es-CO",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Bogota"}).format(new Date(value))}

export function weekdayShort(value){return new Intl.DateTimeFormat("es-CO",{weekday:"short",timeZone:"America/Bogota"}).format(value).replace(".","").replace(/^./,c=>c.toUpperCase())}

export function monthShort(value){return new Intl.DateTimeFormat("es-CO",{month:"short",timeZone:"America/Bogota"}).format(value).replace(".","")}

export function startOfDay(value){const d=new Date(value);d.setHours(0,0,0,0);return d}

export function startOfWeek(value){const d=startOfDay(value),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d}

export function addDays(value,n){const d=new Date(value);d.setDate(d.getDate()+n);return d}

export function parseIsoDate(value){const [y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d,12,0,0,0)}

export function isoDate(value){const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}

export function isoWeekday(value){return ((new Date(value).getDay()+6)%7)+1}

export function sameDate(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}

export function isToday(value){return sameDate(new Date(),new Date(value))}
