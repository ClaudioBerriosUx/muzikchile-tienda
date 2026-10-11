"use client";

import { useState, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Piezas de las pantallas de acceso (/login, /recuperar, /registro), según el
 * diseño "Acceso Artistas" de Claude Design. Usan los tokens `--tema-*` de
 * `app/globals.css`; ningún color va literal acá.
 */

/* ── Íconos (trazos del diseño) ─────────────────────────────────────────── */

function IconoAlerta({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" aria-hidden className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <line x1="12" y1="7" x2="12" y2="13" />
      <circle cx="12" cy="16.6" r="0.6" fill="currentColor" />
    </svg>
  );
}

function IconoInfo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconoCorreo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <polyline points="3.5 7 12 13 20.5 7" />
    </svg>
  );
}

export function IconoReloj({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <circle cx="12" cy="13" r="8" />
      <polyline points="12 9 12 13 14.8 14.8" />
      <line x1="9.5" y1="2.5" x2="14.5" y2="2.5" />
    </svg>
  );
}

export function IconoCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ── Textos ─────────────────────────────────────────────────────────────── */

/** Titular de pantalla. Anton lo pone la regla global de h1. */
export function Titulo({ children, grande = false }: { children: ReactNode; grande?: boolean }) {
  return (
    <h1
      className={cn(
        "m-0 uppercase text-tema-texto text-balance text-[38px]/none",
        grande ? "lg:text-[52px]/none" : "md:text-[44px]/none"
      )}
    >
      {children}
    </h1>
  );
}

export function Bajada({ children }: { children: ReactNode }) {
  return <p className="m-0 text-base leading-[1.65] text-tema-texto-2 text-pretty">{children}</p>;
}

/** Enlace de texto sobre oscuro: azul claro (AA), nunca el azul de marca. */
export function Enlace({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const clases = cn(
    "font-medium text-tema-azul-texto hover:text-tema-azul-texto-hover hover:underline focus-visible:outline-2 focus-visible:outline-tema-azul-texto",
    className
  );
  // mailto y externos no pasan por el router.
  return href.startsWith("/") ? (
    <Link href={href} className={clases}>{children}</Link>
  ) : (
    <a href={href} className={clases}>{children}</a>
  );
}

/* ── Avisos ─────────────────────────────────────────────────────────────── */

export function Aviso({
  tipo,
  children,
}: {
  tipo: "error" | "info";
  children: ReactNode;
}) {
  const error = tipo === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-[10px] border px-4 py-3.5 text-sm leading-[1.55]",
        error
          ? "border-tema-rojo bg-tema-rojo-fondo text-tema-rojo-texto-suave"
          : "border-tema-azul bg-tema-azul-fondo text-tema-azul-texto-suave"
      )}
    >
      {error ? (
        <IconoAlerta className="mt-px h-[18px] w-[18px] shrink-0 text-tema-rojo-texto" />
      ) : (
        <IconoInfo className="mt-px h-[18px] w-[18px] shrink-0 text-tema-azul-texto" />
      )}
      <div className="[&_strong]:font-bold [&_strong]:text-tema-texto">{children}</div>
    </div>
  );
}

/** Ícono en caja de 56px que encabeza las pantallas de estado. */
export function IconoEstado({ tipo, children }: { tipo: "info" | "error"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-[14px] border",
        tipo === "info"
          ? "border-tema-azul bg-tema-azul-fondo text-tema-azul-texto"
          : "border-tema-rojo bg-tema-rojo-fondo text-tema-rojo-texto"
      )}
    >
      {children}
    </div>
  );
}

/* ── Campos ─────────────────────────────────────────────────────────────── */

const claseInput =
  "box-border h-[50px] w-full rounded-[10px] border bg-tema-campo px-4 text-base text-tema-texto " +
  "placeholder:text-tema-texto-3 outline-none transition-[border-color,box-shadow] " +
  "focus:border-tema-azul-texto focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--tema-azul)_60%,transparent)]";

type PropsCampo = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  etiqueta: string;
  error?: string;
  /** Borde rojo sin mensaje propio (p. ej. credenciales incorrectas). */
  marcado?: boolean;
  ref?: Ref<HTMLInputElement>;
};

function MensajeCampo({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="flex items-center gap-[7px] text-[13px] text-tema-rojo-texto">
      <IconoAlerta className="h-3.5 w-3.5 shrink-0" />
      {children}
    </div>
  );
}

