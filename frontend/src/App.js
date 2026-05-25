import "@/App.css";
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import OfflineBanner from "@/components/OfflineBanner";
import { initNetworkListeners } from "@/lib/network";
import { applyLanguageOnBoot } from "@/lib/language";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";

import PatientDashboard from "@/pages/patient/PatientDashboard";
import PatientVaccines from "@/pages/patient/PatientVaccines";

import ProDashboard from "@/pages/pro/ProDashboard";
import PatientsList from "@/pages/pro/PatientsList";
import PatientDetail from "@/pages/pro/PatientDetail";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminExports from "@/pages/admin/AdminExports";
import AdminMpdsr from "@/pages/admin/AdminMpdsr";
import AdminSync from "@/pages/admin/AdminSync";

function App() {
  useEffect(() => {
    applyLanguageOnBoot();
    const cleanup = initNetworkListeners();
    return cleanup;
  }, []);

  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <OfflineBanner />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            {/* Patient portal */}
            <Route path="/portail/patiente" element={
              <ProtectedRoute roles={["patient"]}><PatientDashboard /></ProtectedRoute>
            } />
            <Route path="/portail/patiente/vaccins" element={
              <ProtectedRoute roles={["patient"]}><PatientVaccines /></ProtectedRoute>
            } />

            {/* Professional portal */}
            <Route path="/portail/pro" element={
              <ProtectedRoute roles={["midwife", "gynecologist"]}><ProDashboard /></ProtectedRoute>
            } />
            <Route path="/portail/pro/patientes" element={
              <ProtectedRoute roles={["midwife", "gynecologist"]}><PatientsList /></ProtectedRoute>
            } />
            <Route path="/portail/pro/patientes/:id" element={
              <ProtectedRoute roles={["midwife", "gynecologist", "admin"]}><PatientDetail /></ProtectedRoute>
            } />

            {/* Admin portal */}
            <Route path="/portail/admin" element={
              <ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>
            } />
            <Route path="/portail/admin/utilisateurs" element={
              <ProtectedRoute roles={["admin"]}><AdminUsers /></ProtectedRoute>
            } />
            <Route path="/portail/admin/mpdsr" element={
              <ProtectedRoute roles={["admin"]}><AdminMpdsr /></ProtectedRoute>
            } />
            <Route path="/portail/admin/sync" element={
              <ProtectedRoute roles={["admin"]}><AdminSync /></ProtectedRoute>
            } />
            <Route path="/portail/admin/exports" element={
              <ProtectedRoute roles={["admin"]}><AdminExports /></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </div>
  );
}

export default App;
