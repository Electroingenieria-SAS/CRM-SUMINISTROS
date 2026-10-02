

export async function currentSession() {
  const authService = await import("../../../services/supabase.js");

  if (typeof authService.getSession === "function") {
    return authService.getSession();
  }

  if (typeof authService.getSupabase === "function") {
    const {data, error} = await authService.getSupabase().auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  throw new Error("No fue posible consultar la sesión activa del ERP.");
}
