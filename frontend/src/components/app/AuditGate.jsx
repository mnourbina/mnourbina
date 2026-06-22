import React, { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AlertTriangle, Lock } from "lucide-react";

/**
 * Bloque l'utilisateur soignant tant qu'un décès en attente d'audit n'est pas complété.
 * Reproduit l'effet du middleware Next.js MSP : redirection forcée vers /app/soignant/audit/{id}.
 */
export default function AuditGate({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(null);

  const refresh = useCallback(() => {
    if (!user || user.role === "patient") {
      setPending(null);
      return;
    }
    api.get("/auth/pending-audit").then(r => setPending(r.data.pending)).catch(() => {});
  }, [user]);

  useEffect(() => { refresh(); }, [refresh, location.pathname]);

  useEffect(() => {
    if (pending && !location.pathname.includes(`/audit/${pending.id}`)) {
      navigate(`/app/soignant/audit/${pending.id}`, { replace: true });
    }
  }, [pending, location.pathname, navigate]);

  if (pending && !location.pathname.includes(`/audit/${pending.id}`)) {
    return (
      <div className="fixed inset-0 bg-[#3E2723]/80 backdrop-blur z-50 flex items-center justify-center p-6" data-testid="audit-gate-overlay">
        <div className="bg-white rounded-2xl max-w-md p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#B83A2E]/15 flex items-center justify-center text-[#B83A2E]">
            <Lock size={26} />
          </div>
          <h2 className="font-heading text-2xl font-semibold text-[#3E2723] mt-4">Audit MPDSR obligatoire</h2>
          <p className="mt-3 text-[#795C55]">
            Une déclaration de décès {pending.death_type} attend d'être auditée. Vous devez compléter l'audit avant toute autre action.
          </p>
          <AlertTriangle className="mx-auto mt-4 text-[#B83A2E]" size={20} />
        </div>
      </div>
    );
  }

  return children;
}
