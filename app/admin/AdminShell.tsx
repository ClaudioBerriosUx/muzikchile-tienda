"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Package, Newspaper, Music, Tag,
  ShoppingBag, Ticket, Wallet, Settings, LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        router.push("/login?redirectTo=/admin");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData?.role !== "admin") {
        router.push("/");
        return;
      }

      setAuthorized(true);
    }

    checkAuth();
  }, [router]);

  /**
   * Los contadores de los badges van por React Query, no por useState en el
   * efecto de auth: así las mutaciones de moderación los refrescan solos.
   *
   * Las queryKeys NO son arbitrarias — son las que las páginas de moderación ya
   * invalidan al aprobar/rechazar/devolver:
   *   - `admin/productos`     invalida ["admin-count-revision"]
   *   - `admin/publicaciones` invalida ["admin-count-publicaciones-pendientes"]
   *
   * Antes el badge se calculaba una sola vez al montar el layout y se quedaba
   * pegado hasta recargar la página. (La invalidación de productos ya existía y
   * refrescaba el dashboard, que consume la misma key; solo el sidebar se
   * quedaba fuera.)
   */
  const { data: pendientes = 0 } = useQuery({
    queryKey: ["admin-count-revision"],
    queryFn: async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("productos")
        .select("id", { count: "exact", head: true })
        .eq("estado", "en_revision");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: authorized,
  });

  const { data: pendientesPub = 0 } = useQuery({
    queryKey: ["admin-count-publicaciones-pendientes"],
    queryFn: async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("publicaciones")
        .select("id", { count: "exact", head: true })
        .eq("estado", "pendiente");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: authorized,
  });

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const sidebarItems = useMemo(() => [
    { label: "Dashboard",            href: "/admin",                icon: <LayoutDashboard size={16} /> },
    { label: "Productos pendientes", href: "/admin/productos",      icon: <Package size={16} />, badge: pendientes },
    { label: "Publicaciones",        href: "/admin/publicaciones",  icon: <Newspaper size={16} />, badge: pendientesPub },
    { label: "Artistas",             href: "/admin/artistas",       icon: <Music size={16} /> },
    { label: "Categorías",           href: "/admin/categorias",     icon: <Tag size={16} /> },
    { label: "Órdenes",              href: "/admin/ordenes",        icon: <ShoppingBag size={16} /> },
    { label: "Cupones globales",     href: "/admin/cupones",        icon: <Ticket size={16} /> },
    { label: "Liquidaciones",        href: "/admin/liquidaciones",  icon: <Wallet size={16} /> },
    { label: "Configuración",        href: "/admin/configuracion",  icon: <Settings size={16} /> },
  ], [pendientes, pendientesPub]);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f8f7f5" }}>
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>Verificando acceso...</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="flex min-h-screen">
        <Sidebar
          items={sidebarItems}
          footer={
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-5 py-3 text-sm transition-colors"
              style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#e8003d";
                e.currentTarget.style.backgroundColor = "#fff5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#666666";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          }
        />
        <main className="flex-1 p-8 bg-white">{children}</main>
      </div>
    </>
  );
}
