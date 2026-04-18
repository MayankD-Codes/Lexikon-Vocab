import { Link, useLocation } from "react-router-dom";
import { BookOpen, Plus, Library } from "lucide-react";
import { Button } from "@/components/ui/button";

const Header = () => {
  const { pathname } = useLocation();
  return (
    <header className="border-b border-border/60 bg-card/70 backdrop-blur-md sticky top-0 z-40">
      <div className="container flex items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-9 w-9 rounded-lg bg-gradient-warm flex items-center justify-center shadow-soft group-hover:shadow-elegant transition-shadow">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">
            Lexikon
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button
            asChild
            variant={pathname === "/dictionary" ? "secondary" : "ghost"}
            size="sm"
          >
            <Link to="/dictionary">
              <Library className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Dictionary</span>
            </Link>
          </Button>
          <Button asChild variant="default" size="sm">
            <Link to="/add">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Word</span>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
