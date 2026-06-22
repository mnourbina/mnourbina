import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { I18nProvider } from "@/i18n/I18nContext";
import ProtectedRoute from "@/components/app/ProtectedRoute";
import AppLayout from "@/components/app/AppLayout";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

import PatientDashboard from "@/pages/patient/PatientDashboard";
import PatientAgenda from "@/pages/patient/PatientAgenda";
import PatientBaby from "@/pages/patient/PatientBaby";

import SoignantDashboard from "@/pages/soignant/SoignantDashboard";
import PatientList from "@/pages/soignant/PatientList";
import PregnanciesList from "@/pages/soignant/PregnanciesList";
import PatientDetail from "@/pages/soignant/PatientDetail";
import NewPatient from "@/pages/soignant/NewPatient";
import CPNForm from "@/pages/soignant/CPNForm";
import PostnatalForm from "@/pages/soignant/PostnatalForm";
import VaccinationForm from "@/pages/soignant/VaccinationForm";
import MPDSRPage from "@/pages/soignant/MPDSRPage";
import MPDSRAuditPage from "@/pages/soignant/MPDSRAuditPage";
import AlertsPage from "@/pages/soignant/AlertsPage";
import SoignantAgenda from "@/pages/soignant/SoignantAgenda";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminConfig from "@/pages/admin/AdminConfig";
import AdminIndicators from "@/pages/admin/AdminIndicators";

import "@/App.css";

function RoleHome() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/app/admin" replace />;
  if (user.role === "soignant") return <Navigate to="/app/soignant" replace />;
  return <Navigate to="/app/patient" replace />;
}

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout><RoleHome /></AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Patient routes */}
          <Route
            path="/app/patient"
            element={
              <ProtectedRoute roles={["patient"]}>
                <AppLayout><PatientDashboard /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/patient/agenda"
            element={
              <ProtectedRoute roles={["patient"]}>
                <AppLayout><PatientAgenda /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/patient/bebe"
            element={
              <ProtectedRoute roles={["patient"]}>
                <AppLayout><PatientBaby /></AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Soignant routes */}
          <Route path="/app/soignant" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><SoignantDashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/app/soignant/patients" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><PatientList /></AppLayout></ProtectedRoute>} />
          <Route path="/app/soignant/grossesses" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><PregnanciesList /></AppLayout></ProtectedRoute>} />
          <Route path="/app/soignant/patients/new" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><NewPatient /></AppLayout></ProtectedRoute>} />
          <Route path="/app/soignant/patients/:id" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><PatientDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/app/soignant/patients/:id/cpn" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><CPNForm /></AppLayout></ProtectedRoute>} />
          <Route path="/app/soignant/patients/:id/postnatal" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><PostnatalForm /></AppLayout></ProtectedRoute>} />
          <Route path="/app/soignant/patients/:id/vaccination" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><VaccinationForm /></AppLayout></ProtectedRoute>} />
          <Route path="/app/soignant/mpdsr" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><MPDSRPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/soignant/audit/:id" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><MPDSRAuditPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/soignant/alerts" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><AlertsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/soignant/agenda" element={<ProtectedRoute roles={["soignant","admin"]}><AppLayout><SoignantAgenda /></AppLayout></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/app/admin" element={<ProtectedRoute roles={["admin"]}><AppLayout><AdminDashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/app/admin/indicators" element={<ProtectedRoute roles={["admin"]}><AppLayout><AdminIndicators /></AppLayout></ProtectedRoute>} />
          <Route path="/app/admin/config" element={<ProtectedRoute roles={["admin"]}><AppLayout><AdminConfig /></AppLayout></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
