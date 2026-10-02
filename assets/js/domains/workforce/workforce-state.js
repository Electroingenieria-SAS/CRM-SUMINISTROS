import { isoDate, addDays } from "./shared/local-dates.js";

export const workforceState={
liveTimer:null,
currentView:"today",
plannerMode:"week",
plannerAnchor:new Date(),
plannerFilters:{profileId:"ALL",weekday:"ALL",fromTime:"07:00",toTime:"17:30"},
plannerCalendarCache:null,
plannerCatalogCache:null,
plannerCalendarCleanup:null,
analyticsRange:{from:isoDate(addDays(new Date(),-29)),to:isoDate(new Date())}
};