export function Campo({ id, etiqueta, error, marcado, className, ref, ...resto }: PropsCampo) {
  const invalido = Boolean(error) || marcado;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tema-texto">{etiqueta}</label>
      <input
        id={id}
        ref={ref}
        aria-invalid={invalido || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(claseInput, invalido ? "border-tema-rojo" : "border-tema-borde-campo", className)}
        {...resto}
      />
      {error && <MensajeCampo id={`${id}-error`}>{error}</MensajeCampo>}
    </div>
  );
}

/** Campo de contraseña con botón Mostrar/Ocultar. */
export function CampoContrasena({
  id,
  etiqueta,
  error,
  marcado,
  className,
  ref,
  mostrar: mostrarControlado,
  onMostrarChange,
  ...resto
}: PropsCampo & { mostrar?: boolean; onMostrarChange?: (v: boolean) => void }) {
  const [mostrarLocal, setMostrarLocal] = useState(false);
  const mostrar = mostrarControlado ?? mostrarLocal;
  const alternar = () => {
    onMostrarChange?.(!mostrar);
    if (mostrarControlado === undefined) setMostrarLocal(!mostrar);
  };
  const invalido = Boolean(error) || marcado;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tema-texto">{etiqueta}</label>
      <div className="relative">
        <input
          id={id}
          ref={ref}
          type={mostrar ? "text" : "password"}
          aria-invalid={invalido || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(claseInput, "pr-[84px]", invalido ? "border-tema-rojo" : "border-tema-borde-campo", className)}
          {...resto}
        />
        <button
          type="button"
          onClick={alternar}
          aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-1.5 top-1.5 flex h-[38px] items-center rounded-lg px-3 text-[13px] font-medium text-tema-texto-2 hover:bg-tema-hover hover:text-tema-texto focus-visible:outline-2 focus-visible:outline-tema-azul-texto"
        >
          {mostrar ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {error && <MensajeCampo id={`${id}-error`}>{error}</MensajeCampo>}
    </div>
  );
}

/* ── Botones ────────────────────────────────────────────────────────────── */

export function BotonPrimario({
  children,
  cargando = false,
  textoCargando,
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  cargando?: boolean;
  textoCargando?: string;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  const inactivo = disabled && !cargando;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(
        "box-border flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[10px] text-base font-bold",
        "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-tema-azul-texto",
        cargando && "cursor-progress bg-tema-rojo-oscuro text-tema-texto",
        inactivo && "cursor-not-allowed bg-tema-borde text-tema-texto-3",
        !cargando && !inactivo && "cursor-pointer bg-tema-rojo text-tema-texto hover:brightness-[1.12]"
      )}
    >
      {cargando ? (
        <>
          <span className="inline-block h-[18px] w-[18px] animate-spin rounded-full border-[2.5px] border-tema-texto/30 border-t-tema-texto" />
          {textoCargando ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Enlace con forma de botón primario (p. ej. "Pedir un enlace nuevo"). */
export function EnlaceBoton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="box-border flex h-[52px] w-full items-center justify-center rounded-[10px] bg-tema-rojo text-base font-bold text-tema-texto hover:brightness-[1.12] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-tema-azul-texto"
    >
      {children}
    </Link>
  );
}

/* ── Contenedores ───────────────────────────────────────────────────────── */

/** Brillos rojo y azul de las esquinas, detrás de todo. */
export function Brillos() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[120px] -top-[220px] h-[560px] w-[560px] rounded-full"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--tema-rojo) 16%, transparent) 0%, transparent 68%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-[260px] -right-[100px] h-[560px] w-[560px] rounded-full"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--tema-azul) 18%, transparent) 0%, transparent 68%)" }}
      />
    </>
  );
}

/**
 * Pantalla de una sola tarjeta (/recuperar y /registro): en desktop, tarjeta
 * centrada; en móvil, el contenido va plano sobre el fondo.
 */
export function PantallaTarjeta({ children }: { children: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-tema-fondo text-tema-texto">
      <Brillos />
      <div className="relative flex min-h-[calc(100dvh-64px)] flex-col items-stretch px-[22px] py-6 md:items-center md:justify-center md:px-6 md:py-10">
        <div className="flex w-full flex-col gap-4 md:max-w-[460px] md:gap-5 md:rounded-xl md:border md:border-tema-borde md:bg-tema-campo md:px-10 md:pb-9 md:pt-10">
          {children}
        </div>
      </div>
    </section>
  );
}
