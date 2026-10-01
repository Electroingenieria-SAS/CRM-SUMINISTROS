import { fmt } from "../../../core/format.js";
import { icon } from "../../../core/icons.js";

export const CLIENT_EXTRA_FIELDS=[
  "clientDocument",
  "clientPhone",
  "externalReference",
  "requestedDeliveryDate"
];

const pendingDecisions=new WeakMap();

function hidden(form,name){
  return form?.querySelector(`input[type="hidden"][name="${name}"]`)||null;
}

export function readClientExtraValues(form){
  return Object.fromEntries(CLIENT_EXTRA_FIELDS.map(name=>[name,hidden(form,name)?.value||""]));
}

export function writeClientExtraValues(form,values={}){
  for(const name of CLIENT_EXTRA_FIELDS){
    const input=hidden(form,name);
    if(input)input.value=String(values[name]??"").trim();
  }
  return readClientExtraValues(form);
}

export function clearClientExtraValues(form){
  return writeClientExtraValues(form,{});
}

function formValues(extraForm){
  return Object.fromEntries(CLIENT_EXTRA_FIELDS.map(name=>{
    const control=extraForm.querySelector(`[name="extra_${name}"]`);
    return [name,control?.value||""];
  }));
}

export function openClientExtraDecision({root,form}){
  const modal=root?.querySelector?.(".wizard-modal");
  if(!modal||!form)return Promise.resolve(true);
  if(pendingDecisions.has(modal))return pendingDecisions.get(modal);

  const values=readClientExtraValues(form);
  const promise=new Promise(resolve=>{
    const context=[...modal.children];
    const shell=document.createElement("div");
    shell.className="client-extra-shell-v1191";
    shell.innerHTML=`
      <div class="client-extra-scrim-v1191" aria-hidden="true"></div>
      <section class="client-extra-dialog-v1191" role="region" aria-label="Datos adicionales del cliente" tabindex="-1">
        <button type="button" class="client-extra-close-v1191" data-extra-close aria-label="Cerrar">×</button>
        <div class="client-extra-question-v1191" data-extra-question>
          <span class="client-extra-figure-v1191">${icon("sales")}</span>
          <div class="client-extra-kicker-v1191">DATOS OPCIONALES</div>
          <h4>¿Quiere agregar más datos del cliente?</h4>
          <p>No son necesarios para crear el pedido. Úselos únicamente cuando quiera dejar información comercial adicional para consulta posterior.</p>
          <div class="client-extra-benefits-v1191">
            <span>NIT o documento</span><span>Teléfono</span><span>Referencia externa</span><span>Fecha solicitada</span>
          </div>
          <div class="client-extra-choice-grid-v1191">
            <button type="button" class="client-extra-choice-v1191 secondary" data-extra-no><strong>No hay necesidad</strong><small>Continuar directamente a Materiales</small></button>
            <button type="button" class="client-extra-choice-v1191 primary" data-extra-yes><strong>Sí</strong><small>Agregar los datos opcionales</small></button>
          </div>
        </div>
        <form class="client-extra-form-v1191" data-extra-form hidden>
          <header><span>${icon("sales")}</span><div><strong>Datos adicionales del cliente</strong><small>Complete únicamente lo que tenga disponible. Ningún campo es obligatorio.</small></div></header>
          <div class="client-extra-fields-v1191">
            <label><span>NIT o documento</span><input class="control" name="extra_clientDocument" value="${fmt.escape(values.clientDocument)}" autocomplete="off"></label>
            <label><span>Teléfono</span><input class="control" name="extra_clientPhone" value="${fmt.escape(values.clientPhone)}" inputmode="tel" autocomplete="tel"></label>
            <label><span>Referencia externa</span><input class="control" name="extra_externalReference" value="${fmt.escape(values.externalReference)}"></label>
            <label><span>Fecha solicitada</span><input class="control" name="extra_requestedDeliveryDate" type="date" value="${fmt.escape(values.requestedDeliveryDate)}"></label>
          </div>
          <footer><button type="button" class="btn btn-ghost" data-extra-back>Volver</button><button type="submit" class="btn btn-primary">Guardar y continuar</button></footer>
        </form>
      </section>`;

    context.forEach(node=>{node.setAttribute("inert","");node.setAttribute("aria-hidden","true")});
    modal.append(shell);

    const dialog=shell.querySelector(".client-extra-dialog-v1191");
    const question=shell.querySelector("[data-extra-question]");
    const extraForm=shell.querySelector("[data-extra-form]");

    const finish=result=>{
      context.forEach(node=>{node.removeAttribute("inert");node.removeAttribute("aria-hidden")});
      shell.remove();
      pendingDecisions.delete(modal);
      resolve(result);
    };

    shell.querySelector("[data-extra-close]").onclick=()=>finish(false);
    shell.querySelector(".client-extra-scrim-v1191").onclick=()=>finish(false);
    shell.querySelector("[data-extra-no]").onclick=()=>{
      clearClientExtraValues(form);
      finish(true);
    };
    shell.querySelector("[data-extra-yes]").onclick=()=>{
      question.hidden=true;
      extraForm.hidden=false;
      requestAnimationFrame(()=>extraForm.querySelector("input")?.focus({preventScroll:true}));
    };
    shell.querySelector("[data-extra-back]").onclick=()=>{
      extraForm.hidden=true;
      question.hidden=false;
      requestAnimationFrame(()=>shell.querySelector("[data-extra-yes]")?.focus({preventScroll:true}));
    };
    extraForm.addEventListener("submit",event=>{
      event.preventDefault();
      writeClientExtraValues(form,formValues(extraForm));
      finish(true);
    });
    requestAnimationFrame(()=>{
      dialog.focus({preventScroll:true});
      shell.querySelector("[data-extra-no]")?.focus({preventScroll:true});
    });
  });

  pendingDecisions.set(modal,promise);
  return promise;
}
