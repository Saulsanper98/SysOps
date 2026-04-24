import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/Button";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 gap-5">
      <div className="w-20 h-20 rounded-2xl bg-ops-750 border border-ops-600 flex items-center justify-center">
        <AlertTriangle className="w-9 h-9 text-slate-700" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-5xl font-bold text-ops-600 font-mono tabular-nums">404</p>
        <p className="text-base font-medium text-slate-400 mt-2">Página no encontrada</p>
        <p className="text-sm text-slate-600">La ruta que buscas no existe o fue eliminada.</p>
      </div>
      <Button
        variant="ghost"
        icon={<ArrowLeft className="w-4 h-4" />}
        onClick={() => navigate("/")}
      >
        Volver al Dashboard
      </Button>
    </div>
  );
}
