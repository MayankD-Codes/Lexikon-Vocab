import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import LexiChat from "@/components/LexiChat";
import WelcomeTour from "@/components/WelcomeTour";

const titles: Record<string, string> = {
  "/": "Home",
  "/dashboard": "Dashboard",
  "/quiz": "Daily Quiz",
  "/memory-palace": "Memory Palace",
  "/leaderboard": "Leaderboard",
  "/community": "Community",
  "/dictionary": "Dictionary",
  "/add": "Add Word",
  "/capture": "Capture Word",
  "/profile": "Profile",
};

const AppLayout = () => {
  const { pathname } = useLocation();
  const title =
    titles[pathname] ??
    (pathname.startsWith("/word/") ? "Word" : "Lexikon");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border/60 bg-card/70 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-3 sm:px-5">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="text-foreground" />
              <span className="font-display text-base sm:text-lg font-semibold truncate">
                {title}
              </span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 bg-gradient-paper">
            <Outlet />
          </main>
        </div>
        <LexiChat />
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
