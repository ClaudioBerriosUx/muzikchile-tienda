"use client";

import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered,
  Link2, ImageIcon, Quote, Check, X,
} from "lucide-react";
import { C, F } from "@/lib/portada";
import { validarEmbed, pareceHtml, textoPlanoAHtml } from "@/lib/embeds";

/**
 * Editor de contenido rico para el cuerpo de las publicaciones.
 *
 * FORMATO CANÓNICO DE EMBED: shortcodes `[youtube:ID]` y `[spotify:tipo/id]`.
 *
 * El editor los escribe como TEXTO PLANO dentro de un párrafo, que es
 * exactamente lo que `trocearContenido` ya sabe leer en el renderizador. No hay
 * que tocar `ContenidoNoticia` ni inventar un nodo de TipTap.
 *
 * Y lo más importante: el editor valida la URL pegada con `validarEmbed`, LA
 * MISMA función que usa el renderizador. Si el editor acepta algo, el
 * renderizador lo va a reconocer — no pueden desalinearse.
 */

interface Props {
  valor: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

// ── Barra de herramientas ────────────────────────────────────────────────────

function Boton({
  onClick,
  activo,
  titulo,
  children,
}: {
  onClick: () => void;
  activo?: boolean;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      className="w-8 h-8 rounded flex items-center justify-center transition-colors shrink-0"
      style={{
        backgroundColor: activo ? C.rojo : "transparent",
        color: activo ? C.blanco : "#666666",
        border: `1px solid ${activo ? C.rojo : "#e8e8e8"}`,
      }}
    >
      {children}
    </button>
  );
}

/** Panel para pegar una URL de YouTube/Spotify. */
function PanelEmbed({
  tipo,
  onInsertar,
  onCerrar,
}: {
  tipo: "youtube" | "spotify";
  onInsertar: (url: string) => string | null;
  onCerrar: () => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const insertar = () => {
    const fallo = onInsertar(url);
    if (fallo) { setError(fallo); return; }
    setUrl("");
    setError(null);
    onCerrar();
  };

  const ejemplo =
    tipo === "youtube"
      ? "https://youtu.be/dQw4w9WgXcQ"
      : "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";

  return (
    <div className="p-3 border-t" style={{ borderColor: "#e8e8e8", backgroundColor: "#f8f7f5" }}>
      <label
        className="block mb-1.5"
        style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#444444" }}
      >
        Pega la URL de {tipo === "youtube" ? "YouTube" : "Spotify"}
      </label>
      <div className="flex gap-2">
        <input
          autoFocus
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); insertar(); }
            if (e.key === "Escape") onCerrar();
          }}
          placeholder={ejemplo}
          className="flex-1 rounded-md px-3 py-2 text-sm border focus:outline-none"
          style={{
            fontFamily: "var(--font-body)",
            borderColor: error ? C.rojo : "#e8e8e8",
            color: "#111111",
          }}
        />
        <button
          type="button"
          onClick={insertar}
          className="px-4 rounded-md text-white text-sm font-semibold flex items-center gap-1.5"
          style={{ fontFamily: "var(--font-body)", backgroundColor: C.rojo }}
        >
          <Check size={14} /> Insertar
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="w-9 rounded-md border flex items-center justify-center"
          style={{ borderColor: "#e8e8e8", color: "#666666" }}
          aria-label="Cancelar"
        >
          <X size={14} />
        </button>
      </div>
      {error && (
        <p className="mt-1.5" style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: C.rojo }}>
          {error}
        </p>
      )}
    </div>
  );
}

