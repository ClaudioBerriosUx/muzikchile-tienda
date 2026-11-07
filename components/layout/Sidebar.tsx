"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: number;
}

interface Props {
  items: SidebarItem[];
  footer?: React.ReactNode;
  /** En móvil, el menú pasa a una franja horizontal sobre el contenido. */
  franjaMovil?: boolean;
}

export default function Sidebar({ items, footer, franjaMovil }: Props) {
  const pathname = usePathname();

  return (
    <>
    {franjaMovil && (
      <nav
        aria-label="Menú del panel"
        className="sticky top-16 z-40 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[#e8e8e8] px-2 py-2 md:hidden"
        style={{ backgroundColor: "#f8f7f5" }}
      >
        {items.map((item) => {
          const activo =
            pathname === item.href ||
            (item.href !== "/panel" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activo ? "page" : undefined}
              className="shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm"
              style={{
                fontFamily: "var(--font-body)",
                backgroundColor: activo ? "#111111" : "transparent",
                color: activo ? "#ffffff" : "#666666",
              }}
            >
              {item.label}
            </Link>
          );
        })}
        {footer && <div className="shrink-0 whitespace-nowrap">{footer}</div>}
      </nav>
    )}
    <div
      className={`w-60 sticky top-16 border-r border-[#e8e8e8] shrink-0 flex-col ${franjaMovil ? "hidden md:flex" : "flex"}`}
      style={{ height: "calc(100vh - 64px)", backgroundColor: "#f8f7f5" }}
    >
      <nav className="flex-1 overflow-y-auto py-4">
        {items.map((item) => {
          const activo =
            pathname === item.href ||
            (item.href !== "/panel" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 py-3 text-sm transition-colors"
              style={{
                fontFamily: "var(--font-body)",
                paddingLeft: activo ? "17px" : "20px",
                borderLeft: activo ? "3px solid #e8003d" : "3px solid transparent",
                backgroundColor: activo ? "#ffffff" : "transparent",
                color: activo ? "#111111" : "#666666",
              }}
            >
              {item.icon && <span className="shrink-0 w-4 h-4">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className="text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 mr-3"
                  style={{ backgroundColor: "#e8003d" }}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {footer && (
        <div className="border-t border-[#e8e8e8] shrink-0 bg-[#f8f7f5]">
          {footer}
        </div>
      )}
    </div>
    </>
  );
}
