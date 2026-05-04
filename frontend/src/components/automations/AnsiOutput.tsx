import { useMemo } from "react";
import { AnsiUp } from "ansi_up";

interface AnsiOutputProps {
  text: string;
  className?: string;
}

/** Salida de consola con colores ANSI convertidos a HTML seguro (escape activo). */
export function AnsiOutput({ text, className }: AnsiOutputProps) {
  const html = useMemo(() => {
    const up = new AnsiUp();
    up.escape_html = true;
    up.use_classes = false;
    return up.ansi_to_html(text || "");
  }, [text]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
