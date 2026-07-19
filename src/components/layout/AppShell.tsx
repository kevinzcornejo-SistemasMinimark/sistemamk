import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1280 : true,
  );

  return (
    <div className="h-screen overflow-hidden bg-background flex">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Header
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto min-h-0">{children}</main>
      </div>
    </div>
  );
}