import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Home, Library, Plus, Brain, BookOpen } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const primaryItems = [
  { title: "Home", url: "/", icon: Home, end: true },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Daily Quiz", url: "/quiz", icon: Brain },
];

const libraryItems = [
  { title: "Dictionary", url: "/dictionary", icon: Library },
  { title: "Add Word", url: "/add", icon: Plus },
];

export const AppSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const renderItem = (item: { title: string; url: string; icon: typeof Home; end?: boolean }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild tooltip={item.title}>
        <NavLink
          to={item.url}
          end={item.end}
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
    </Sidebar>
  );
};
