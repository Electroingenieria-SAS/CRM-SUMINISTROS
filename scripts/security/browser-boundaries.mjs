

export function validateBrowserBoundaries({ check, jsRuntime, normalizedJsRuntime }){
  const bannedRuntime=/\b(QA_BOT|erp_x_qa_|erp_x_run_qa_|erp_x_sandbox_|sandboxMode|manualSandbox|TEST-QA-|erp-e2e-bot)\b/i;
  check(!bannedRuntime.test(jsRuntime),"El frontend productivo conserva referencias QA/Sandbox.");
  check(!/\.from\s*\(/.test(normalizedJsRuntime),"El navegador no debe acceder a tablas directamente; use RPC.");
}
