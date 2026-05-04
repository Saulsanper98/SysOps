import { Outlet, useLocation } from "react-router-dom";

export function AppOutlet() {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-transition-enter flex-1 flex flex-col min-h-0">
      <Outlet />
    </div>
  );
}
