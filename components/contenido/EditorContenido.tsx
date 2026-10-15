"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered,
  Link2, ImageIcon, Quote, Check, X, Loader2,
} from "lucide-react";
import { C, F } from "@/lib/portada";
import { validarEmbed, pareceHtml, textoPlanoAHtml } from "@/lib/embeds";
import { ACCEPT_IMAGEN_NOTICIA, altDesdeNombre } from "@/lib/subir-imagen-noticia";

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
  /**
   * Si viene, el botón de imagen abre el selector de archivos (en vez de pedir
   * una URL) y se aceptan imágenes pegadas o arrastradas al editor. Sube el
   * archivo y devuelve su URL pública; lanza un Error con mensaje para mostrar.
   * Hoy solo lo pasa el modo editorial (admin) de PublicacionForm.
   */
  subirImagen?: (archivo: File) => Promise<string>;
  /** Avisa cuando empieza y termina de subir, para bloquear el guardado. */
  onSubiendoChange?: (subiendo: boolean) => void;
}

/** Solo las imágenes de una lista de archivos (pegado o arrastre). */
function imagenesDe(archivos: FileList | null | undefined): File[] {
  return Array.from(archivos ?? []).filter((a) => a.type.startsWith("image/"));
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

/**
 * Texto alternativo de la imagen seleccionada (clic sobre ella). Arranca con el
 * alt actual, que al subir es el nombre del archivo. Se monta con `key` = la
 * posición de la imagen, así que elegir otra lo reinicia.
 */
function PanelAlt({ editor, altInicial }: { editor: Editor; altInicial: string }) {
  const [alt, setAlt] = useState(altInicial);
  const cambiado = alt.trim() !== altInicial;

  const guardar = () => {
    // updateAttributes actúa sobre la selección del documento, que sigue siendo
    // la imagen aunque el foco esté en este input.
    editor.chain().updateAttributes("image", { alt: alt.trim() }).run();
  };

  return (
    <div className="p-3 border-t" style={{ borderColor: "#e8e8e8", backgroundColor: "#f8f7f5" }}>
      <label
        htmlFor="editor-alt-imagen"
        className="block mb-1.5"
        style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#444444" }}
      >
        Texto alternativo de la imagen{" "}
        <span style={{ color: "#999999" }}>(lo leen los lectores de pantalla y Google)</span>
      </label>
      <div className="flex gap-2">
        <input
          id="editor-alt-imagen"
          value={alt}
          maxLength={200}
          onChange={(e) => setAlt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); guardar(); editor.commands.focus(); }
            if (e.key === "Escape") { setAlt(altInicial); editor.commands.focus(); }
          }}
          placeholder="Describe la imagen: quién, qué, dónde"
          className="flex-1 min-w-0 rounded-md px-3 py-2 text-sm border focus:outline-none"
          style={{ fontFamily: "var(--font-body)", borderColor: "#e8e8e8", color: "#111111" }}
        />
        <button
          type="button"
          onClick={guardar}
          disabled={!cambiado}
          className="px-4 rounded-md text-white text-sm font-semibold flex items-center gap-1.5"
          style={{
            fontFamily: "var(--font-body)",
            backgroundColor: C.rojo,
            opacity: cambiado ? 1 : 0.5,
            cursor: cambiado ? "pointer" : "default",
          }}
        >
          <Check size={14} /> Guardar
        </button>
      </div>
    </div>
  );
}

