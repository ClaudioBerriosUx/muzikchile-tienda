"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Package, Plus, User, Ticket, Wallet, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

const SIDEBAR_ITEMS = [
  { label: "Dashboard",      href: "/panel",                   icon: <LayoutDashboard size={16} /> },
  { label: "Mis productos",  href: "/panel/productos",          icon: <Package size={16} /> },
  { label: "Subir producto", href: "/panel/productos/nuevo",    icon: <Plus size={16} /> },
  { label: "Mi perfil",      href: "/panel/perfil",             icon: <User size={16} /> },
  { label: "Mis cupones",    href: "/panel/cupones",            icon: <Ticket size={16} /> },
  { label: "Liquidaciones",  href: "/panel/liquidaciones",      icon: <Wallet size={16} /> },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirectTo=/panel");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const role = roleData?.role;

      if (!role) {
        router.push("/login?redirectTo=/panel");
        return;
      }
      if (role === "admin") {
        router.push("/admin");
        return;
      }
      if (role !== "artista") {
        router.push("/");
        return;
      }

      setAuthorized(true);
    }

    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!authorized) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#f8f7f5" }}
      >
        <p style={{ fontFamily: "Barlow, sans-serif", color: "#666666" }}>
          Verificando acceso...
        </p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="flex min-h-screen">
        <Sidebar
          items={SIDEBAR_ITEMS}
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
