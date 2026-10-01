// Shared Apps Script namespace; external entry points retain their names.
const SETTINGS = Object.freeze({
  VERSION: '3.5.1',

  SUPABASE_URL: 'https://hezjxcxxcjlpmyalftam.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_yxgyHILzQVDHrS2MYYkBkA_UfN77JtT',

  // Carpeta institucional suministrada.
  ROOT_FOLDER_ID: '1B9IsvURgsDWxLP84Z7uD3wsDNhh43n_x',

  // Orígenes autorizados para utilizar el puente institucional.
  // IMPORTANTE: aquí van ORIGINS (protocolo + host), nunca rutas.
  // Ejemplo GitHub Pages:
  // URL pública: https://electroingenieria-sas.github.io/CRM-SUMINISTROS/
  // Origin real: https://electroingenieria-sas.github.io
  ALLOWED_ORIGINS: [
    'https://electroingenieria-sas.github.io',
    'https://crm-suministros-amber.vercel.app',
    'https://crm-suministros-jeptacs-projects.vercel.app',
    'https://crm-suministros-git-main-jeptacs-projects.vercel.app',
    'https://ei-erp-google-auth.vercel.app',
    'https://borrador-erp-ei.vercel.app'
  ],

  // Máximo por archivo. Apps Script no es adecuado para archivos gigantes.
  MAX_FILE_BYTES: 15 * 1024 * 1024,

  // La vista previa se solicita solo al abrir la tarjeta del cronograma.
  // Mantener este límite bajo evita respuestas HTML innecesariamente grandes.
  MAX_PREVIEW_BYTES: 5 * 1024 * 1024,

  // PRIVATE mantiene los documentos privados en el Drive institucional.
  SHARING_MODE: 'PRIVATE',

  ALLOWED_EXTENSIONS: ['jpg','jpeg','png','webp','heic','heif','pdf','txt','csv','xls','xlsx','doc','docx','ppt','pptx'],
  BLOCKED_EXTENSIONS: ['html','htm','svg','js','mjs','cjs','exe','dll','msi','bat','cmd','com','scr','ps1','sh','jar','apk','app','dmg','iso']
});
