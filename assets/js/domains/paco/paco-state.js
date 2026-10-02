import { readVoicePreference, readPreferredVoice } from "./voice/preferences.js";

export const paco={
  root:null,
  messages:[],
  busy:false,
  face:"idle",
  voiceEnabled:readVoicePreference(),
  preferredVoiceId:readPreferredVoice(),
  monitorTimer:null,
  monitorBusy:false,
  previous:null,
  catalog:null,
  catalogLoadedAt:0,
  flow:null,
  unsubscribe:null,
  globalBound:false,
  alertMemory:new Map(),
  lastDigestAt:0,
  snapshotRpcUnavailableUntil:0
};
