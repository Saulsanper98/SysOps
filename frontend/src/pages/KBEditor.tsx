import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Save, Eye, EyeOff, X, Plus, ArrowLeft } from "lucide-react";
import { api, apiError } from "../lib/api";
import type { KbArticle } from "../types";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import toast from "react-hot-toast";

export default function KBEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: "",
    summary: "",
    content: "",
    tags: [] as string[],
    published: false,
  });
  const [tagInput, setTagInput] = useState("");
  const [preview, setPreview] = useState(false);

  // Load existing article when editing
  const { isLoading } = useQuery<KbArticle>({
    queryKey: ["kb-article", id],
    queryFn: () => api.get(`/kb/${id}`).then((r) => r.data),
    enabled: isEdit,
    staleTime: 0,
  });

  // Separate effect to populate form after load
  const { data: article } = useQuery<KbArticle>({
    queryKey: ["kb-article", id],
    queryFn: () => api.get(`/kb/${id}`).then((r) => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (article) {
      setForm({
        title: article.title,
        summary: article.summary ?? "",
        content: article.content,
        tags: article.tags,
        published: article.published,
      });
    }
  }, [article]);

  const createArticle = useMutation({
    mutationFn: (data: typeof form) => api.post("/kb", data).then((r) => r.data),
    onSuccess: (data: KbArticle) => {
      toast.success("Artículo creado");
      qc.invalidateQueries({ queryKey: ["kb-articles"] });
      navigate(`/kb/${data.id}`);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const updateArticle = useMutation({
    mutationFn: (data: typeof form) => api.put(`/kb/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success("Artículo actualizado");
      qc.invalidateQueries({ queryKey: ["kb-articles"] });
      qc.invalidateQueries({ queryKey: ["kb-article", id] });
      navigate(`/kb/${id}`);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const handleSave = () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("El título y el contenido son obligatorios");
      return;
    }
    if (isEdit) {
      updateArticle.mutate(form);
    } else {
      createArticle.mutate(form);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      setForm((p) => ({ ...p, tags: [...p.tags, t] }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setForm((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }));
  };

  const isPending = createArticle.isPending || updateArticle.isPending;

  if (isEdit && isLoading) {
    return <div className="py-16 text-center text-slate-600 text-sm">Cargando artículo…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(isEdit ? `/kb/${id}` : "/kb")}
            className="p-2 rounded-lg hover:bg-ops-700 text-slate-500 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">
              {isEdit ? "Editar artículo" : "Nuevo artículo"}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Base de Conocimiento</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreview((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-ops-700 transition-colors"
          >
            {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {preview ? "Editar" : "Preview"}
          </button>
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-ops-700 transition-colors">
            <div className={`w-8 h-4 rounded-full transition-colors relative ${form.published ? "bg-emerald-500" : "bg-ops-600"}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${form.published ? "left-4.5" : "left-0.5"}`} />
            </div>
            <span className={form.published ? "text-emerald-400" : "text-slate-500"}>
              {form.published ? "Publicado" : "Borrador"}
            </span>
            <input
              type="checkbox"
              className="hidden"
              checked={form.published}
              onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
            />
          </label>
          <Button
            icon={<Save className="w-3.5 h-3.5" />}
            loading={isPending}
            onClick={handleSave}
          >
            {isEdit ? "Guardar cambios" : "Crear artículo"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main editor */}
        <div className="col-span-2 space-y-4">
          <Card>
            <CardBody className="space-y-4">
              <Input
                label="Título"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Título del artículo"
              />
              <Input
                label="Resumen (opcional)"
                value={form.summary}
                onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                placeholder="Breve descripción del artículo"
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-0">
              {/* Toolbar hint */}
              <div className="px-4 py-2 border-b border-ops-700 flex items-center gap-3">
                <span className="text-xs text-slate-600 font-mono">## Título</span>
                <span className="text-xs text-slate-600 font-mono">**negrita**</span>
                <span className="text-xs text-slate-600 font-mono">```código```</span>
                <span className="text-xs text-slate-600 font-mono">- lista</span>
                <span className="ml-auto text-xs text-slate-600">Markdown soportado</span>
              </div>
              {preview ? (
                <div className="p-4 min-h-64 prose prose-invert prose-sm max-w-none">
                  {form.content.split("\n").map((line, i) => {
                    if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold text-slate-200 mt-4">{line.slice(3)}</h2>;
                    if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold text-slate-300 mt-3">{line.slice(4)}</h3>;
                    if (line.startsWith("- ")) return <li key={i} className="text-sm text-slate-400 ml-4">{line.slice(2)}</li>;
                    if (line.startsWith("```")) return null;
                    if (!line.trim()) return <div key={i} className="h-2" />;
                    return <p key={i} className="text-sm text-slate-400">{line}</p>;
                  })}
                </div>
              ) : (
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Escribe el contenido del artículo en Markdown..."
                  rows={20}
                  className="w-full px-4 py-3 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-y outline-none font-mono"
                  style={{ minHeight: "320px" }}
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Tags */}
          <Card>
            <CardBody className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Etiquetas</p>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Añadir tag..."
                  className="flex-1 bg-ops-850 border border-ops-600 rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-accent"
                />
                <button
                  onClick={addTag}
                  className="p-1.5 rounded bg-ops-700 hover:bg-ops-600 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-ops-700 text-slate-300 border border-ops-600"
                    >
                      {tag}
                      <button onClick={() => removeTag(tag)} className="text-slate-500 hover:text-red-400">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Tips */}
          <Card>
            <CardBody>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Consejos</p>
              <ul className="space-y-1.5 text-xs text-slate-500">
                <li>• Usa <code className="text-slate-400">## Título</code> para secciones</li>
                <li>• Usa <code className="text-slate-400">**texto**</code> para negrita</li>
                <li>• Usa <code className="text-slate-400">```</code> para bloques de código</li>
                <li>• Usa <code className="text-slate-400">- elemento</code> para listas</li>
                <li>• Los borradores no son visibles al resto de usuarios</li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
