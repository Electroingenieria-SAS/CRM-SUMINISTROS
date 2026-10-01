import { state, hasRole } from "../../../../core/state.js";

export function canReportNoDelivery(){return hasRole("ventas")||hasRole("super_admin")}

export function canConfirmDeliverySatisfaction(){return hasRole("ventas")||hasRole("jefe_logistica")||hasRole("super_admin")}

export function canOperateShipping(){return hasRole("super_admin")||hasRole("coordinador_logistico")||hasRole("despacho_nacional")||hasRole("lider_logistica")||hasRole("jefe_logistica")}

export function canOperateTask(task){const assignee=task?.assigned_profile_id||task?.assignedProfileId;return !assignee||assignee===state.profile?.id||hasRole("super_admin")||hasRole("jefe_logistica")}
