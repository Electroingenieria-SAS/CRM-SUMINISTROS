import { paco } from "../paco-state.js";
import { profileId } from "../context/profile-context.js";

export function digestStorageKey(){return `paco_digest_v11371_${profileId()||"anonymous"}`}

export function readLastDigest(){
  try{return Number(sessionStorage.getItem(digestStorageKey())||0)}catch{return 0}
}

export function saveLastDigest(){
  try{sessionStorage.setItem(digestStorageKey(),String(paco.lastDigestAt||0))}catch{}
}
