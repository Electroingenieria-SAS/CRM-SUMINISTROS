

export function validateRequiredMigrationContracts({ check, exists, analyticsCss }){
  check(exists("scripts/order-responsible-seller-v11382-test.mjs"),"Falta contrato V11.38.2 de responsable activo y vendedor.");
  check(exists("scripts/customer-freight-intelligence-v11390-test.mjs"),"Falta contrato V11.39.x de inteligencia comercial y fletes.");
  check(exists("supabase/migrations/127_customer_payment_truth_v11_39_1.sql"),"Falta migración V11.39.1 de verdad financiera y prioridad.");
  check(exists("supabase/migrations/128_customer_intelligence_security_v11_39_1.sql"),"Falta hardening V11.39.1 de identidad de cliente.");
  check(exists("supabase/migrations/129_freight_predictive_model_v11_40_0.sql"),"Falta migración V11.40.0 del modelo predictivo de fletes.");
  check(exists("scripts/freight-prediction-v11400-test.mjs"),"Falta contrato V11.40.0 del modelo predictivo de fletes.");
  check(exists("supabase/migrations/130_logistics_intelligence_control_v11_41_0.sql"),"Falta migración V11.41.0 de control logístico.");
  check(exists("scripts/logistics-intelligence-v11410-test.mjs"),"Falta contrato V11.41.0 de inteligencia logística.");
  check(exists("assets/js/modules/freight-intelligence-v11410.js"),"Falta módulo visual V11.41.0 de inteligencia logística.");
  check(exists("supabase/migrations/131_freight_historical_base_v11_42_0.sql"),"Falta migración V11.42.0 de base histórica activa.");
  check(exists("scripts/freight-historical-base-v11420-test.mjs"),"Falta contrato V11.42.0 de base histórica activa.");
  check(exists("scripts/freight-cards-layout-v11430-test.mjs"),"Falta contrato V11.43.0 del layout de fletes.");
  check(exists("supabase/migrations/125_customer_freight_intelligence_v11_39_0.sql"),"Falta migración 125 de inteligencia comercial/logística.");
  check(exists("supabase/migrations/126_customer_freight_intelligence_permissions_v11_39_0.sql"),"Falta migración 126 de permisos de inteligencia.");
  check(exists("supabase/migrations/124_order_responsible_seller_v11_38_2.sql"),"Falta migración 124 de responsable activo y vendedor.");
  check(exists("supabase/migrations/122_automatic_order_workforce_v11_38_0.sql"),"Falta migración 122 de ocupación automática.");
  check(exists("supabase/migrations/123_workforce_special_treatment_metrics_v11_38_0.sql"),"Falta migración 123 de tratamiento especial.");
  check(analyticsCss.includes("work-indicator-metrics-v11363")&&analyticsCss.includes("work-indicator-team-v11363"),"CSS Indicadores Workforce V11.36.4 incompleto.");
}
