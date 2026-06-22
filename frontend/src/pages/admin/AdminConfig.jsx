import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Settings, MapPin, Building2, Plus, Loader2, Globe2 } from "lucide-react";

export default function AdminConfig() {
  const [regions, setRegions] = useState([]);
  const [zones, setZones] = useState([]);
  const [structures, setStructures] = useState([]);
  const [newRegion, setNewRegion] = useState({ name: "", country: "Tchad", dhis2_org_unit_uid: "" });
  const [newZone, setNewZone] = useState({ name: "", region: "", region_id: "", country: "Tchad" });
  const [newStruct, setNewStruct] = useState({ name: "", zone_id: "", type: "centre_sante" });
  const [loading, setLoading] = useState(false);

  const reload = () => {
    api.get("/regions").then(r => setRegions(r.data));
    api.get("/zones").then(r => setZones(r.data));
    api.get("/structures").then(r => setStructures(r.data));
  };
  useEffect(() => { reload(); }, []);

  const createRegion = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...newRegion };
      if (!payload.dhis2_org_unit_uid) delete payload.dhis2_org_unit_uid;
      await api.post("/regions", payload);
      toast.success("Région créée");
      setNewRegion({ name: "", country: "Tchad", dhis2_org_unit_uid: "" });
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  const createZone = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...newZone };
      if (!payload.region_id) delete payload.region_id;
      await api.post("/zones", payload);
      toast.success("District créé");
      setNewZone({ name: "", region: "", region_id: "", country: "Tchad" });
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  const createStruct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/structures", newStruct);
      toast.success("Structure créée");
      setNewStruct({ name: "", zone_id: "", type: "centre_sante" });
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-8" data-testid="admin-config">
      <header>
        <h1 className="font-heading text-3xl font-semibold text-[#3E2723] flex items-center gap-3">
          <Settings className="text-[#C85A48]" size={28} /> Configuration
        </h1>
        <p className="mt-2 text-[#795C55]">
          Hiérarchie sanitaire : <strong>Région → District → Structure</strong>. Configurez les UID DHIS2 pour activer l&apos;export vers le SIS national.
        </p>
      </header>

      <section className="bg-white rounded-2xl p-6 border border-[#3E2723]/5" data-testid="section-regions">
        <h3 className="font-heading text-lg font-semibold text-[#3E2723] flex items-center gap-2 mb-4">
          <Globe2 size={18} className="text-[#C85A48]" /> Régions sanitaires
        </h3>
        <form onSubmit={createRegion} className="grid sm:grid-cols-4 gap-2 mb-5" data-testid="new-region-form">
          <Input required value={newRegion.name} onChange={e => setNewRegion({...newRegion, name: e.target.value})} placeholder="Nom de la région" className="h-11 rounded-xl sm:col-span-2" data-testid="new-region-name"/>
          <Input value={newRegion.dhis2_org_unit_uid} onChange={e => setNewRegion({...newRegion, dhis2_org_unit_uid: e.target.value})} placeholder="UID DHIS2" className="h-11 rounded-xl" data-testid="new-region-uid"/>
          <Button type="submit" disabled={loading} className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl h-11" data-testid="new-region-submit">
            {loading ? <Loader2 className="animate-spin" size={16}/> : <><Plus size={16}/> Créer</>}
          </Button>
        </form>
        <ul className="divide-y divide-[#3E2723]/5">
          {regions.map(r => <RegionRow key={r.id} r={r} onUpdate={reload}/>)}
        </ul>
        {regions.length === 0 && <div className="text-sm text-[#795C55]">Aucune région.</div>}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <h3 className="font-heading text-lg font-semibold text-[#3E2723] flex items-center gap-2 mb-4">
            <MapPin size={18} className="text-[#C85A48]" /> Districts sanitaires
            <span className="text-xs text-[#795C55] font-normal">(zones)</span>
          </h3>
          <form onSubmit={createZone} className="space-y-3 mb-5" data-testid="new-zone-form">
            <Input required value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} placeholder="Nom du district" className="h-11 rounded-xl" />
            <Select required value={newZone.region_id || ""} onValueChange={(v) => {
              const r = regions.find(x => x.id === v);
              setNewZone({...newZone, region_id: v, region: r?.name || newZone.region});
            }}>
              <SelectTrigger className="h-11 rounded-xl" data-testid="new-zone-region"><SelectValue placeholder="Région rattachée"/></SelectTrigger>
              <SelectContent>
                {regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={loading} className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl w-full" data-testid="new-zone-submit">
              {loading ? <Loader2 className="animate-spin" /> : <><Plus size={16}/> Créer le district</>}
            </Button>
          </form>
          <ul className="divide-y divide-[#3E2723]/5">
            {zones.map(z => <ZoneRow key={z.id} z={z} regions={regions} onUpdate={reload} />)}
          </ul>
        </section>

        <section className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <h3 className="font-heading text-lg font-semibold text-[#3E2723] flex items-center gap-2 mb-4">
            <Building2 size={18} className="text-[#C85A48]" /> Structures de soins
          </h3>
          <form onSubmit={createStruct} className="space-y-3 mb-5" data-testid="new-struct-form">
            <Input required value={newStruct.name} onChange={e => setNewStruct({...newStruct, name: e.target.value})} placeholder="Nom de la structure" className="h-11 rounded-xl" />
            <Select required value={newStruct.zone_id} onValueChange={(v) => setNewStruct({...newStruct, zone_id: v})}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="District rattaché" /></SelectTrigger>
              <SelectContent>{zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={newStruct.type} onValueChange={(v) => setNewStruct({...newStruct, type: v})}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hopital">Hôpital</SelectItem>
                <SelectItem value="centre_sante">Centre de santé</SelectItem>
                <SelectItem value="clinique">Clinique</SelectItem>
                <SelectItem value="case_sante">Case de santé</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={loading} className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl w-full" data-testid="new-struct-submit">
              {loading ? <Loader2 className="animate-spin" /> : <><Plus size={16}/> Créer la structure</>}
            </Button>
          </form>
          <ul className="divide-y divide-[#3E2723]/5 max-h-96 overflow-y-auto">
            {structures.map(s => (
              <li key={s.id} className="py-3" data-testid={`struct-row-${s.id}`}>
                <div className="font-medium text-[#3E2723]">{s.name}</div>
                <div className="text-xs text-[#795C55] capitalize">
                  {s.type.replace("_", " ")}
                  {s.dhis2_org_unit_uid && <> · UID DHIS2 <code className="bg-[#F7F3EB] px-1 rounded">{s.dhis2_org_unit_uid}</code></>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function RegionRow({ r, onUpdate }) {
  const [name, setName] = useState(r.name);
  const [uid, setUid] = useState(r.dhis2_org_unit_uid || "");
  const [saving, setSaving] = useState(false);
  const dirty = name !== r.name || (uid || "") !== (r.dhis2_org_unit_uid || "");
  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await api.patch(`/regions/${r.id}`, { name, dhis2_org_unit_uid: uid || null });
      toast.success("Région mise à jour");
      onUpdate?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };
  return (
    <li className="py-3 grid sm:grid-cols-4 gap-2 items-center" data-testid={`region-row-${r.id}`}>
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded-lg text-sm sm:col-span-2" data-testid={`region-name-${r.id}`}/>
      <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="UID DHIS2 (org unit)" className="h-9 rounded-lg text-xs" data-testid={`region-uid-${r.id}`}/>
      <Button type="button" onClick={save} disabled={saving || !dirty} className="h-9 rounded-lg text-xs bg-[#3E2723] hover:bg-[#2a1c1a] disabled:opacity-40" data-testid={`region-save-${r.id}`}>
        {saving ? <Loader2 size={12} className="animate-spin"/> : "Enregistrer"}
      </Button>
    </li>
  );
}

function ZoneRow({ z, regions, onUpdate }) {
  const [uid, setUid] = useState(z.dhis2_org_unit_uid || "");
  const [saving, setSaving] = useState(false);
  const region = regions.find(r => r.id === z.region_id);
  const save = async () => {
    if ((z.dhis2_org_unit_uid || "") === uid) return;
    setSaving(true);
    try {
      await api.patch(`/zones/${z.id}`, { dhis2_org_unit_uid: uid || null });
      toast.success("UID DHIS2 mis à jour");
      onUpdate?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };
  return (
    <li className="py-3 space-y-2" data-testid={`zone-row-${z.id}`}>
      <div>
        <div className="font-medium text-[#3E2723]">{z.name}</div>
        <div className="text-sm text-[#795C55]">
          {(region?.name || z.region) || "—"} · {z.country}
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="UID DHIS2 (org unit)" className="h-9 rounded-lg text-xs flex-1" data-testid={`zone-dhis2-uid-${z.id}`}/>
        <Button type="button" onClick={save} disabled={saving} className="h-9 px-3 rounded-lg text-xs bg-[#3E2723] hover:bg-[#2a1c1a]" data-testid={`zone-dhis2-save-${z.id}`}>
          {saving ? <Loader2 size={12} className="animate-spin"/> : "Enregistrer"}
        </Button>
      </div>
    </li>
  );
}
