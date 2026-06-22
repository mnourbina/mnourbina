import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Logo from "./Logo";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Syringe,
  AlertTriangle,
  Settings,
  Baby,
  Heart,
  LogOut,
  Menu,
  X,
  BarChart3,
} from "lucide-react";

const linksByRole = {
  admin: [
    { to: "/app/admin", icon: BarChart3, label: "Tableau de bord", testid: "nav-admin-dash" },
    { to: "/app/admin/config", icon: Settings, label: "Configuration", testid: "nav-admin-config" },
  ],
  soignant: [
    { to: "/app/soignant", icon: LayoutDashboard, label: "Tableau de bord", testid: "nav-soignant-dash" },
    { to: "/app/soignant/patients", icon: Users, label: "Mes patientes", testid: "nav-soignant-patients" },
    { to: "/app/soignant/agenda", icon: Calendar, label: "Agenda", testid: "nav-soignant-agenda" },
    { to: "/app/soignant/mpdsr", icon: AlertTriangle, label: "Surveillance (MPDSR)", testid: "nav-soignant-mpdsr" },
  ],
  patient: [
    { to: "/app/patient", icon: Heart, label: "Ma grossesse", testid: "nav-patient-home" },
    { to: "/app/patient/agenda", icon: Calendar, label: "Mes rendez-vous", testid: "nav-patient-agenda" },
    { to: "/app/patient/bebe", icon: Baby, label: "Mon bébé", testid: "nav-patient-baby" },
  ],
};

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = linksByRole[user?.role] || [];

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#F7F3EB] flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-white border-r border-[#3E2723]/10 transform transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        data-testid="app-sidebar"
      >
        <div className="px-6 py-5 border-b border-[#3E2723]/10 flex items-center justify-between">
          <Link to="/app" onClick={() => setOpen(false)}>
            <Logo size={36} />
          </Link>
          <button
            className="lg:hidden text-[#795C55]"
            onClick={() => setOpen(false)}
            data-testid="sidebar-close-btn"
          >
            <X size={22} />
          </button>
        </div>
        <nav className="p-4 flex flex-col gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              onClick={() => setOpen(false)}
              data-testid={l.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive
                    ? "bg-[#C85A48] text-white shadow-md shadow-[#C85A48]/30"
                    : "text-[#3E2723] hover:bg-[#F7F3EB]"
                }`
              }
            >
              <l.icon size={18} strokeWidth={2} />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#3E2723]/10 bg-white">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C85A48] to-[#D99A5A] flex items-center justify-center text-white font-semibold">
              {(user?.name || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#3E2723] truncate" data-testid="user-name">
                {user?.name}
              </div>
              <div className="text-xs text-[#795C55] capitalize">
                {user?.role === "soignant" ? user?.profession || "Soignant" : user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#3E2723]/15 text-[#795C55] hover:bg-[#F7F3EB] hover:text-[#C85A48] transition font-medium"
            data-testid="logout-btn"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-[#3E2723]/40 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-[#3E2723]/10 sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setOpen(true)} className="text-[#3E2723]" data-testid="sidebar-open-btn">
            <Menu size={24} />
          </button>
          <Logo size={32} />
          <div className="w-6" />
        </header>
        <main className="p-4 md:p-8 max-w-7xl mx-auto" data-testid="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
