import { fmt } from "../../../core/format.js";
import { statusLabel, statusTone } from "./planned-person.js";

export function assignmentDetailHtml(assignment,allAssignments=[]){
  const a=assignment||{};
  const participants=[...new Map(
    (allAssignments||[]).filter(x=>x.id===a.id&&x.profileName).map(x=>[x.profileId||x.profileName,x.profileName])
  ).values()];
  if(!participants.length&&a.profileName)participants.push(a.profileName);
  const description=String(a.description||"").trim();
  const recurrence=readableObject(a.recurrence);
  const metadata=readableObject(a.metadata);
  const duration=Number(a.estimatedMinutes||0);
  const actualWindow=a.plannedStart
    ? `${fmt.date(a.plannedStart)}${a.plannedEnd?` → ${fmt.date(a.plannedEnd)}`:""}`
    : a.dueAt?`Fecha límite: ${fmt.date(a.dueAt)}`:"Sin horario definido";
  return `<div class="work-detail-v11330">
    <section class="work-detail-hero">
      <div class="work-detail-icon">${a.kind==="DELIVERABLE"?"✓":"◷"}</div>
      <div class="work-detail-hero-copy">
        <div class="work-detail-kickers">
          <span class="work-detail-status ${statusTone(a.memberStatus)}">${fmt.escape(statusLabel(a.memberStatus))}</span>
          <span>${fmt.escape(fmt.label(a.kind||"ACTIVITY"))}</span>
          <span>${fmt.escape(fmt.label(a.priority||"MEDIUM"))}</span>
        </div>
        <h4>${fmt.escape(a.title||"Actividad")}</h4>
        <p>${description?fmt.escape(description):"Sin descripción registrada para esta actividad."}</p>
      </div>
    </section>

    <section class="work-detail-grid">
      ${detailField("Horario",actualWindow)}
      ${detailField("Duración estimada",duration?`${fmt.number(duration)} min`:"—")}
      ${detailField("Responsable",a.profileName||"—")}
      ${detailField("Catálogo / categoría",a.catalogName||fmt.label(a.kind||"ACTIVITY"))}
      ${detailField("Estado de asignación",statusLabel(a.memberStatus))}
      ${detailField("Estado general",fmt.label(a.status||"PUBLISHED"))}
    </section>

    <section class="work-detail-section">
      <header><span>Personas</span><strong>Responsables y participantes</strong></header>
      <div class="work-detail-people">${participants.length?participants.map(name=>`<span><b class="avatar">${fmt.initials(name)}</b><em>${fmt.escape(name)}</em></span>`).join(""):'<p class="muted">Sin participantes registrados.</p>'}</div>
    </section>

    <section class="work-detail-section">
      <header><span>Gobernanza</span><strong>Origen, aprobación y evidencia</strong></header>
      <div class="work-detail-grid compact">
        ${detailField("Origen",fmt.label(a.requestOrigin||"MANUAL"))}
        ${detailField("Motivo",a.requestReason||"—")}
        ${detailField("Aprobación",fmt.label(a.approvalStatus||"—"))}
        ${detailField("Ámbito",fmt.label(a.approvalScope||"—"))}
        ${detailField("Evidencia",fmt.label(a.evidencePolicy||"—"))}
        ${detailField("Aceptación requerida",a.acceptanceRequired?"Sí":"No")}
      </div>
    </section>

    ${recurrence?`<section class="work-detail-section"><header><span>Recurrencia</span><strong>Programación repetitiva</strong></header><div class="work-detail-note">${recurrence}</div></section>`:""}
    ${metadata?`<section class="work-detail-section"><header><span>Información adicional</span><strong>Datos registrados</strong></header><div class="work-detail-note">${metadata}</div></section>`:""}
  </div>`;
}

export function detailField(label,value){
  return `<div class="work-detail-field"><span>${fmt.escape(label)}</span><strong>${fmt.escape(String(value??"—"))}</strong></div>`;
}

export function readableObject(value){
  if(value==null)return "";
  if(typeof value==="object"&&Object.keys(value).length===0)return "";
  const text=fmt.data(value);
  if(!text||text==="—")return "";
  return fmt.escape(text).replaceAll("\n","<br>");
}
