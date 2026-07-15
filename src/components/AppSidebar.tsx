import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Home, Library, Plus, Brain, BookOpen, LogOut, Trophy, MessagesSquare, Castle, Camera, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const primaryItems = [
  { title: "Home", url: "/", icon: Home, end: true },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Daily Quiz", url: "/quiz", icon: Brain },
  { title: "Memory Palace", url: "/memory-palace", icon: Castle },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
  { title: "Community", url: "/community", icon: MessagesSquare },
];

const libraryItems = [
  { title: "Dictionary", url: "/dictionary", icon: Library },
  { title: "Add Word", url: "/add", icon: Plus },
  { title: "Capture Word", url: "/capture", icon: Camera },
  { title: "Upgrade to Pro", url: "/pricing", icon: Sparkles },
];

export const AppSidebar = () => {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setDisplayName(null);
      setUsername(null);
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("display_name, avatar_url, username")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setDisplayName(data.display_name ?? null);
        setUsername(data.username ?? null);
        setAvatarUrl(data.avatar_url ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname]);

  const handleNavClick = () => {
    if (state === "expanded") {
      toggleSidebar();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
  };

  const label = displayName || (username ? `@${username}` : "Account");
  const initials = (displayName || username || "?").trim().slice(0, 2).toUpperCase();

  const renderItem = (item: { title: string; url: string; icon: typeof Home; end?: boolean }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild tooltip={item.title}>
        <NavLink
          to={item.url}
          end={item.end}
          onClick={handleNavClick}
          className={({ isActive }) =>
            [
              "flex items-center gap-3 rounded-md transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "hover:bg-sidebar-accent/60",
            ].join(" ")
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <NavLink to="/" className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-warm flex items-center justify-center shadow-soft shrink-0">
            <BookOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display text-lg font-semibold tracking-tight">Lexikon</span>
          )}
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Overview</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{primaryItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Vocabulary</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{libraryItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={label}>
              <NavLink
                to="/profile"
                onClick={handleNavClick}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-md transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "hover:bg-sidebar-accent/60",
                  ].join(" ")
                }
              >
                <Avatar className="h-7 w-7 shrink-0">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={label} />}
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <span className="truncate text-xs text-sidebar-foreground/80">
                    {label}
                  </span>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip="Sign out"
              className="hover:bg-sidebar-accent/60"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
