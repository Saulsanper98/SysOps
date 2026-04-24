import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, AlertCircle, User, Lock } from "lucide-react";
import { api, apiError } from "../lib/api";
import { useAuthStore } from "../store/useStore";
import toast from "react-hot-toast";
import type { User as UserType } from "../types";

// ── Company logo (mark only, yellow) ────────────────────────────────────────
function CompanyLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 338 149" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M241.58 67.36C253.1 67.36 263.23 61.26 268.91 52.13C274.59 61.26 284.71 67.36 296.24 67.36C313.97 67.36 328.4 52.93 328.4 35.2H315.73C315.73 45.95 306.99 54.69 296.24 54.69C285.49 54.69 276.75 45.95 276.75 35.2C276.75 24.45 285.49 15.71 296.24 15.71V3.04C281.15 3.04 268.46 13.49 265.01 27.53H238.85V40.2H260.43C258.22 48.53 250.61 54.69 241.59 54.69C230.84 54.69 222.1 45.95 222.1 35.2C222.1 24.45 230.84 15.71 241.59 15.71V3.04C223.86 3.04 209.43 17.47 209.43 35.2C209.43 52.93 223.86 67.36 241.59 67.36H241.58Z" fill="currentColor"/>
      <path d="M200.76 67.14V19.74C200.76 15.84 199.94 12.4 198.29 9.42C196.65 6.44 194.36 4.12 191.44 2.48C188.52 0.83 185.23 0.01 181.57 0.01C177.91 0.01 174.63 0.83 171.7 2.48C168.78 4.12 166.49 6.44 164.85 9.42C163.2 12.41 162.38 15.85 162.38 19.74V47.88C162.38 49.1 161.98 50.11 161.19 50.9C160.4 51.69 159.42 52.09 158.27 52.09C157.12 52.09 156.14 51.69 155.35 50.9C154.56 50.11 154.16 49.1 154.16 47.88V19.74C154.16 15.84 153.34 12.4 151.69 9.42C150.05 6.44 147.76 4.12 144.84 2.48C141.92 0.83 138.63 0.01 134.97 0.01C131.31 0.01 128.03 0.83 125.1 2.48C122.18 4.12 119.89 6.44 118.25 9.42C116.61 12.41 115.78 15.85 115.78 19.74V49.32C115.52 58.27 108.39 62.11 108.39 62.11L114.54 74.83C120.34 72.31 130.08 64.44 130.39 49.53H130.4V18.36C130.4 17.02 130.83 15.91 131.68 15.02C132.53 14.14 133.63 13.7 134.97 13.7C136.31 13.7 137.41 14.14 138.26 15.02C139.11 15.9 139.54 17.02 139.54 18.36V46.5C139.54 50.15 140.35 53.44 141.96 56.37C143.57 59.29 145.8 61.59 148.63 63.27C151.46 64.94 154.67 65.78 158.27 65.78C161.87 65.78 165.06 64.96 167.86 63.31C170.66 61.67 172.89 59.37 174.53 56.41C176.17 53.46 177 50.15 177 46.5V18.36C177 17.02 177.43 15.91 178.28 15.02C179.13 14.14 180.23 13.7 181.57 13.7C182.91 13.7 184.01 14.14 184.86 15.02C185.71 15.9 186.14 17.02 186.14 18.36V67.14H200.76Z" fill="currentColor"/>
      <path d="M34.23 53.52C30.88 53.52 27.15 52.73 24.44 51.14C21.73 49.56 19.6 47.36 18.05 44.56C16.5 41.76 15.72 38.65 15.72 35.24C15.72 31.83 16.5 28.73 18.05 25.92C19.6 23.12 21.73 20.93 24.44 19.34C27.15 17.76 30.18 16.96 33.53 16.96C36.15 16.96 38.63 17.46 40.97 18.47C43.31 19.47 45.37 20.86 47.14 22.63L56.46 12.22C53.6 9.11 50.19 6.69 46.23 4.96C42.27 3.22 38.04 2.36 33.53 2.36C27.01 2.36 21.21 3.82 16.13 6.74C11.04 9.66 7.09 13.64 4.26 18.66C1.42 23.7 0 29.23 0 35.25C0 41.27 1.42 46.8 4.25 51.83C7.08 56.85 11.04 60.83 16.12 63.75C21.2 66.67 27.71 68.13 34.22 68.13C38.73 68.13 45.72 67.05 49.68 64.57L46.64 51.18C40.88 53.34 36.83 53.51 34.22 53.51L34.23 53.52Z" fill="currentColor"/>
      <path d="M95.44 67.72C93.33 68.49 89.92 68.95 87.3 68.95C83.95 68.95 80.57 68.16 77.86 66.57C75.15 64.99 73.02 62.79 71.47 59.99C69.92 57.19 69.14 54.08 69.14 50.67C69.14 47.26 69.92 44.15 71.47 41.35C73.02 38.55 75.15 36.36 77.86 34.77C80.57 33.19 83.6 32.39 86.95 32.39C89.57 32.39 92.05 32.89 94.39 33.9C96.73 34.9 98.79 36.29 100.56 38.06L109.88 27.65C107.02 24.54 103.61 22.12 99.65 20.39C95.69 18.65 91.46 17.79 86.95 17.79C80.43 17.79 74.63 19.25 69.55 22.17C64.46 25.09 60.51 29.07 57.68 34.09C54.85 39.11 53.43 44.64 53.43 50.67C53.43 56.7 54.85 62.22 57.68 67.25C60.51 72.27 64.47 76.25 69.55 79.17C74.63 82.09 80.43 83.55 86.95 83.55C91.46 83.55 97.36 82.09 101.35 80.35C101.35 80.35 106.63 77.88 107.66 77.4C106.81 75.48 101.99 64.99 101.99 64.99C99.5 66.36 97.57 66.94 95.46 67.71L95.44 67.72Z" fill="currentColor"/>
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string; user: UserType }>("/auth/login", form);
      setAuth(data.user, data.token);
      toast.success(`Bienvenido, ${data.user.displayName}`);
      navigate("/");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ops-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* ── Background: dot grid ─────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #1e2d45 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.45,
        }}
      />

      {/* ── Background: ambient glows ────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* top-left */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)" }} />
        {/* center glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 65%)" }} />
        {/* bottom-right */}
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)" }} />
      </div>

      {/* ── Main card ────────────────────────────────────────────────── */}
      <div className="w-full max-w-sm relative" style={{ animation: "loginFadeUp .4s ease both" }}>

        {/* Logo + title */}
        <div className="text-center mb-8">
          {/* Logo badge */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 relative"
            style={{
              background: "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)",
              border: "1px solid rgba(59,130,246,0.25)",
              boxShadow: "0 0 32px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}>
            <CompanyLogo className="w-9 h-auto text-accent" />
          </div>

          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">SysOps Hub</h1>
          <p className="text-sm text-slate-500 mt-1.5">Centro de Operaciones · Sistemas</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7 relative"
          style={{
            background: "linear-gradient(145deg, rgba(17,24,39,0.95) 0%, rgba(11,16,28,0.98) 100%)",
            border: "1px solid rgba(30,45,69,0.8)",
            boxShadow: "0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)",
            backdropFilter: "blur(12px)",
          }}>

          {/* Card inner top accent line */}
          <div className="absolute top-0 left-8 right-8 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.4), transparent)" }} />

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                Usuario
              </label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-accent transition-colors" />
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="nombre de usuario"
                  autoComplete="username"
                  autoFocus
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 rounded-lg transition-all outline-none"
                  style={{
                    background: "rgba(6,10,20,0.6)",
                    border: "1px solid rgba(30,45,69,0.9)",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "rgba(59,130,246,0.6)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "rgba(30,45,69,0.9)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                Contraseña
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-accent transition-colors" />
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-9 pr-10 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 rounded-lg transition-all outline-none"
                  style={{
                    background: "rgba(6,10,20,0.6)",
                    border: "1px solid rgba(30,45,69,0.9)",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "rgba(59,130,246,0.6)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "rgba(30,45,69,0.9)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg text-sm text-red-400"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  animation: "shake .35s ease",
                } as React.CSSProperties}>
                <AlertCircle className="w-4 h-4 mt-px flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 mt-1"
              style={{
                background: loading
                  ? "rgba(59,130,246,0.5)"
                  : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                color: "#fff",
                boxShadow: loading ? "none" : "0 4px 15px rgba(59,130,246,0.3), 0 1px 3px rgba(0,0,0,0.3)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Autenticando…</>
                : "Iniciar sesión"}
            </button>

          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "rgba(30,45,69,0.8)" }} />
            <span className="text-xs text-slate-600">acceso rápido</span>
            <div className="flex-1 h-px" style={{ background: "rgba(30,45,69,0.8)" }} />
          </div>

          {/* Quick-fill buttons */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Admin",    user: "admin",    pass: "Admin1234!" },
              { label: "Técnico",  user: "tecnico1", pass: "Tech1234!" },
              { label: "Solo Ver", user: "readonly", pass: "Tech1234!" },
            ].map(({ label, user, pass }) => (
              <button
                key={user}
                type="button"
                onClick={() => setForm({ username: user, password: pass })}
                className="py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: "rgba(30,45,69,0.5)",
                  border: "1px solid rgba(30,45,69,0.9)",
                  color: "#64748b",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(59,130,246,0.3)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(30,45,69,0.9)";
                }}
              >
                {label}
              </button>
            ))}
          </div>

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-700 mt-5">
          SysOps Hub · v1.0 ·{" "}
          <span className="text-slate-600">
            {import.meta.env.DEV ? "Desarrollo" : "Producción"}
          </span>
        </p>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes loginFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
