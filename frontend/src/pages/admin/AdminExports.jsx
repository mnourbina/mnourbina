import React from "react";
import Layout from "@/components/Layout";
import { API } from "@/lib/api";
import { Download, FileSpreadsheet } from "lucide-react";

const NAV = [
  { to: "/portail/admin", label: "Tableau de bord", end: true },
  { to: "/portail/admin/mpdsr", label: "Audits MPDSR" },
  { to: "/portail/admin/sync", label: "Synchronisation" },
  { to: "/portail/admin/utilisateurs", label: "Utilisateurs" },
  { to: "/portail/admin/exports", label: "Exports" },
];

const EXPORTS = [
  { key: "patients", label: "Patientes", desc: "Liste des patientes (identite, district, parite, score de risque)." },
  { key: "pregnancies", label: "Grossesses", desc: "Toutes les grossesses (DDR, DPA, statut, risque)." },
  { key: "cpn", label: "Contacts CPN", desc: "Contacts prenataux (poids, TA, hemoglobine, decision, alertes)." },
];

export default function AdminExports() {
  const download = async (key) => {
    const token = localStorage.getItem("khalaba_token");
    const res = await fetch(`${API}/admin/export/${key}.csv`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      alert("Erreur lors de l'export");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `khalaba_${key}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout title="Exports" nav={NAV}>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">Exports de donnees</h1>
        <p className="text-muted-foreground mt-1">Telechargez les donnees au format CSV pour exploitation (DHIS2, analyses, rapports MSPP).</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {EXPORTS.map(e => (
          <div key={e.key} className="bg-white border border-border rounded-xl p-5" data-testid={`export-card-${e.key}`}>
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 text-primary mb-4"><FileSpreadsheet size={20} /></span>
            <h3 className="font-display text-lg font-bold text-foreground">{e.label}</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">{e.desc}</p>
            <button onClick={() => download(e.key)} data-testid={`export-btn-${e.key}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90">
              <Download size={16} /> Telecharger CSV
            </button>
          </div>
        ))}
      </div>
    </Layout>
  );
}
