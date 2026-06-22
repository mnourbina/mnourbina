import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import Logo from "./Logo";
import LanguageToggle from "./LanguageToggle";
import AuditGate from "./AuditGate";
import OfflineIndicator from "./OfflineIndicator";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Syringe,
  AlertTriangle,
  Settings,
  Baby,
  Heart,
  Bell,
  LogOut,
  Menu,
  X,
  BarChart3,
  Activity,
  FileBarChart,
  Search,
  History,
} from "lucide-react";

const navByRole = (t) => ({
  admin: [
    { to: "/app/admin", icon: BarChart3, label: t("admin.dashboard"), testid: "nav-admin-dash" },
    { to: "/app/admin/ltfu", icon: Search, label: "Perdues de vue", testid: "nav-admin-ltfu" },
    { to: "/app/admin/report", icon: FileBarChart, label: "Rapport mensuel", testid: "nav-admin-report" },
    { to: "/app/admin/indicators", icon: Activity, label: t("nav.indicators"), testid: "nav-admin-indicators" },
    { to: "/app/admin/audit-logs", icon: History, label: "Journal d'audit", testid: "nav-admin-audit" },
    { to: "/app/admin/config", icon: Settings, label: t("nav.config"), testid: "nav-admin-config" },
  ],
  soignant: [
    { to: "/app/soignant", icon: LayoutDashboard, label: t("nav.dashboard"), testid: "nav-soignant-dash" },
    { to: "/app/soignant/grossesses", icon: Heart, label: t("nav.pregnancies"), testid: "nav-soignant-pregnancies" },
    { to: "/app/soignant/patients", icon: Users, label: t("nav.patients"), testid: "nav-soignant-patients" },
    { to: "/app/soignant/agenda", icon: Calendar, label: t("nav.agenda"), testid: "nav-soignant-agenda" },
    { to: "/app/soignant/alerts", icon: Bell, label: t("nav.alerts"), testid: "nav-soignant-alerts" },
    { to: "/app/soignant/mpdsr", icon: AlertTriangle, label: t("nav.mpdsr"), testid: "nav-soignant-mpdsr" },
  ],
  patient: [
    { to: "/app/patient", icon: Heart, label: t("nav.pregnancy"), testid: "nav-patient-home" },
    { to: "/app/patient/agenda", icon: Calendar, label: t("nav.appointments"), testid: "nav-patient-agenda" },
    { to: "/app/patient/bebe", icon: Baby, label: t("nav.baby"), testid: "nav-patient-baby" },
  ],
});

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { t, isRtl } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = navByRole(t)[user?.role] || [];

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const sideStart = isRtl ? "right-0" : "left-0";

  return (
    <div className="min-h-screen bg-[#F7F3EB] flex" dir={isRtl ? "rtl" : "ltr"}>
      <aside
        className={`fixed lg:sticky top-0 ${sideStart} z-40 h-screen w-72 bg-white ${isRtl ? "border-l" : "border-r"} border-[#3E2723]/10 transform transition-transform duration-300 ${
          open ? "translate-x-0" : (isRtl ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0")
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

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#3E2723]/10 bg-white space-y-3">
          <LanguageToggle />
          <div className="flex justify-center">
            <OfflineIndicator />
          </div>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C85A48] to-[#D99A5A] flex items-center justify-center text-white font-semibold shrink-0">
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#3E2723]/15 text-[#795C55] hover:bg-[#F7F3EB] hover:text-[#C85A48] transition font-medium"
            data-testid="logout-btn"
          >
            <LogOut size={16} />
            {t("logout")}
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-[#3E2723]/40 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 min-w-0">
        <header className="lg:hidden bg-white border-b border-[#3E2723]/10 sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setOpen(true)} className="text-[#3E2723]" data-testid="sidebar-open-btn">
            <Menu size={24} />
          </button>
          <Logo size={32} />
          <div className="w-6" />
        </header>
        <main className="p-4 md:p-8 max-w-7xl mx-auto" data-testid="app-main">
          <AuditGate>{children}</AuditGate>
        </main>
      </div>
    </div>
  );
}
