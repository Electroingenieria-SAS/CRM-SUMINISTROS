import { loadWorkEvidencePreview } from "../../../services/drive.js";
import { createWorkEvidenceManager } from "./index.js";

export const workEvidenceManager=createWorkEvidenceManager(loadWorkEvidencePreview,{maxBytes:8*1024*1024,maxEntries:5});