function Barra({ editor }: { editor: Editor }) {
  const [panel, setPanel] = useState<"youtube" | "spotify" | null>(null);

  /**
   * Inserta el shortcode como texto. Devuelve un mensaje de error si la URL no
   * valida, o null si salió bien.
   */
  const insertarEmbed = (tipo: "youtube" | "spotify") => (url: string): string | null => {
    if (!url.trim()) return "Pega una URL primero";

    const embed = validarEmbed(tipo, url);
    if (!embed) {
      return tipo === "youtube"
        ? "No reconocí esa URL de YouTube"
        : "No reconocí esa URL de Spotify";
    }

    // El shortcode va en su propio párrafo para que quede aislado del texto.
    editor
      .chain()
      .focus()
      .insertContent([
        { type: "paragraph", content: [{ type: "text", text: `[${tipo}:${embed.valor}]` }] },
        { type: "paragraph" },
      ])
      .run();

    return null;
  };

  const ponerEnlace = () => {
    const previo = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace", previo ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const ponerImagen = () => {
    const url = window.prompt("URL de la imagen", "https://");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-1.5 p-2 border-b"
        style={{ borderColor: "#e8e8e8", backgroundColor: "#ffffff" }}
      >
        <Boton titulo="Negrita" activo={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={14} />
        </Boton>
        <Boton titulo="Itálica" activo={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={14} />
        </Boton>

        <span className="w-px h-6 mx-1" style={{ backgroundColor: "#e8e8e8" }} />

        <Boton titulo="Título 2" activo={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={14} />
        </Boton>
        <Boton titulo="Título 3" activo={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={14} />
        </Boton>

        <span className="w-px h-6 mx-1" style={{ backgroundColor: "#e8e8e8" }} />

        <Boton titulo="Lista con viñetas" activo={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={14} />
        </Boton>
        <Boton titulo="Lista numerada" activo={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={14} />
        </Boton>
        <Boton titulo="Cita" activo={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={14} />
        </Boton>

        <span className="w-px h-6 mx-1" style={{ backgroundColor: "#e8e8e8" }} />

        <Boton titulo="Enlace" activo={editor.isActive("link")} onClick={ponerEnlace}>
          <Link2 size={14} />
        </Boton>
        <Boton titulo="Imagen" onClick={ponerImagen}>
          <ImageIcon size={14} />
        </Boton>

        {/* Los dos destacados */}
        <div className="flex gap-1.5 ml-auto">
          {(["youtube", "spotify"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPanel(panel === t ? null : t)}
              className="h-8 px-3 rounded text-xs font-semibold transition-colors"
              style={{
                fontFamily: "var(--font-body)",
                backgroundColor: panel === t ? C.rojo : "#111111",
                color: C.blanco,
              }}
            >
              {t === "youtube" ? "YouTube" : "Spotify"}
            </button>
          ))}
        </div>
      </div>

      {panel && (
        <PanelEmbed
          tipo={panel}
          onInsertar={insertarEmbed(panel)}
          onCerrar={() => setPanel(null)}
        />
      )}
    </>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

export default function EditorContenido({ valor, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({
        placeholder: placeholder ?? "Escribe la noticia...",
      }),
    ],
    // El contenido existente puede ser texto plano (la noticia de Valentina):
    // se envuelve en párrafos para que TipTap no lo colapse en una sola línea.
    content: valor ? (pareceHtml(valor) ? valor : textoPlanoAHtml(valor)) : "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    // Obligatorio en Next: sin esto TipTap renderiza en SSR y provoca
    // desajuste de hidratación.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "editor-contenido focus:outline-none",
      },
    },
  });

  if (!editor) {
    return (
      <div
        className="rounded-md border p-4"
        style={{ borderColor: "#e8e8e8", minHeight: "300px" }}
      >
        <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#999999" }}>
          Cargando editor...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden" style={{ borderColor: "#e8e8e8" }}>
      <Barra editor={editor} />
      <EditorContent editor={editor} />
      <p
        className="px-3 py-2 border-t"
        style={{
          borderColor: "#e8e8e8",
          backgroundColor: "#f8f7f5",
          fontFamily: F.body,
          fontSize: "12px",
          color: "#999999",
        }}
      >
        Los videos y la música se insertan con los botones YouTube y Spotify.
      </p>
    </div>
  );
}
