set -euo pipefail
validation_dir=$(mktemp -d)
trap 'rm -rf "$validation_dir"' EXIT
for family in operations analytics; do
  node --input-type=module -e 'import {readCssSource} from "./scripts/tests/read-css-source.mjs"; console.log(readCssSource(process.argv[1]));' "assets/css/$family.css" > "$validation_dir/$family.css"
done
grep -q 'version: "11.46.0"' assets/js/config.js
grep -q 'build: "2026-10-06.40"' assets/js/config.js
grep -q '"version": "11.46.0"' package.json
grep -q '"version": "11.46.0"' package-lock.json
grep -q 'app-entry.js?v=11.46.0' index.html
grep -Fq 'https://script.google.com/macros/s/AKfycbwjl1JCfE0eV92P6DCn6h8jIVIBlSwLOQj8U7Mz1_7YW2Xan8DPI5tpWJuiG7znSCSs/exec' assets/js/config.js
grep -Fxq '// previous-cache: crm-suministros-v11-45-0-20261002-39' service-worker.js
grep -Fxq 'const CACHE="crm-suministros-v11-46-0-20261006-40";' service-worker.js
grep -q 'manifest.webmanifest' vercel.json
test "$(grep -c '<link rel="stylesheet" href="./assets/css/' index.html)" -eq 4
test "$(find assets/css -maxdepth 1 -type f -name '*.css' | wc -l)" -eq 4

for css in core-shell operations analytics experience; do
  test -s "assets/css/${css}.css"
  grep -q "./assets/css/${css}.css" assets/precache-manifest.json
done

test -s "assets/js/domains/workforce/today/experience-styles.js"
grep -q "./assets/js/domains/workforce/today/experience-styles.js" assets/precache-manifest.json
test -s "assets/js/domains/workforce/timeline/index.js"
grep -q "./assets/js/domains/workforce/timeline/index.js" assets/precache-manifest.json
test -s "assets/js/domains/workforce/calendar/index.js"
test -s "assets/js/domains/workforce/evidence/index.js"
grep -q "./assets/js/domains/workforce/calendar/index.js" assets/precache-manifest.json
grep -q "./assets/js/domains/workforce/evidence/index.js" assets/precache-manifest.json

test -s "assets/js/domains/paco/index.js"
test -s "assets/js/domains/paco/language/index.js"
test -s "assets/runtime-css/paco-operational-v11370.css"
test -s "scripts/paco-operational-v11370-test.mjs"
test -s "scripts/paco-language-v11373-test.mjs"
grep -q "./assets/js/domains/paco/index.js" assets/precache-manifest.json
grep -q "./assets/js/domains/paco/language/index.js" assets/precache-manifest.json
grep -q "./assets/runtime-css/paco-operational-v11370.css" assets/precache-manifest.json
grep -q 'pacoSnapshot:()=>rpc("erp_x_paco_snapshot")' assets/js/services/api.js

for css in guides-layout-v11291 receiving-workspace-v11290 inventory-dialogs-v11260 inventory-visual-v11270 inventory-ui-v11240 inventory-workspace-v11251 workforce-experience-v11344 workforce-timeline-v11350 workforce-calendar-v11360; do
  test -s "assets/runtime-css/${css}.css"
  grep -q "./assets/runtime-css/${css}.css" assets/precache-manifest.json
done

! grep -R -E 'createElement[[:space:]]*\\([[:space:]]*["'"'"']style["'"'"'][[:space:]]*\\)' assets/js
! grep -q "style-src 'self' 'unsafe-inline'" vercel.json
grep -q "style-src-attr 'unsafe-inline'" vercel.json

grep -q 'erp_x_shipping_confirm_satisfaction' supabase/migrations/112_delivery_satisfaction_distance_v11_31_0.sql
grep -q 'DELIVERED_SATISFIED' supabase/migrations/112_delivery_satisfaction_distance_v11_31_0.sql
grep -q 'postDeliveryConfirmationSeconds' supabase/migrations/112_delivery_satisfaction_distance_v11_31_0.sql
grep -q 'distance_recorded_by' supabase/migrations/113_delivery_satisfaction_fk_indexes_v11_31_0.sql
grep -q 'satisfaction_confirmed_by' supabase/migrations/113_delivery_satisfaction_fk_indexes_v11_31_0.sql
grep -q 'confirmShippingSatisfaction' assets/js/services/api.js
grep -R -q 'Entregado con satisfacción' assets/js/domains/logistics/shipping
grep -q 'data-satisfaction' assets/js/modules/sent-orders.js
! grep -Fq '.btn-danger,.btn.danger{' "$validation_dir/analytics.css"
grep -Fq '.admin-shell-v11160 .btn-danger,.admin-shell-v11160 .btn.danger{' "$validation_dir/analytics.css"

grep -Fq '.modal.popup-ux-v1190:not(.full):not(.split):not(.wizard-modal){width:min(680px,100%)}' "$validation_dir/operations.css"
grep -Fq '#modal-root .modal.popup-ux-v1190.simple-process-modal.wide{' "$validation_dir/operations.css"
grep -Fq 'width:min(1120px,calc(100vw - 80px))!important' "$validation_dir/operations.css"
grep -Fq 'color:#0b65c7!important' "$validation_dir/operations.css"
grep -Fq 'color:#0a4f91!important' "$validation_dir/operations.css"
grep -Fq 'color:#416e99!important' "$validation_dir/operations.css"

