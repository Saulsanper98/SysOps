import { useEffect, useState } from "react";
import { usePreferencesStore } from "../store/useStore";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";

const VERSION = import.meta.env.VITE_APP_VERSION ?? "";

export function ChangelogModal() {
  const { changelogSeenVersion, setChangelogSeenVersion } = usePreferencesStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!VERSION) return;
    if (changelogSeenVersion === VERSION) return;
    setOpen(true);
  }, [changelogSeenVersion]);

  const handleClose = () => {
    if (VERSION) setChangelogSeenVersion(VERSION);
    setOpen(false);
  };

  if (!VERSION) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={`Novedades · v${VERSION}`}
      description="Resumen de mejoras en esta versión de la interfaz."
    >
      <ul className="text-sm text-slate-300 space-y-2 list-disc pl-4">
        <li>Tema claro/oscuro con <code className="text-xs bg-ops-800 px-1 rounded">color-scheme</code> nativo.</li>
        <li>Modo OLED (negro puro) y preferencias de dashboard en ajustes de perfil.</li>
        <li>Título de pestaña dinámico, PWA básica y límites de error con recuperación.</li>
        <li>Dashboard: orden de KPI configurable, mini tendencias y estados vacíos más claros.</li>
      </ul>
      <div className="mt-6 flex justify-end">
        <Button size="sm" onClick={handleClose}>
          Entendido
        </Button>
      </div>
    </Dialog>
  );
}
