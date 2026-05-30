import React, { useState, useEffect } from "react";
import {
  Database,
  Sparkles,
  Plus,
  Trash2,
  Settings,
  Code,
  Copy,
  Check,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Phone,
  Eye,
  Info,
  DollarSign,
  Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import AddClientModal from "./components/AddClientModal";
import EditClientModal from "./components/EditClientModal";
import { ClientData, ClientRecord, ConfigPrice, DEFAULT_CONFIG_PRICES, StaffMember, DEFAULT_STAFF_MEMBERS } from "./types";
import { Upload, UserPlus } from "lucide-react";

export default function App() {
  // Active Navigation Tab: "clients" | "prices"
  const [activeTab, setActiveTab] = useState<"clients" | "prices">("clients");

  // CONFIG_DB Pricing state - loaded from localStorage or defaults
  const [configPrices, setConfigPrices] = useState<ConfigPrice[]>(() => {
    const saved = localStorage.getItem("visa_config_db");
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG_PRICES;
  });

  // Dynamic staffing directory state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => {
    const saved = localStorage.getItem("visa_staff_db");
    return saved ? JSON.parse(saved) : DEFAULT_STAFF_MEMBERS;
  });

  // New staff member creation states
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffAvatar, setNewStaffAvatar] = useState<string | null>(null);

  // Client registry list database rows - loaded from localStorage initially, then synced from Supabase
  const [clientRecords, setClientRecords] = useState<ClientRecord[]>(() => {
    const saved = localStorage.getItem("visa_clients_db");
    return saved ? JSON.parse(saved) : [];
  });

  // Dialog Stepper modal visibility toggles
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Edit Profile modal toggles and selection state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ClientRecord | null>(null);

  // Expanded row details to view code snippets / payloads for a specific record
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Direct notifications toast
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  // Sync state changes with local storage
  useEffect(() => {
    localStorage.setItem("visa_config_db", JSON.stringify(configPrices));
  }, [configPrices]);

  useEffect(() => {
    localStorage.setItem("visa_clients_db", JSON.stringify(clientRecords));
  }, [clientRecords]);

  useEffect(() => {
    localStorage.setItem("visa_staff_db", JSON.stringify(staffMembers));
  }, [staffMembers]);

  // Load clients and staff from Supabase on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsRes, staffRes] = await Promise.all([
          fetch("/api/clients"),
          fetch("/api/staff"),
        ]);

        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          if (clientsData.success && Array.isArray(clientsData.clients) && clientsData.clients.length > 0) {
            const mapped: ClientRecord[] = clientsData.clients.map((c: any, i: number) => ({
              id: "rec_" + (c.id || i),
              last_name: c.last_name || null,
              first_name: c.first_name || null,
              passport_number: c.passport_number || null,
              dob: c.dob || null,
              issue_date: c.issue_date || null,
              expiry_date: c.expiry_date || null,
              place_of_issue: c.place_of_issue || null,
              previous_visa_number: c.previous_visa_number || null,
              visa_from: c.visa_from || null,
              visa_to: c.visa_to || null,
              phone_number: c.phone_number || null,
              client_pic: c.photo_url || null,
              visa_pic: c.photo_url_1 || null,
              category: c.category || "",
              payment: c.payment || { category: "", price: "0", currency: "M" },
              staff_member: c.staff_member || "",
              account_email: c.account_email || "taw3na@mkservice.com",
              user_id: c.user_id,
              created_at: c.created_at || new Date().toISOString(),
            }));
            setClientRecords(mapped);
          }
        }

        if (staffRes.ok) {
          const staffData = await staffRes.json();
          if (staffData.success && Array.isArray(staffData.staff) && staffData.staff.length > 0) {
            const mapped: StaffMember[] = staffData.staff.map((s: any) => ({
              id: s.staff_id,
              name: s.name,
              avatarUrl: s.avatar_url || null,
            }));
            setStaffMembers(mapped);
          }
        }
      } catch (err) {
        console.warn("Could not load from Supabase, using local data:", err);
      }
    };
    fetchData();
  }, []);

  // Toast notifier
  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Sync staff member to Supabase
  const syncStaffToSupabase = async (staff_id: string, data: { name?: string; avatar_url?: string | null }) => {
    try {
      await fetch(`/api/staff/${encodeURIComponent(staff_id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.warn("Failed to sync staff update to Supabase:", err);
    }
  };

  const deleteStaffFromSupabase = async (staff_id: string) => {
    try {
      await fetch(`/api/staff/${encodeURIComponent(staff_id)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("Failed to sync staff deletion to Supabase:", err);
    }
  };

  // Pricing configuration inline updates
  const updateConfigPrice = (catName: string, newRate: string) => {
    setConfigPrices((prev) =>
      prev.map((p) => (p.category === catName ? { ...p, price: newRate } : p))
    );
    showToast(`Pricing updated: ${catName} set to ${newRate}M`);
  };

  // Add the saved client to registry and dispatch live Supabase proxy push
  const handleSaveAndSyncClient = async (clientData: ClientData): Promise<{ success: boolean; simulated: boolean; message: string }> => {
    // 1. Locally save profile in reactive state immediately
    const newRecord: ClientRecord = {
      ...clientData,
      id: "rec_" + Date.now().toString(36),
      created_at: new Date().toISOString(),
    };

    setClientRecords((prev) => [newRecord, ...prev]);

    // 2. Dispatch real POST push to server proxy `/api/push-to-supabase` to attempt Supabase storage sync
    try {
      const response = await fetch("/api/push-to-supabase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientData),
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: result.success === undefined ? true : result.success,
          simulated: result.simulated ?? false,
          message: result.message || "Synchronized seamlessly to Supabase active clients database."
        };
      } else {
        let serverErrorMsg = "";
        try {
          const errObj = await response.json();
          serverErrorMsg = errObj.error || errObj.message;
        } catch (_) {}
        throw new Error(serverErrorMsg || `Server returned error status ${response.status}`);
      }
    } catch (err: any) {
      console.warn("Offline fallback or server error during Supabase sync:", err);
      // If it failed due to a server error, we show the actual error message
      return {
        success: false,
        simulated: false,
        message: err.message || "No live variables configured currently. Locally saved profile and prepared integration queries."
      };
    }
  };

  // Launch editing modal for active record
  const handleStartEditClient = (record: ClientRecord) => {
    setEditingRecord(record);
    setIsEditModalOpen(true);
  };

  // Update existing client attributes in local state & database
  const handleUpdateAndSyncClient = async (
    id: string,
    updatedFields: Partial<ClientRecord>
  ): Promise<{ success: boolean; simulated: boolean; message: string; error?: string }> => {
    const originalRecord = clientRecords.find((r) => r.id === id);
    if (!originalRecord) {
      return { success: false, simulated: false, message: "Registry record was not found.", error: "Record not found." };
    }

    const original_passport_number = originalRecord.passport_number;

    // Merge new updates onto our local state representation
    const mergedRecord: ClientRecord = {
      ...originalRecord,
      ...updatedFields,
    };

    // Strip client records internal properties to formulate pure ClientData payload
    const { id: _, created_at: __, ...clientData } = mergedRecord;

    // 1. Instantly update reactive local storage state
    setClientRecords((prev) => prev.map((r) => (r.id === id ? mergedRecord : r)));

    // 2. Dispatch the update PATCH forwarder proxy to propagate down to Supabase DB live schema
    try {
      const response = await fetch("/api/update-in-supabase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_passport_number,
          clientData
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: result.success === undefined ? true : result.success,
          simulated: result.simulated ?? false,
          message: result.message || "Updated profile successfully and propagated down to database."
        };
      } else {
        let serverErrorMsg = "";
        try {
          const errObj = await response.json();
          serverErrorMsg = errObj.error || errObj.message;
        } catch (_) {}
        throw new Error(serverErrorMsg || `Server returned error status ${response.status}`);
      }
    } catch (err: any) {
      console.warn("Offline fallback or server error during Supabase update sync:", err);
      return {
        // Safe graceful fallback
        success: true,
        simulated: true,
        message: err.message || "Profile details updated locally."
      };
    }
  };

  // Remove registered rows locally and propagate to Supabase
  const handleDeleteClient = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetedRecord = clientRecords.find((r) => r.id === id);
    if (!targetedRecord) return;

    setClientRecords((prev) => prev.filter((r) => r.id !== id));
    showToast("Profile row removed from local registry session.");

    if (targetedRecord.passport_number) {
      try {
        const response = await fetch("/api/delete-from-supabase", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passport_number: targetedRecord.passport_number }),
        });
        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            console.log(`[Supabase Delete Sync] Removed client with passport ${targetedRecord.passport_number} successfully.`);
            showToast("Successfully deleted and synced to remote instances.");
          } else if (resJson.simulated) {
            console.log("[Supabase Delete Sync] Credentials absent. Offline/Local simulation mode.");
          }
        }
      } catch (err: any) {
        console.error("Error syncing deletion to Supabase:", err);
      }
    }
  };

  // Clipboard copy utils
  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
    showToast(`${label} snippet copied to clipboard!`);
  };

  // Dynamic code generators for clipboard review
  const getExpectedJsonPayload = (rec: ClientRecord) => {
    return JSON.stringify(
      {
        client_data: {
          last_name: rec.last_name,
          first_name: rec.first_name,
          passport_number: rec.passport_number,
          dob: rec.dob,
          issue_date: rec.issue_date,
          expiry_date: rec.expiry_date,
          place_of_issue: rec.place_of_issue,
          previous_visa_number: rec.previous_visa_number,
          visa_from: rec.visa_from,
          visa_to: rec.visa_to,
          phone_number: rec.phone_number,
          client_pic: rec.client_pic ? `${rec.client_pic.slice(0, 50)}... [Base64]` : null,
          category: rec.category,
          payment: rec.payment,
          staff_member: rec.staff_member,
          migrated_to_other_supabase: "https://mk-clients.vercel.app/"
        },
      },
      null,
      2
    );
  };

  const getSupabaseCodeSnippet = (rec: ClientRecord) => {
    const rawPayload = {
      last_name: rec.last_name,
      first_name: rec.first_name,
      passport_number: rec.passport_number,
      dob: rec.dob,
      issue_date: rec.issue_date,
      expiry_date: rec.expiry_date,
      place_of_issue: rec.place_of_issue,
      previous_visa_number: rec.previous_visa_number,
      visa_from: rec.visa_from,
      visa_to: rec.visa_to,
      phone_number: rec.phone_number,
      client_pic: rec.client_pic ? "[base64_string]" : null,
      visa_pic: rec.visa_pic ? "[base64_string]" : null,
      category: rec.category,
      payment: rec.payment,
      staff_member: rec.staff_member,
    };

    return `// Insertion command matching the Vercel Supabase destination tables
const { data, error } = await supabase
  .from('clients')
  .insert([
    ${JSON.stringify(rawPayload, null, 4).replace(/\n/g, "\n    ")}
  ]);`;
  };

  const getSqlStringSnippet = (rec: ClientRecord) => {
    const cols = [
      "last_name",
      "first_name",
      "passport_number",
      "dob",
      "issue_date",
      "expiry_date",
      "place_of_issue",
      "previous_visa_number",
      "visa_from",
      "visa_to",
      "phone_number",
      "category",
      "payment_price",
      "staff_member",
    ];

    const vals = [
      rec.last_name ? `'${rec.last_name.replace(/'/g, "''")}'` : "NULL",
      rec.first_name ? `'${rec.first_name.replace(/'/g, "''")}'` : "NULL",
      rec.passport_number ? `'${rec.passport_number}'` : "NULL",
      rec.dob ? `'${rec.dob}'` : "NULL",
      rec.issue_date ? `'${rec.issue_date}'` : "NULL",
      rec.expiry_date ? `'${rec.expiry_date}'` : "NULL",
      rec.place_of_issue ? `'${rec.place_of_issue.replace(/'/g, "''")}'` : "NULL",
      rec.previous_visa_number ? `'${rec.previous_visa_number}'` : "NULL",
      rec.visa_from ? `'${rec.visa_from}'` : "NULL",
      rec.visa_to ? `'${rec.visa_to}'` : "NULL",
      rec.phone_number ? `'${rec.phone_number}'` : "NULL",
      `'${rec.category}'`,
      `'${rec.payment.price}'`,
      `'${rec.staff_member}'`
    ];

    return `INSERT INTO clients (\n  ${cols.join(",\n  ")}\n)\nVALUES (\n  ${vals.join(",\n  ")}\n);`;
  };

  // Filter records to show only those belonging to the active account
  const filteredRecords = clientRecords.filter(r => r.account_email === "taw3na@mkservice.com");

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-200 font-sans pb-16" id="app-root-container">
      
      {/* Elegantly Polished Navbar styled header */}
      <header className="bg-[#0f172a] border-b border-slate-800 shadow-lg relative overflow-hidden" id="main-header">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-500"></div>
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          {/* Logo & Headline */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-650 flex items-center justify-center shadow-lg shadow-indigo-650/20">
              <span className="text-white font-black text-xl font-sans">T</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white">
                  Taw3na
                </h1>
                <span className="bg-emerald-950/40 border border-emerald-900/50 text-[10px] text-emerald-400 font-mono font-bold px-2 py-0.5 rounded-full">
                  Realtime Sync
                </span>
              </div>
              <p className="text-xs text-slate-450 mt-0.5">
                Register application credentials and push queries to Supabase clients database
              </p>
            </div>
          </div>

          {/* Configuration & Action Tabs Bar */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("clients")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === "clients"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Clients Registry
            </button>
            <button
              onClick={() => setActiveTab("prices")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                activeTab === "prices"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Service Pricing
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8" id="client-workspace-grid">
        
        {/* TABS 1: CLIENTS REGISTRY */}
        {activeTab === "clients" && (
          <div className="flex flex-col gap-6 animate-fade-in">
            
            {/* Action Bar with the main visual "+" trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#0f172a] p-5 rounded-2xl border border-slate-800 shadow-lg">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-4.5 h-4.5 text-indigo-400" />
                  Active Client Applications
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing profiles registered under official representatives: Barry, Mostapha, and Youcef.
                </p>
              </div>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-650/10 transition"
                id="btn-open-add-wizard"
              >
                <Plus className="w-4 h-4" />
                Add New Client
              </button>
            </div>

            {/* Registered Clients Table display */}
            <div className="bg-[#0f172a] rounded-2xl shadow-lg border border-slate-800 overflow-hidden" id="clients-db-table">
              
              {filteredRecords.length === 0 ? (
                <div className="text-center py-20 text-slate-300">
                  <Database className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-100">Registry Is Dry</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    No active clients registered. Click "+ Add New Client" to start guided camera snaps and Gemini ocr processing!
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 text-xs font-bold rounded-xl border border-indigo-800/50 transition"
                  >
                    Launch Add Wizard
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop view: table structure */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#111a2e] text-slate-400 border-b border-slate-800 uppercase font-mono text-[9px] tracking-wider font-bold">
                        <tr>
                          <th className="p-4 w-[10%]">Pic</th>
                          <th className="p-4 w-[24%]">Full Name</th>
                          <th className="p-4 w-[16%]">Phone Number</th>
                          <th className="p-4 w-[14%]">Category</th>
                          <th className="p-4 w-[11%]">Versment</th>
                          <th className="p-4 w-[15%]">Rest</th>
                          <th className="p-4 text-center w-[10%]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filteredRecords.map((rec) => {
                          // Parse numbers for the math
                          const priceValue = parseFloat(rec.payment?.price || "0");
                          const versmentValue = parseFloat(rec.payment?.versment || "0");
                          const restValue = Math.max(0, priceValue - versmentValue);

                          return (
                            <React.Fragment key={rec.id}>
                              <tr 
                                className="hover:bg-[#111a2e]/30 transition border-b border-slate-800"
                              >
                                {/* Portrait Pic */}
                                <td className="p-4">
                                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                                    {rec.client_pic ? (
                                      <img
                                        src={rec.client_pic}
                                        alt="Client Portrait Face"
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <User className="w-5 h-5 text-slate-500" />
                                    )}
                                  </div>
                                </td>

                                {/* Full Name display */}
                                <td className="p-4">
                                  <div>
                                    <div className="font-extrabold text-white text-sm">
                                      {rec.last_name || "—"} {rec.first_name || "—"}
                                    </div>
                                    <div className="text-[10px] text-slate-300 flex flex-wrap items-center gap-1.5 mt-0.5 leading-none">
                                      <span className="font-mono bg-[#111a2e] border border-slate-850 px-1.5 py-0.5 rounded text-slate-300">Pass: {rec.passport_number || "PENDING"}</span>
                                      <span>•</span>
                                      <span>DOB: {rec.dob || "—"}</span>
                                      <span>•</span>
                                      <span className="text-indigo-300 font-bold bg-indigo-950/40 border border-indigo-900/30 px-1.5 py-0.5 rounded">Staff: {rec.staff_member || "—"}</span>
                                    </div>
                                  </div>
                                </td>

                                {/* Phone Number */}
                                <td className="p-4">
                                  <div className="flex items-center gap-1.5 text-slate-200">
                                    <Phone className="w-3.5 h-3.5 text-indigo-400" />
                                    <span className="font-bold">{rec.phone_number || "Not Provided"}</span>
                                  </div>
                                </td>

                                {/* Category & Rated Price */}
                                <td className="p-4">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/40 border border-indigo-900/50 font-extrabold font-mono text-xs text-indigo-300">
                                    {rec.category} ({rec.payment?.price || "16"}M)
                                  </span>
                                </td>

                                {/* Paid Versment */}
                                <td className="p-4">
                                  <span className="font-mono font-extrabold text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2.5 py-1 rounded-lg">
                                    {rec.payment?.versment || "0"}M
                                  </span>
                                </td>

                                {/* Calculation: Rest = Category - Versment */}
                                <td className="p-4">
                                  <span className={`font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg ${
                                    restValue > 0
                                      ? "text-rose-400 bg-rose-950/40 border border-rose-900/50"
                                      : "text-emerald-400 bg-emerald-950/40 border border-emerald-900/50"
                                  }`}>
                                    {restValue}M
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="p-4 text-center">
                                  <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => handleStartEditClient(rec)}
                                      className="p-1.5 px-2.5 bg-indigo-950/45 hover:bg-indigo-900/45 text-indigo-300 border border-indigo-900/50 rounded-lg transition flex items-center justify-center cursor-pointer"
                                      title="Edit client profile"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => handleDeleteClient(rec.id, e)}
                                      className="p-1.5 px-[10px] bg-rose-950/45 hover:bg-rose-900/45 text-rose-400 hover:text-rose-300 border border-rose-900/50 rounded-lg transition flex items-center justify-center cursor-pointer"
                                      title="Delete row"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile responsive view: clean simple cards */}
                  <div className="block md:hidden divide-y divide-slate-800">
                    {filteredRecords.map((rec) => {
                      const priceValue = parseFloat(rec.payment?.price || "0");
                      const versmentValue = parseFloat(rec.payment?.versment || "0");
                      const restValue = Math.max(0, priceValue - versmentValue);

                      return (
                        <div 
                          key={rec.id} 
                          className="p-4 flex flex-col gap-3 hover:bg-[#111a2e]/20 transition"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-850 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                              {rec.client_pic ? (
                                <img
                                  src={rec.client_pic}
                                  alt="Portrait"
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <User className="w-5 h-5 text-slate-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-extrabold text-white text-sm truncate">
                                {rec.last_name || "—"} {rec.first_name || "—"}
                              </div>
                              <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5 leading-none">
                                <span className="font-mono bg-[#111a2e] border border-slate-850 px-1 py-0.5 rounded text-slate-300 font-semibold font-mono">Pass: {rec.passport_number || "PENDING"}</span>
                                <span>•</span>
                                <span className="font-mono">DOB: {rec.dob || "—"}</span>
                              </div>
                              {rec.phone_number && (
                                <div className="text-[11px] text-slate-350 flex items-center gap-1 mt-1.5">
                                  <Phone className="w-3 h-3 text-indigo-400 shrink-0" />
                                  <span className="font-bold font-mono">{rec.phone_number}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <span className="text-[9px] font-bold text-indigo-300 bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.25 rounded">
                                {rec.staff_member || "—"}
                              </span>
                            </div>
                          </div>

                          {/* Stats block - optimized with adaptive min-width grid stacking */}
                          <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2 bg-[#131d35]/65 p-2.5 rounded-xl border border-slate-800/45 text-center">
                            <div className="py-1 min-[380px]:py-0">
                              <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 font-mono">Category</div>
                              <div className="font-mono font-extrabold text-[11px] text-indigo-300 truncate">
                                {rec.category} ({rec.payment?.price || "16"}M)
                              </div>
                            </div>
                            <div className="py-1 min-[380px]:py-0 border-t min-[380px]:border-t-0 min-[380px]:border-x border-slate-850">
                              <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 font-mono">Paid</div>
                              <div className="font-mono font-extrabold text-[11px] text-emerald-400 truncate">
                                {rec.payment?.versment || "0"}M
                              </div>
                            </div>
                            <div className="py-1 min-[380px]:py-0 border-t min-[380px]:border-t-0 border-slate-850">
                              <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 font-mono">Rest</div>
                              <div className={`font-mono font-extrabold text-[11px] truncate ${restValue > 0 ? "text-rose-450" : "text-emerald-400"}`}>
                                {restValue}M
                              </div>
                            </div>
                          </div>

                          {/* Mobile Actions block */}
                          <div className="flex items-center justify-between border-t border-slate-850 pt-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[9px] text-slate-500 font-mono font-semibold">
                              {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : "—"}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleStartEditClient(rec)}
                                className="p-1.5 px-2.5 bg-indigo-950/50 border border-indigo-900/50 hover:bg-indigo-900/30 text-indigo-300 rounded-lg transition flex items-center gap-1 font-bold text-[10px] cursor-pointer"
                                title="Edit Profile"
                              >
                                <Pencil className="w-3.5 h-3.5 shrink-0 text-indigo-400" /> Edit
                              </button>
                              <button
                                onClick={(e) => handleDeleteClient(rec.id, e)}
                                className="p-1.5 px-3 bg-rose-950/50 border border-rose-900/50 hover:bg-rose-900/30 text-rose-300 rounded-lg transition flex items-center gap-1 font-bold text-[10px] cursor-pointer"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0 text-rose-400" /> Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TABS 2: SERVICE PRICING CONFIGURATION DB */}
        {activeTab === "prices" && (
          <div className="flex flex-col gap-6 animate-fade-in">
            
            {/* Header info card */}
            <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="p-1 px-[5px] bg-indigo-950/40 border border-indigo-900/30 rounded-lg"><Settings className="w-4 h-4 text-indigo-400" /></span>
                  Prices and Service Rate configurations
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set standard cost matrices (M) for each category. Changing prices here applies dynamically to all future applicant invoices!
                </p>
              </div>
              <div className="text-xs font-semibold px-3 py-1.5 bg-indigo-950/45 border border-indigo-900/50 text-indigo-300 rounded-lg shrink-0">
                Active Category Count: {configPrices.length}
              </div>
            </div>

            {/* Price Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="config-db-card">
              {configPrices.map((cp) => (
                <div key={cp.id} className="bg-[#0f172a] rounded-xl border border-slate-800 p-5 shadow-md flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-indigo-300 text-sm bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/50">
                        {cp.category}
                      </span>
                      <p className="text-slate-400 text-[11px] mt-1.5 h-8 leading-normal">{cp.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-1 bg-slate-900/40 -mx-5 -mb-5 px-5 py-3 rounded-b-xl">
                    <span className="text-[11px] text-slate-400 uppercase font-mono font-bold">Standard Invoice Rate:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        defaultValue={cp.price}
                        onBlur={(e) => updateConfigPrice(cp.category, e.target.value)}
                        className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-right font-mono font-bold text-slate-100 text-xs focus:border-indigo-500 outline-none"
                        step="0.5"
                      />
                      <span className="font-extrabold text-xs font-mono text-indigo-300">M</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* SECTION 2: DYNAMIC AGENCY STAFF DIRECTORY */}
            <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-6 mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4 gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <User className="w-4.5 h-4.5 text-indigo-400" />
                    Agency Staff Directory
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Manage active staff member accounts. These represent the representatives shown in Step 1 of the client entry wizard.
                  </p>
                </div>
                <div className="text-xs font-semibold px-3 py-1.5 bg-indigo-950/40 border border-indigo-900/50 text-indigo-300 rounded-lg shrink-0">
                  Total Staff Rows: {staffMembers.length}
                </div>
              </div>

              {/* Inline Form: Add dynamic staff */}
              <div className="p-4 sm:p-5 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch md:items-end">
                <div className="flex-1 w-full flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-350 flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5 text-indigo-400" /> Representative Name
                  </label>
                  <input
                    type="text"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="Enter staff name... (e.g. Barry)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="w-full md:w-auto flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-350">Profile Photo (PFP)</label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      {newStaffAvatar ? (
                        <img src={newStaffAvatar} alt="New Staff Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-bold text-[11px] rounded-lg border border-slate-700 cursor-pointer flex items-center gap-1.5 shrink-0">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      Select File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const r = new FileReader();
                            r.onload = () => setNewStaffAvatar(r.result as string);
                            r.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {newStaffAvatar && (
                      <button
                        type="button"
                        onClick={() => setNewStaffAvatar(null)}
                        className="text-[10px] font-bold text-rose-450 hover:underline hover:text-rose-300"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!newStaffName.trim()) {
                      showToast("Please specify a staff name.");
                      return;
                    }
                    const newStaff: StaffMember = {
                      id: "staff_" + Date.now().toString(36),
                      name: newStaffName.trim(),
                      avatarUrl: newStaffAvatar,
                    };
                    setStaffMembers((prev) => [...prev, newStaff]);
                    setNewStaffName("");
                    setNewStaffAvatar(null);
                    fetch("/api/staff", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newStaff.name, avatar_url: newStaff.avatarUrl }),
                    }).catch((err) => console.warn("Failed to sync staff to Supabase:", err));
                    showToast(`Staff member "${newStaff.name}" registered!`);
                  }}
                  className="w-full md:w-auto px-5 py-2.2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition shrink-0 cursor-pointer"
                >
                  Register Staff
                </button>
              </div>

              {/* Staff Grid */}
              {staffMembers.length === 0 ? (
                <div className="text-center py-6 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                  <User className="w-8 h-8 text-slate-650 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs font-bold">No Staff Members Configured</p>
                  <p className="text-slate-500 text-[10px] mt-0.5">Please add a staff representative row above to register clients step 1!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {staffMembers.map((sm, idx) => {
                    const sampleGradients = [
                      "from-indigo-500 to-indigo-600",
                      "from-purple-500 to-purple-600",
                      "from-pink-500 to-pink-600",
                      "from-emerald-500 to-emerald-600",
                      "from-amber-500 to-amber-600",
                    ];
                    const chosenGrad = sampleGradients[idx % sampleGradients.length];

                    return (
                      <div key={sm.id} className="relative bg-[#131d35]/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4 hover:border-indigo-500 transition group shadow-xs">
                        
                        {/* Avatar Picker and display */}
                        <div className="relative group/avatar cursor-pointer">
                          <label className="block w-12 h-12 rounded-full border border-slate-700 bg-slate-800 overflow-hidden relative shrink-0 cursor-pointer">
                            {sm.avatarUrl ? (
                              <img src={sm.avatarUrl} alt={sm.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-tr ${chosenGrad} flex items-center justify-center text-white font-bold text-sm`}>
                                {sm.name ? sm.name[0]?.toUpperCase() : "U"}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-slate-900/75 opacity-0 hover:opacity-100 flex items-center justify-center text-[8px] font-bold text-white transition-opacity">
                              Change
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const r = new FileReader();
                                  r.onload = () => {
                                    const newUrl = r.result as string;
                                    setStaffMembers((prev) =>
                                      prev.map((item) =>
                                        item.id === sm.id ? { ...item, avatarUrl: newUrl } : item
                                      )
                                    );
                                    syncStaffToSupabase(sm.id, { avatar_url: newUrl });
                                    showToast(`PFP photo updated for "${sm.name}"`);
                                  };
                                  r.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* Name editable inline */}
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={sm.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setStaffMembers((prev) =>
                                prev.map((item) => (item.id === sm.id ? { ...item, name: val } : item))
                              );
                            }}
                            onBlur={(e) => {
                              if (!sm.name.trim()) {
                                  setStaffMembers((prev) =>
                                    prev.map((item) => (item.id === sm.id ? { ...item, name: "Representative" } : item))
                                  );
                                }
                              syncStaffToSupabase(sm.id, { name: e.target.value });
                            }}
                            className="w-full bg-transparent font-bold text-white text-xs border-b border-transparent focus:border-indigo-500 py-0.5 outline-none"
                            placeholder="Representative Name"
                          />
                          <p className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-wide font-mono leading-none">
                            Row ID: {sm.id}
                          </p>
                        </div>

                        {/* Delete action button */}
                        <button
                          type="button"
                          onClick={() => {
                            setStaffMembers((prev) => prev.filter((item) => item.id !== sm.id));
                            deleteStaffFromSupabase(sm.id);
                            showToast(`Deleted staff: "${sm.name}"`);
                          }}
                          className="p-1.5 bg-slate-900/40 text-slate-400 border border-slate-800 hover:bg-rose-950/40 hover:text-rose-450 hover:border-rose-900/40 rounded-lg transition"
                          title={`Delete ${sm.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Helper Tips */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-slate-300">
                <span className="font-bold text-slate-100">Pro tip for Agents:</span>
                Pricing categories starting with <span className="font-mono font-bold text-indigo-300">ALG</span> represent Algeria state districts templates, and <span className="font-mono font-bold text-indigo-300">ORN</span> represent West Oran consular templates. Updating any values automatically synchronizes live invoices during any new client addition stepper.
              </div>
            </div>

          </div>
        )}

      </main>

      {/* MULTI-STEP guided popup stepper dialog wizard */}
      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        configPrices={configPrices}
        staffMembers={staffMembers}
        onSaveClient={handleSaveAndSyncClient}
        showToast={showToast}
      />

      {/* Profile Editor Popup Modal */}
      <EditClientModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRecord(null);
        }}
        record={editingRecord}
        configPrices={configPrices}
        staffMembers={staffMembers}
        onSaveEdit={handleUpdateAndSyncClient}
        showToast={showToast}
      />

      {/* Reactive notifications banner */}
      <AnimatePresence>
        {successToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-5 right-5 bg-slate-900 border border-slate-800 text-white rounded-xl shadow-xl p-4 flex items-center gap-2 max-w-sm z-50"
          >
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
