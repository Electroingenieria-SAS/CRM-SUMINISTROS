import fs from "node:fs";
import assert from "node:assert/strict";
import {
  businessDaysForRange,
  plannerRangeForMode,
  normalizePlannerCalendar,
  nextBusinessAnchor,
  renderPlannerBoard
} from "../assets/js/modules/workforce-planner-v11330.js";

const calendar=normalizePlannerCalendar({
  segments:[
    {iso_weekday:1,start_time:"07:00:00",end_time:"12:00:00"},
    {iso_weekday:1,start_time:"13:40:00",end_time:"17:30:00"},
    {iso_weekday:2,start_time:"07:00:00",end_time:"12:00:00"},
    {iso_weekday:2,start_time:"13:40:00",end_time:"17:30:00"},
    {iso_weekday:3,start_time:"07:00:00",end_time:"12:00:00"},
    {iso_weekday:3,start_time:"13:40:00",end_time:"17:30:00"},
    {iso_weekday:4,start_time:"07:00:00",end_time:"12:00:00"},
    {iso_weekday:4,start_time:"13:40:00",end_time:"17:30:00"},
    {iso_weekday:5,start_time:"07:00:00",end_time:"12:00:00"},
    {iso_weekday:5,start_time:"13:40:00",end_time:"17:30:00"}
  ],
  holidays:[
    {holiday_date:"2026-10-12",name:"Día de la Diversidad Étnica y Cultural"}
  ]
});

assert.equal(calendar.minutesPerBusinessDay,530,"La jornada real debe ser 8 h 50 min");
assert.deepEqual(calendar.workingWeekdays,[1,2,3,4,5],"Solo lunes a viernes son laborales");

const week=plannerRangeForMode("week",new Date("2026-10-12T12:00:00-05:00"));
assert.equal(week.from,"2026-10-12");
assert.equal(week.to,"2026-10-16");

const day=plannerRangeForMode("day",new Date("2026-10-13T12:00:00-05:00"));
assert.deepEqual(day,{from:"2026-10-13",to:"2026-10-13"});

const business=businessDaysForRange("2026-10-12","2026-10-16",calendar);
assert.deepEqual(
  business.map(x=>({date:x.date,isHoliday:x.isHoliday})),
  [
    {date:"2026-10-12",isHoliday:true},
    {date:"2026-10-13",isHoliday:false},
    {date:"2026-10-14",isHoliday:false},
    {date:"2026-10-15",isHoliday:false},
    {date:"2026-10-16",isHoliday:false}
  ],
  "La semana mantiene el festivo visible pero bloqueado y elimina sábados/domingos"
);

const month=businessDaysForRange("2026-10-01","2026-10-31",calendar);
assert.equal(month.some(x=>[0,6].includes(new Date(x.date+"T12:00:00-05:00").getDay())),false,"El mes no debe contener fines de semana");
assert.equal(month.find(x=>x.date==="2026-10-12")?.isHoliday,true,"Los festivos deben identificarse");


const next=nextBusinessAnchor(new Date("2026-10-09T12:00:00-05:00"),1,calendar);
assert.equal(next.getFullYear(),2026);
assert.equal(next.getMonth(),9);
assert.equal(next.getDate(),13,"La navegación diaria debe saltar fin de semana y festivo del lunes");

const november=renderPlannerBoard({
  mode:"month",
  anchor:new Date("2026-11-01T12:00:00-05:00"),
  data:{people:[],assignments:[]},
  calendar
});
assert.equal((november.match(/work-month-day-v11330 spacer/g)||[]).length,0,"Un mes que inicia en fin de semana debe comenzar visualmente en el primer lunes laboral");

const migrationPath=new URL("../supabase/migrations/115_workforce_planner_calendar_v11_33_0.sql",import.meta.url);
assert.equal(fs.existsSync(migrationPath),true,"Debe existir la migración V11.33.0 del cronograma");
const sql=fs.readFileSync(migrationPath,"utf8");
for(const token of ["'calendar'","work_calendar_segments","erp_supply.holidays","activeStatus","validate_work_assignment_business_window","OUTSIDE_WORKING_TIME"]){
  assert.equal(sql.includes(token),true,`La migración debe contener: ${token}`);
}

const css=fs.readFileSync(new URL("../assets/css/core-shell.css",import.meta.url),"utf8");
for(const token of [".work-day-timeline-head",".work-person-state.busy",".work-week-grid-v11330",".work-month-grid-v11330",".work-assignment-card-v11330"]){
  assert.equal(css.includes(token),true,`La capa visual del cronograma debe definir: ${token}`);
}
console.log("workforce planner calendar tests: OK");


