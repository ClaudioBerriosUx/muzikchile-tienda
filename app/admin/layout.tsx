"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Package, Music, Tag,
  ShoppingBag, Ticket, Wallet, Settings, LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [pendientes, setPendientes] = useState(0);

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

      const { count } = await supabase
        .from("productos")
        .select("id", { count: "exact", head: true })
        .eq("estado", "en_revision");

      setPendientes(count ?? 0);
      setAuthorized(true);
    }

    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const sidebarItems = useMemo(() => [
    { label: "Dashboard",            href: "/admin",                icon: <LayoutDashboard size={16} /> },
    { label: "Productos pendientes", href: "/admin/productos",      icon: <Package size={16} />, badge: pendientes },
    { label: "Artistas",             href: "/admin/artistas",       icon: <Music size={16} /> },
    { label: "Categorías",           href: "/admin/categorias",     icon: <Tag size={16} /> },
    { label: "Órdenes",              href: "/admin/ordenes",        icon: <ShoppingBag size={16} /> },
    { label: "Cupones globales",     href: "/admin/cupones",        icon: <Ticket size={16} /> },
    { label: "Liquidaciones",        href: "/admin/liquidaciones",  icon: <Wallet size={16} /> },
    { label: "Configuración",        href: "/admin/configuracion",  icon: <Settings size={16} /> },
  ], [pendientes]);

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
