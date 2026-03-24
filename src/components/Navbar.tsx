import { Link, useLocation } from "react-router-dom";
import { Brain, Menu, X, LogOut, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useTheme } from "next-themes";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = user
    ? [
        { label: "Dashboard", to: "/dashboard" },
        { label: "Topic Quiz", to: "/topic-quiz" },
        { label: "Generate Paper", to: "/generate-paper" },
        { label: "Classrooms", to: "/classrooms" },
        { label: "Chat", to: "/chat" },
        { label: "History", to: "/analytics" },
        ...(isAdmin ? [{ label: "Admin", to: "/admin" }] : []),
      ]
    : [];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/90 backdrop-blur-xl border-b border-border shadow-sm" : "bg-transparent border-b border-transparent"}`}>
      <div className="container mx-auto max-w-5xl flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2.5 font-bold text-lg font-display">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
            <Brain className="h-4 w-4 text-primary-foreground" />
          </div>
          QuizAI
        </Link>

        {/* Desktop */}
        <div className="hidden sm:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm font-medium px-3 py-2 rounded-lg transition-all duration-200 ${
                location.pathname === l.to
                  ? "text-primary bg-primary/8"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <div className="flex items-center gap-2 ml-3">
              <Link to="/upload">
                <Button size="sm" className="gradient-bg text-primary-foreground font-semibold hover:opacity-90 transition-all btn-glow rounded-lg h-9 px-4">
                  New Quiz
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="text-muted-foreground hover:text-foreground h-9 w-9 p-0">
                {mounted && resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={signOut} className="text-muted-foreground hover:text-foreground h-9 w-9 p-0">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-3">
              <Button size="sm" variant="ghost" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="text-muted-foreground hover:text-foreground h-9 w-9 p-0">
                {mounted && resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Link to="/auth">
                <Button size="sm" className="gradient-bg text-primary-foreground font-semibold hover:opacity-90 transition-all rounded-lg h-9 px-4">
                  Sign In
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="sm:hidden p-2 rounded-lg hover:bg-muted/60 transition-colors" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="sm:hidden border-t border-border bg-background/95 backdrop-blur-xl px-4 py-5 space-y-2 animate-fade-in">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`block text-sm font-medium px-3 py-2.5 rounded-lg transition-colors ${
                location.pathname === l.to ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Button size="sm" variant="outline" className="w-full rounded-lg flex items-center justify-center gap-2" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
            {mounted && resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {mounted && resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
          {user ? (
            <div className="pt-2 space-y-2">
              <Link to="/upload" onClick={() => setOpen(false)}>
                <Button size="sm" className="w-full gradient-bg text-primary-foreground font-semibold rounded-lg">
                  New Quiz
                </Button>
              </Link>
              <Button size="sm" variant="outline" className="w-full rounded-lg" onClick={() => { signOut(); setOpen(false); }}>
                Sign Out
              </Button>
            </div>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} className="block pt-2">
              <Button size="sm" className="w-full gradient-bg text-primary-foreground font-semibold rounded-lg">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
