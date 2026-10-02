import { fmt } from "../../../core/format.js";
import { minutesToClock, bogotaMinutes, toMinutes } from "./calendar-dates.js";

export function buildDaySlots(segments,maxMinutes=120){
  const slots=[];
  for(const segment of segments||[]){
    let cursor=toMinutes(segment.startTime);
    const end=toMinutes(segment.endTime);
    const period=cursor<12*60?"Mañana":"Tarde";

    while(cursor<end){
      const slotEnd=Math.min(end,cursor+maxMinutes);
      slots.push({
        startTime:minutesToClock(cursor),
        endTime:minutesToClock(slotEnd),
        period
      });
      cursor=slotEnd;
    }
  }
  return slots;
}

export function segmentGridTemplate(segments){
  const count=Math.max(1,(segments||[]).length);
  return `repeat(${count},minmax(0,1fr))`;
}

export function slotHeader(slot){
  return `
    <div class="work-calendar-segment-head-v11360 work-calendar-slot-head-v11367">
      <span class="work-calendar-slot-period-v11367">${fmt.escape(slot.period)}</span>
      <strong>${fmt.escape(slot.startTime)}–${fmt.escape(slot.endTime)}</strong>
    </div>`;
}

export function eventOverlapsSlot(row,slot){
  if(!row?.plannedStart)return false;
  const from=bogotaMinutes(row.plannedStart);
  const to=row.plannedEnd?bogotaMinutes(row.plannedEnd):from+1;
  const start=toMinutes(slot.startTime);
  const end=toMinutes(slot.endTime);
  return to>start&&from<end;
}

export function eventSlotIndex(row,slots){
  if(!row?.plannedStart||!slots?.length)return -1;
  const from=bogotaMinutes(row.plannedStart);
  const to=row.plannedEnd?bogotaMinutes(row.plannedEnd):from+1;

  const exact=slots.findIndex(slot=>{
    const start=toMinutes(slot.startTime);
    const end=toMinutes(slot.endTime);
    return from>=start&&from<end;
  });
  if(exact>=0)return exact;

  return slots.findIndex(slot=>{
    const start=toMinutes(slot.startTime);
    const end=toMinutes(slot.endTime);
    return to>start&&from<end;
  });
}

export function timeAxisMarks(start,end){
  const from=toMinutes(start);
  const to=toMinutes(end);
  const duration=Math.max(1,to-from);
  const points=[from];

  let mark=Math.floor(from/60)*60+60;
  while(mark<to){
    points.push(mark);
    mark+=60;
  }

  if(points[points.length-1]!==to)points.push(to);

  return points.map(value=>({
    left:100*(value-from)/duration,
    label:minutesToClock(value)
  }));
}
