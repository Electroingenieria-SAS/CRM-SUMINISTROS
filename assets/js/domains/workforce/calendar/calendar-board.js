import { dayBoard } from "./day-board.js";
import { weekBoard } from "./week-board.js";
import { monthBoard } from "./month-board.js";
import { minutesToClock, bogotaMinutes, toMinutes, isoWeekday } from "./calendar-dates.js";

export function renderWorkforceCalendarBoard({mode,anchor,data,calendar,filters={}}){
  const safeData=filterCalendarData(data||{},filters,mode);
  if(mode==="day")return dayBoard(safeData,calendar,anchor,filters);
  if(mode==="month")return monthBoard(safeData,calendar,anchor);
  return weekBoard(safeData,calendar,anchor);
}

export function filterCalendarData(data,filters={},mode="week"){
  const profileId=String(filters.profileId||"ALL");
  const weekday=String(filters.weekday||"ALL");
  const from=toMinutes(filters.fromTime||"07:00");
  const to=toMinutes(filters.toTime||"17:30");

  const people=(data.people||[]).filter(person=>profileId==="ALL"||String(person.id)===profileId);
  const assignments=(data.assignments||[]).filter(item=>{
    if(profileId!=="ALL"&&String(item.profileId)!==profileId)return false;
    const stamp=item.plannedStart||item.dueAt||item.actualStart||null;
    if(mode!=="day"&&weekday!=="ALL"&&stamp&&String(isoWeekday(new Date(stamp)))!==weekday)return false;
    if(item.plannedStart){
      const start=bogotaMinutes(item.plannedStart);
      const end=item.plannedEnd?bogotaMinutes(item.plannedEnd):start+1;
      if(end<=from||start>=to)return false;
    }
    return true;
  });

  return {...data,people,assignments};
}

export function clipCalendarSegments(segments,filters={}){
  const from=toMinutes(filters.fromTime||"07:00");
  const to=toMinutes(filters.toTime||"17:30");
  if(to<=from)return segments;
  return (segments||[]).map(segment=>{
    const start=Math.max(from,toMinutes(segment.startTime));
    const end=Math.min(to,toMinutes(segment.endTime));
    if(end<=start)return null;
    return {...segment,startTime:minutesToClock(start),endTime:minutesToClock(end)};
  }).filter(Boolean);
}
