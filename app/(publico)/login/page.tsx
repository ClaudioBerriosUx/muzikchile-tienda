import { Suspense } from "react";
import { Brillos } from "@/components/acceso/ui";
import { ListaBeneficios, PanelBeneficios } from "@/components/acceso/beneficios";
import FormLogin from "./FormLogin";

/**
 * /login — diseño "Acceso Artistas", opción 3A: dos columnas iguales, el
 * formulario a la izquierda y a la derecha un panel solo de texto (los 4
 * beneficios en Anton grande entre dos marquesinas). En móvil y tablet, el
 * formulario va primero y la lista de beneficios queda debajo, a todo el ancho.
 *
 * Server Component: arma el layout. La lógica de autenticación vive entera en
 * FormLogin, que va dentro de Suspense porque lee `redirectTo` con
 * useSearchParams.
 *
 * La sección llena al menos el alto de la pantalla menos el Header
 * (`--alto-header`), así el footer nunca sube. La grilla ocupa todo el ancho
 * para que el panel llegue al borde; el formulario se limita a 420px y se
 * centra en su columna.
 */
export default function LoginPage() {
  return (
    <section className="relative overflow-hidden bg-tema-fondo text-tema-texto">
      <Brillos />
      <div className="relative grid min-h-[calc(100dvh-var(--alto-header))] w-full grid-cols-1 lg:min-h-[max(720px,calc(100dvh-var(--alto-header)))] lg:grid-cols-2">
        <div className="flex min-w-0 flex-col px-[22px] pb-[22px] pt-6 md:items-center md:px-10 md:py-12 lg:justify-center lg:px-16">
          <div className="w-full md:max-w-[460px] lg:max-w-[420px]">
            <Suspense fallback={<div className="min-h-[540px]" aria-busy />}>
              <FormLogin />
            </Suspense>
          </div>
          <ListaBeneficios className="self-stretch lg:hidden" />
        </div>
        <PanelBeneficios className="hidden lg:flex" />
      </div>
    </section>
  );
}