function Barra({
  editor,
  onArchivos,
  subiendo,
}: {
  editor: Editor;
  /** Si viene, el botón de imagen abre el selector de archivos. */
  onArchivos?: (archivos: File[]) => void;
  subiendo: boolean;
}) {
  const [panel, setPanel] = useState<"youtube" | "spotify" | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

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
    if (onArchivos) {
      inputArchivoRef.current?.click();
      return;
    }
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
        <Boton titulo={onArchivos ? "Subir imagen" : "Imagen"} onClick={ponerImagen}>
          {subiendo ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
        </Boton>
        {onArchivos && (
          <input
            ref={inputArchivoRef}
            type="file"
            accept={ACCEPT_IMAGEN_NOTICIA}
            multiple
            className="hidden"
            onChange={(e) => {
              const elegidos = Array.from(e.target.files ?? []);
              // Se limpia para que elegir el mismo archivo otra vez dispare onChange.
              e.target.value = "";
              if (elegidos.length) onArchivos(elegidos);
            }}
          />
        )}

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

export default function EditorContenido({
  valor,
  onChange,
  placeholder,
  subirImagen,
  onSubiendoChange,
}: Props) {
  /** Subidas en curso (pueden ser varias: arrastrar tres archivos). */
  const [subiendo, setSubiendo] = useState(0);
  const [errorImagen, setErrorImagen] = useState<string | null>(null);

  /**
   * Lo que llaman handlePaste/handleDrop. useEditor captura `editorProps` una
   * sola vez al crear el editor, así que leen la versión actual desde un ref en
   * vez de cerrar sobre la del primer render. Null = sin subida (modo artista):
   * el pegado y el arrastre siguen su comportamiento normal.
   */
  const subirEInsertarRef = useRef<((archivos: File[], pos?: number) => void) | null>(null);

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
      handlePaste: (_view, event) => {
        const subir = subirEInsertarRef.current;
        const archivos = imagenesDe(event.clipboardData?.files);
        if (!subir || !archivos.length) return false;
        event.preventDefault();
        subir(archivos);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const subir = subirEInsertarRef.current;
        // `moved`: es una imagen que ya estaba en el editor y se está moviendo.
        if (!subir || moved) return false;
        const archivos = imagenesDe(event.dataTransfer?.files);
        if (!archivos.length) return false;
        event.preventDefault();
        subir(archivos, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor || !subirImagen) {
      subirEInsertarRef.current = null;
      return;
    }
    subirEInsertarRef.current = async (archivos, pos) => {
      setErrorImagen(null);
      // En orden y de a una, para que queden en el orden en que se eligieron.
      for (const archivo of archivos) {
        setSubiendo((n) => n + 1);
        try {
          const src = await subirImagen(archivo);
          if (editor.isDestroyed) return;
          const cadena = editor.chain().focus();
          // Al arrastrar, la primera va donde se soltó (acotado: el documento
          // pudo achicarse mientras subía); las siguientes, a continuación.
          if (pos !== undefined) cadena.setTextSelection(Math.min(pos, editor.state.doc.content.size));
          cadena.setImage({ src, alt: altDesdeNombre(archivo.name) }).run();
          pos = undefined;
        } catch (err) {
          setErrorImagen(err instanceof Error ? err.message : "No se pudo subir la imagen");
        } finally {
          setSubiendo((n) => n - 1);
        }
      }
    };
  }, [editor, subirImagen]);

  useEffect(() => {
    onSubiendoChange?.(subiendo > 0);
  }, [subiendo, onSubiendoChange]);

  /**
   * La imagen seleccionada (un clic la selecciona como nodo), o null. Con
   * useEditorState porque TipTap 3 no re-renderiza en cada transacción.
   */
  const imagenSeleccionada = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e?.isActive("image")
        ? { pos: e.state.selection.from, alt: (e.getAttributes("image").alt as string | null) ?? "" }
        : null,
    equalityFn: (a, b) => a?.pos === b?.pos && a?.alt === b?.alt,
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
      <Barra
        editor={editor}
        subiendo={subiendo > 0}
        onArchivos={subirImagen ? (archivos) => subirEInsertarRef.current?.(archivos) : undefined}
      />
      {imagenSeleccionada && (
        <PanelAlt
          key={imagenSeleccionada.pos}
          editor={editor}
          altInicial={imagenSeleccionada.alt}
        />
      )}
      <EditorContent editor={editor} />
      {errorImagen && (
        <p
          role="alert"
          className="px-3 py-2 border-t"
          style={{
            borderColor: "#fecdd3",
            backgroundColor: "#fff1f2",
            fontFamily: F.body,
            fontSize: "13px",
            color: "#9f1239",
          }}
        >
          {errorImagen}
        </p>
      )}
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
        {subiendo > 0
          ? "Subiendo imagen..."
          : subirImagen
            ? "Imágenes: botón, pegar o arrastrar (JPG, PNG o WEBP, máx. 5 MB); clic en una para editar su texto alternativo. Videos y música: botones YouTube y Spotify."
            : "Los videos y la música se insertan con los botones YouTube y Spotify."}
      </p>
    </div>
  );
}
