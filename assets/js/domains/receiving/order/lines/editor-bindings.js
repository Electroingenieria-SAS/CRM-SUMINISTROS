import { toast } from "../../../../core/ui.js";
import { renderWorkbench } from "../reception-controller.js";
import { editableLine } from "./editable-line.js";
import { collectEditorLines } from "./read-editor-lines.js";
import { bindRows, syncCutRow, renumberEditor } from "./row-bindings.js";
import { persistDraft } from "../draft/reception-draft.js";
import { blankLine } from "./map-reception-line.js";

export function bindLineEditor(host,data,draft,callbacks){
  const editor=host.querySelector("[data-lines-editor]");
  if(!editor)return;
  bindRows(editor);
  const save=()=>{
    try{draft.lines=collectEditorLines(editor,false);persistDraft(data.order.id,draft)}catch{}
  };
  editor.addEventListener("input",save);
  editor.addEventListener("material:selected",save);
  editor.addEventListener("change",event=>{if(event.target.matches('[data-field="requiresCut"]'))syncCutRow(event.target.closest("[data-line-row]"));save()});
  editor.addEventListener("click",event=>{
    const remove=event.target.closest("[data-remove-line]");
    if(!remove)return;
    remove.closest("[data-line-row]")?.remove();
    renumberEditor(editor);
    save();
  });
  host.querySelector("[data-add-line]")?.addEventListener("click",()=>{
    const emptyMessage=editor.querySelector(".reception-file-warning");
    emptyMessage?.remove();
    editor.insertAdjacentHTML("beforeend",editableLine(blankLine(),editor.querySelectorAll("[data-line-row]").length));
    bindRows(editor);
    renumberEditor(editor);
  });
  host.querySelector("[data-confirm-lines]")?.addEventListener("click",()=>{
    try{
      draft.lines=collectEditorLines(editor,true);
      draft.stage="ASSIGN";
      persistDraft(data.order.id,draft);
      renderWorkbench(host,data,draft,callbacks);
    }catch(error){toast(error.message,"error",7000)}
  });
}
