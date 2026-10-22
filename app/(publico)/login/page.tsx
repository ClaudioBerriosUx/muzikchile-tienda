import { Suspense } from "react";
import { Brillos } from "@/components/acceso/ui";
import { CarruselBeneficios, MosaicoBeneficios } from "@/components/acceso/beneficios";
import FormLogin from "./FormLogin";

/**
 * /login — diseño "Acceso Artistas", opción 2A: formulario a la izquierda y
 * mosaico de beneficios a la derecha; en móvil y tablet, el formulario va
 * primero y los beneficios quedan en un carrusel debajo.
 *
 * Server Component: arma el layout y el mosaico (que revisa en el build qué
 * fotos hay en public/acceso/). La lógica de autenticación vive entera en
 * FormLogin, que va dentro de Suspense porque lee `redirectTo` con
 * useSearchParams.
 *
 * Pantallas grandes: la sección llena al menos el alto de la pantalla menos
 * el Header (`--alto-header`), así el footer nunca sube y no asoma el fondo claro; y el
 * contenido se limita a 1440px centrado, con la columna del formulario de
 * ancho acotado (420–560px) y el mosaico en el resto.
 */
export default function LoginPage() {
  return (
    <section className="relative overflow-hidden bg-tema-fondo text-tema-texto">
      <Brillos />
      <div className="relative mx-auto grid min-h-[calc(100dvh-var(--alto-header))] w-full max-w-[1440px] grid-cols-1 lg:min-h-[max(720px,calc(100dvh-var(--alto-header)))] lg:grid-cols-[minmax(420px,560px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col px-[22px] pb-[22px] pt-6 md:items-center md:px-10 md:py-12 lg:justify-center lg:px-16">
          <div className="w-full md:max-w-[460px] lg:max-w-[420px]">
            <Suspense fallback={<div className="min-h-[540px]" aria-busy />}>
              <FormLogin />
            </Suspense>
          </div>
          <CarruselBeneficios className="mt-auto md:max-w-[460px] lg:hidden" />
        </div>
        <MosaicoBeneficios className="hidden lg:flex" />
      </div>
    </section>
  );
}
