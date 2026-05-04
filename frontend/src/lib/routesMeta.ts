/** Títulos cortos para TopBar / accesibilidad */
export const ROUTE_PAGE_TITLE: Record<string, string> = {
  "/login": "Iniciar sesión",
  "/auth/callback": "Autenticación",
  "/": "Dashboard",
  "/systems": "Sistemas",
  "/incidents": "Incidencias",
  "/alerts": "Alertas",
  "/automations": "Automatizaciones",
  "/kb": "Base de Conocimiento",
  "/audit": "Auditoría",
  "/metrics": "Métricas",
  "/notifications": "Notificaciones",
  "/settings": "Configuración",
  "/settings/profile": "Mi perfil",
  "/settings/2fa": "2FA",
  "/settings/users": "Usuarios",
  "/settings/ssh": "Credenciales SSH",
  "/settings/connectors": "Conectores",
};

export function pageTitleForPath(pathname: string): string {
  if (pathname.startsWith("/incidents/") && pathname !== "/incidents") return "Detalle incidencia";
  if (pathname.startsWith("/kb/") && pathname.includes("/edit")) return "Editor KB";
  if (pathname.startsWith("/kb/")) return "Artículo KB";
  if (pathname.startsWith("/settings")) {
    return ROUTE_PAGE_TITLE[pathname] ?? "Configuración";
  }
  return ROUTE_PAGE_TITLE[pathname] ?? "SysOps Hub";
}
