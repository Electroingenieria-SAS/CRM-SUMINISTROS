import { dayPlannerHtml } from "./planned-day.js";
import { weekPlannerHtml } from "./planned-week.js";
import { monthPlannerHtml } from "./planned-month.js";

export function renderPlannerBoard({mode,anchor,data,calendar}){
  if(mode==="day")return dayPlannerHtml(data,calendar,anchor);
  if(mode==="month")return monthPlannerHtml(data,calendar,anchor);
  return weekPlannerHtml(data,calendar,anchor);
}