test "$(grep -c '<script type="module" src="./assets/js/' index.html)" -eq 1
grep -q 'import "./main.js";' assets/js/app-entry.js
grep -q 'import "./modules/inventory-dialogs-v11260.js";' assets/js/app-entry.js
grep -q 'import "./modules/inventory-visual-v11270.js";' assets/js/app-entry.js
grep -q 'notifyGoodsReceiptCreated' assets/js/domains/receiving/goods/create/receipt-form.js
grep -q 'installAuditoriaErpRetrySchedulerService' assets/js/core/bootstrap/runtime-installers.js
! grep -q 'auditoria-erp-bridge-v11280.js' assets/js/app-entry.js
test ! -e assets/js/modules/auditoria-erp-bridge-v11280.js
! grep -q 'inventory-modal-v11253.js' assets/js/app-entry.js
! grep -q 'inventory-modal-workspace-v11254.js' assets/js/app-entry.js
test ! -e assets/js/modules/inventory-modal-v11253.js
test ! -e assets/js/modules/inventory-modal-workspace-v11254.js
test "$(find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) | wc -l)" -eq 1
if test -f release/vercel-production-window.json; then
  grep -q '"mode"[[:space:]]*:[[:space:]]*"CONTROLLED_PRODUCTION_WINDOW"' release/vercel-production-window.json
  grep -q '"expectedPwaRevision"[[:space:]]*:[[:space:]]*"b892bad4c9c2bd75"' release/vercel-production-window.json
  grep -q '"main"[[:space:]]*:[[:space:]]*true' vercel.json
else
  grep -q '"main"[[:space:]]*:[[:space:]]*false' vercel.json
fi
grep -q '"\*"[[:space:]]*:[[:space:]]*false' vercel.json

for migration in 098_profiles_rls_scope_v11_27_0 099_work_my_day_role_cache_v11_27_0 100_inventory_filtered_hotpath_v11_27_0 101_inventory_count_plan_hotpath_v11_27_0 108_integral_health_audit_v11_30_0 109_auditoria_erp_contract_health_v11_30_0 110_security_definer_contract_v11_30_1 111_security_definer_contract_regex_fix_v11_30_1 112_delivery_satisfaction_distance_v11_31_0 113_delivery_satisfaction_fk_indexes_v11_31_0 114_impersonation_metrics_security_v11_32_0 115_workforce_planner_calendar_v11_33_0 116_workforce_my_day_automation_v11_34_0 117_workforce_manager_review_v11_34_1 118_workforce_catalog_taxonomy_v11_34_3 119_workforce_timeline_evidence_v11_35_0 120_workforce_calendar_feed_v11_36_0 121_paco_operational_snapshot_v11_37_0 132_workforce_scheduled_approval_v11_44_0 133_workforce_open_ended_continuity_v11_44_0 134_local_dispatch_trip_control_v11_45_0 20261006145000_local_dispatch_cost_adjustments_v11_46_0; do
  test -s "supabase/migrations/${migration}.sql"
done

for file in \
  assets/js/modules/inventory.js \
  assets/js/modules/inventory-ui-v11240.js \
  assets/js/modules/inventory-dialogs-v11260.js \
  assets/js/modules/inventory-home-v11250.js \
  assets/js/modules/inventory-operator-v11250.js \
  assets/js/modules/inventory-plan-v11250.js \
  assets/js/modules/inventory-review-v11250.js \
  assets/js/modules/inventory-stock-v11250.js \
  assets/js/modules/inventory-ledger-v11250.js \
  assets/js/modules/inventory-control-v11250.js \
  assets/js/modules/inventory-export-v11250.js; do
  test -s "$file"
done

grep -q 'pendingScopes' assets/js/modules/responsive-foundation-v11190.js
grep -q 'inventory-nav-v11251' assets/js/modules/inventory.js
grep -q 'inventory-audit-card-v11251' assets/js/modules/inventory-review-v11250.js
grep -q 'inventory-comparison-row-v11251' assets/js/modules/inventory-review-v11250.js
grep -q 'Aprobar y aplicar' assets/js/modules/inventory-review-v11250.js
grep -q 'REGISTRAR CONTEO' assets/js/modules/inventory-operator-v11250.js
grep -q 'PARETO ADAPTATIVO' assets/js/modules/inventory-plan-v11250.js
grep -q 'Actualizar Siesa' assets/js/modules/inventory-stock-v11250.js
grep -q 'KARDEX' assets/js/modules/inventory-ledger-v11250.js
grep -q 'inventory-enterprise-row-v11252' assets/js/modules/inventory-ui-v11240.js

# Contrato UX: un solo sistema, ancho contenido y accesibilidad táctil/visual.
grep -q 'inventory-dialog-v11260' assets/js/modules/inventory-dialogs-v11260.js
grep -q 'inventory-dialog-guide-v11260' assets/js/modules/inventory-dialogs-v11260.js
grep -q -- '--inventory-dialog-width:1120px' assets/runtime-css/inventory-dialogs-v11260.css
grep -q -- '--inventory-dialog-width:720px' assets/runtime-css/inventory-dialogs-v11260.css
grep -q -- '--inventory-dialog-width:1040px' assets/runtime-css/inventory-dialogs-v11260.css
grep -q 'min-height:48px' assets/runtime-css/inventory-dialogs-v11260.css
grep -q 'font-size:16px' assets/runtime-css/inventory-dialogs-v11260.css
grep -q 'grid-template-columns:repeat(3,minmax(0,1fr))' assets/runtime-css/inventory-dialogs-v11260.css
grep -q 'MutationObserver' assets/js/modules/inventory-dialogs-v11260.js
! grep -q 'width:min(86vw' assets/runtime-css/inventory-dialogs-v11260.css
! grep -q 'width:min(88vw' assets/runtime-css/inventory-dialogs-v11260.css
! grep -q 'width:min(94vw' assets/runtime-css/inventory-dialogs-v11260.css
