import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Settings, MapPin, Building2, Plus, Loader2 } from "lucide-react";

export default function AdminConfig() {
  const [zones, setZones] = useState([]);
  const [structures, setStructures] = useState([]);
  const [newZone, setNewZone] = useState({ name: "", region: "", country: "Tchad" });
  const [newStruct, setNewStruct] = useState({ name: "", zone_id: "", type: "centre_sante" });
  const [loading, setLoading] = useState(false);

  const reload = () => {
    api.get("/zones").then(r => setZones(r.data));
    api.get("/structures").then(r => setStructures(r.data));
  };
  useEffect(() => { reload(); }, []);

  const createZone = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/zones", newZone);
      toast.success("Zone créée");
      setNewZone({ name: "", region: "", country: "Tchad" });
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
        <p className="mt-2 text-[#795C55]">Gérez les zones sanitaires et les structures de soins.</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <h3 className="font-heading text-lg font-semibold text-[#3E2723] flex items-center gap-2 mb-4">
            <MapPin size={18} className="text-[#C85A48]" /> Zones sanitaires
          </h3>
          <form onSubmit={createZone} className="space-y-3 mb-5" data-testid="new-zone-form">
            <Input required value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} placeholder="Nom de la zone" className="h-11 rounded-xl" />
            <Input required value={newZone.region} onChange={e => setNewZone({...newZone, region: e.target.value})} placeholder="Région" className="h-11 rounded-xl" />
            <Button type="submit" disabled={loading} className="bg-[#C85A48] hover:bg-[#B34D3D] text-white rounded-xl w-full" data-testid="new-zone-submit">
              {loading ? <Loader2 className="animate-spin" /> : <><Plus size={16}/> Créer la zone</>}
            </Button>
          </form>
          <ul className="divide-y divide-[#3E2723]/5">
            {zones.map(z => (
              <li key={z.id} className="py-3">
                <div className="font-medium text-[#3E2723]">{z.name}</div>
                <div className="text-sm text-[#795C55]">{z.region} · {z.country}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-2xl p-6 border border-[#3E2723]/5">
          <h3 className="font-heading text-lg font-semibold text-[#3E2723] flex items-center gap-2 mb-4">
            <Building2 size={18} className="text-[#C85A48]" /> Structures de soins
          </h3>
          <form onSubmit={createStruct} className="space-y-3 mb-5" data-testid="new-struct-form">
            <Input required value={newStruct.name} onChange={e => setNewStruct({...newStruct, name: e.target.value})} placeholder="Nom de la structure" className="h-11 rounded-xl" />
            <Select required value={newStruct.zone_id} onValueChange={(v) => setNewStruct({...newStruct, zone_id: v})}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Zone rattachée" /></SelectTrigger>
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
              <li key={s.id} className="py-3">
                <div className="font-medium text-[#3E2723]">{s.name}</div>
                <div className="text-sm text-[#795C55] capitalize">{s.type.replace("_", " ")}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
