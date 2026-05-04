import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { pageTitleForPath } from "../lib/routesMeta";

const APP_NAME = "SysOps Hub";

/** Sincroniza `document.title` con la ruta actual (TopBar ya usa `pageTitleForPath`). */
export function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = pageTitleForPath(pathname);
    document.title = page === APP_NAME ? APP_NAME : `${page} · ${APP_NAME}`;
  }, [pathname]);
  return null;
}
