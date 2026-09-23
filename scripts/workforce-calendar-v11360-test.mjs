import fs from "node:fs";
import assert from "node:assert/strict";
import {
  createWorkEvidenceManager,
  collectPreviewRefs
} from "../assets/js/modules/workforce-evidence-manager-v11360.js";
import {
  renderWorkforceCalendarBoard
} from "../assets/js/modules/workforce-calendar-v11360.js";

let transportCalls=0;
let releaseTransport;
const transportGate=new Promise(resolve=>{releaseTransport=resolve});

const manager=createWorkEvidenceManager(async(evidenceId,fileId)=>{
  transportCalls+=1;
  await transportGate;
  return {
    fileName:"evidencia.jpg",
    mimeType:"image/jpeg",
    sizeBytes:1200,
    dataUrl:"data:image/jpeg;base64,AAAA",
    evidenceId,
    fileId
  };
},{maxBytes:4096,maxEntries:2});

const a=manager.get("ev-1","file-1");
const b=manager.get("ev-1","file-1");
assert.equal(transportCalls,1,"Solicitudes simultáneas deben deduplicarse.");
releaseTransport();
const [pa,pb]=await Promise.all([a,b]);
assert.equal(pa.dataUrl,pb.dataUrl);
assert.equal(manager.stats().entries,1);
assert.equal(manager.stats().pending,0);

await manager.get("ev-1","file-1");
assert.equal(transportCalls,1,"El segundo acceso debe resolverse desde caché.");

const refs=collectPreviewRefs([
  {id:"a",previewEvidenceId:"e1",previewDriveFileId:"d1"},
  {id:"a-duplicate",previewEvidenceId:"e1",previewDriveFileId:"d1"},
  {id:"b",previewEvidenceId:"e2",previewDriveFileId:"d2"},
  {id:"c"}
],6);
assert.deepEqual(refs,[
  {evidenceId:"e1",fileId:"d1",itemId:"a"},
  {evidenceId:"e2",fileId:"d2",itemId:"b"}
]);

const calendar={
  segments:[
    {isoWeekday:1,startTime:"07:00",endTime:"12:00"},
    {isoWeekday:1,startTime:"13:40",endTime:"17:30"}
  ],
  holidays:[],
  holidayMap:new Map(),
  workingWeekdays:[1,2,3,4,5],
  minutesPerBusinessDay:530
};

const data={
  people:[{id:"p1",name:"Mabel Jiménez"}],
  assignments:[{
    id:"a1",
    assignmentId:"a1",
    executionId:"x1",
    profileId:"p1",
    profileName:"Mabel Jiménez",
    title:"Alistamiento de mercancía",
    catalogName:"Alistamiento y picking",
    kind:"ACTIVITY",
    plannedStart:"2026-09-21T11:06:00-05:00",
    plannedEnd:"2026-09-21T11:37:00-05:00",
    memberStatus:"COMPLETED",
    hasPhoto:true,
    previewEvidenceId:"e1",
    previewDriveFileId:"d1",
    canCancel:false
  }]
};

const monday=new Date(2026,8,21,9,0,0);
const dayHtml=renderWorkforceCalendarBoard({
  mode:"day",
  anchor:monday,
  data,
  calendar
});
assert.equal(dayHtml.includes("work-calendar-event-day-v11360"),true);
assert.equal(dayHtml.includes("Alistamiento de mercancía"),true);
assert.equal(dayHtml.includes("11:06"),true);
assert.equal(dayHtml.includes("11:06"),true);

const weekHtml=renderWorkforceCalendarBoard({
  mode:"week",
  anchor:monday,
  data,
  calendar
});
assert.equal(weekHtml.includes("work-calendar-event-week-v11360"),true);
assert.equal(weekHtml.includes("work-calendar-event-week-v11360"),true);

const migration=fs.readFileSync(
  new URL("../supabase/migrations/120_workforce_calendar_feed_v11_36_0.sql",import.meta.url),
  "utf8"
);
for(const token of [
  '"previewEvidenceId"',
  '"previewDriveFileId"',
  "'version','11.36.0'",
  "idx_work_evidence_execution"
].filter(Boolean)){
  if(token==="idx_work_evidence_execution")continue;
  assert.equal(migration.includes(token),true,`Migración V11.36.0 debe contener ${token}`);
}
assert.equal(/create\s+table/i.test(migration),false,"V11.36.0 no debe crear tablas.");
assert.equal(/create\s+(unique\s+)?index/i.test(migration),false,"V11.36.0 no debe crear índices.");

const workforce=fs.readFileSync(new URL("../assets/js/modules/workforce.js",import.meta.url),"utf8");
for(const token of [
  "createWorkEvidenceManager",
  "renderWorkforceCalendarBoard",
  "bindWorkforceCalendar",
  "ensureWorkforceCalendarStyles"
]){
  assert.equal(workforce.includes(token),true,`Workforce debe integrar ${token}`);
}

const css=fs.readFileSync(new URL("../assets/runtime-css/workforce-calendar-v11360.css",import.meta.url),"utf8");
for(const token of [
  "min-height:82px",
  "height:32px",
  "work-calendar-cloud-v11361",
  "work-calendar-filterbar-v11361",
  "overflow-x:auto",
  "overscroll-behavior-y:auto",
  "work-calendar-worker-chip-v11361",
  "@media(hover:hover) and (pointer:fine)"
]){
  assert.equal(css.includes(token),true,`CSS calendario debe conservar ${token}`);
}

const calendarModule=fs.readFileSync(new URL("../assets/js/modules/workforce-calendar-v11360.js",import.meta.url),"utf8");
for(const token of [
  "dblclick",
  "showCalendarCloud",
  "filterCalendarData",
  "clipCalendarSegments",
  "pointerenter",
  "closeOnViewportMove"
]){
  assert.equal(calendarModule.includes(token),true,`Calendario compacto debe conservar ${token}`);
}
assert.equal(calendarModule.includes('clickHandler=event=>{\n      if(event.target.closest("[data-assignment-cancel]"))return;\n      event.stopPropagation();\n      openItem(id);'),false,"El clic simple no debe abrir directamente la ficha completa.");

for(const token of [
  "plannerFilters",
  "data-plan-filter-worker",
  "data-plan-filter-from",
  "data-plan-filter-to",
  "data-plan-filter-weekday",
  "repaintCalendar"
]){
  assert.equal(workforce.includes(token),true,`Workforce debe conservar filtro ${token}`);
}

console.log("workforce calendar v11.36.1 tests: OK");
