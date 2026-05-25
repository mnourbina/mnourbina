import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import Logo from "@/components/Logo";
import LangToggle from "@/components/LangToggle";
import { LogOut, Menu, X } from "lucide-react";

export default function Layout({ title, nav = [], children, density = "normal" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" data-testid="header-logo-link"><Logo /></Link>
            {title && (
              <span className="hidden md:inline-flex items-center text-xs font-semibold tracking-widest uppercase text-primary border-l border-border pl-4 ml-2">
                {title}
              </span>
            )}
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={`nav-${n.to.replace(/[\/]/g, "-")}`}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <LangToggle />
            {user && (
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold leading-tight">{user.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{roleLabel(user.role)}</span>
              </div>
            )}
            <button
              onClick={onLogout}
              data-testid="header-logout-btn"
              className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Se deconnecter"
            >
              <LogOut size={16} />
              <span>Quitter</span>
            </button>
            <button
              className="md:hidden p-2 rounded-md hover:bg-secondary"
              onClick={() => setOpen((o) => !o)}
              data-testid="mobile-menu-toggle"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="px-4 py-3 flex flex-col gap-1">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-3 rounded-md text-base font-medium ${isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"}`
                  }
                  data-testid={`mobile-nav-${n.to.replace(/[\/]/g, "-")}`}
                >{n.label}</NavLink>
              ))}
              <button onClick={onLogout} className="px-3 py-3 text-left rounded-md text-base font-medium text-destructive" data-testid="mobile-logout-btn">Quitter</button>
            </div>
          </div>
        )}
      </header>
      <main className={`max-w-[1400px] mx-auto ${density === "wide" ? "px-2 sm:px-4" : "px-4 sm:px-6"} py-6 sm:py-8`}>
        {children}
      </main>
      <footer className="mt-12 border-t border-border py-6 text-center text-xs text-muted-foreground">
        Khalaba · Sante materno-infantile · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function roleLabel(role) {
  return {
    admin: "Administrateur",
    gynecologist: "Gynecologue",
    midwife: "Sage-femme",
    patient: "Patiente",
  }[role] || role;
}
