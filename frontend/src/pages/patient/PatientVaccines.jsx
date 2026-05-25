import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import VaccineTimeline from "@/components/VaccineTimeline";

const NAV = [
  { to: "/portail/patiente", label: "Accueil", end: true },
  { to: "/portail/patiente/vaccins", label: "Vaccins" },
];

export default function PatientVaccines() {
  const { user } = useAuth();
  const [doses, setDoses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.patient_id) { setLoading(false); return; }
    api.get(`/vaccines?patient_id=${user.patient_id}`).then(r => setDoses(r.data)).finally(() => setLoading(false));
  }, [user]);

  return (
    <Layout title="Calendrier vaccinal" nav={NAV}>
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">Mon calendrier vaccinal</h1>
        <p className="text-muted-foreground mt-2">Suivez les doses prevues pour vous (et pour votre bebe apres la naissance).</p>
      </div>
      <div className="bg-white border border-border rounded-2xl p-6 max-w-3xl">
        {loading ? <p className="text-muted-foreground">Chargement...</p> : <VaccineTimeline doses={doses} />}
      </div>
    </Layout>
  );
}
