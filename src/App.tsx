import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Database,
  Sparkles,
  Plus,
  Trash2,
  Settings,
  Check,
  User,
  Phone,
  Eye,
  Info,
  Pencil,
  Search,
  Download,
  ArrowUpDown,
  Filter,
  X,
  LayoutGrid,
  List as ListIcon,
  ChevronUp,
  ChevronDown,
  Sun,
  Moon,
  Bell,
  RefreshCw,
  Cloud,
  CloudOff,
  MoreVertical,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import AddClientModal from "./components/AddClientModal";
import EditClientModal from "./components/EditClientModal";
import ClientDetailDrawer from "./components/ClientDetailDrawer";
import DashboardCards from "./components/DashboardCards";
import StatisticsCharts from "./components/StatisticsCharts";
import {
  ClientData,
  ClientRecord,
  ConfigPrice,
  DEFAULT_CONFIG_PRICES,
  StaffMember,
  DEFAULT_STAFF_MEMBERS,
} from "./types";
import { Upload, UserPlus } from "lucide-react";
import { exportClientsToCSV, exportClientsToJSON, downloadFile, formatCurrency } from "./utils/export";

type SortField = "name" | "phone" | "category" | "versment" | "rest" | "created" | "staff";
type SortDir = "asc" | "desc";
type Theme = "dark" | "light";

const THEMES = {
  dark: {
    bg: "bg-[#090d16]",
    text: "text-slate-200",
    card: "bg-[#0f172a]",
    border: "border-slate-800",
    header: "bg-[#0f172a]",
    input: "bg-slate-950",
    secondary: "bg-slate-900/60",
    subtle: "text-slate-400",
    accent: "text-indigo-300",
    hover: "hover:bg-[#111a2e]/30",
    ring: "ring-indigo-500/40",
  },
  light: {
    bg: "bg-slate-50",
    text: "text-slate-900",
    card: "bg-white",
    border: "border-slate-200",
    header: "bg-white",
    input: "bg-slate-50",
    secondary: "bg-slate-100",
    subtle: "text-slate-600",
    accent: "text-indigo-600",
    hover: "hover:bg-slate-50",
    ring: "ring-indigo-400",
  },
} as const;

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "clients" | "prices">("dashboard");
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("visa_theme") as Theme) || "dark");

  const [configPrices, setConfigPrices] = useState<ConfigPrice[]>(() => {
    const saved = localStorage.getItem("visa_config_db");
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG_PRICES;
  });

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => {
    const saved = localStorage.getItem("visa_staff_db");
    return saved ? JSON.parse(saved) : DEFAULT_STAFF_MEMBERS;
  });

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffAvatar, setNewStaffAvatar] = useState<string | null>(null);

  const [clientRecords, setClientRecords] = useState<ClientRecord[]>(() => {
    const saved = localStorage.getItem("visa_clients_db");
    return saved ? JSON.parse(saved) : [];
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ClientRecord | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<ClientRecord | null>(null);

  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [infoToast, setInfoToast] = useState<string | null>(null);

  // Search/filter/sort
  const [searchQuery, setSearchQuery] = useState("");
  const [staffFilter, setStaffFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [sortField, setSortField] = useState<SortField>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [view, setView] = useState<"table" | "cards">("table");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  // Persist state changes
  useEffect(() => {
    localStorage.setItem("visa_config_db", JSON.stringify(configPrices));
  }, [configPrices]);
  useEffect(() => {
    localStorage.setItem("visa_clients_db", JSON.stringify(clientRecords));
  }, [clientRecords]);
  useEffect(() => {
    localStorage.setItem("visa_staff_db", JSON.stringify(staffMembers));
  }, [staffMembers]);
  useEffect(() => {
    localStorage.setItem("visa_theme", theme);
    if (theme === "light") {
      document.documentElement.classList.add("theme-light");
    } else {
      document.documentElement.classList.remove("theme-light");
    }
  }, [theme]);

  // Toast helpers
  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };
  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4500);
  };
  const showInfo = (msg: string) => {
    setInfoToast(msg);
    setTimeout(() => setInfoToast(null), 3500);
  };

  // Refresh data from Supabase
  const refreshData = async (silent = false) => {
    setIsSyncing(true);
    try {
      const [clientsRes, staffRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/staff"),
      ]);

      if (clientsRes.ok) {
        const data = await clientsRes.json();
        if (data.success && Array.isArray(data.clients)) {
          const mapped: ClientRecord[] = data.clients.map((c: any, i: number) => ({
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
        const data = await staffRes.json();
        if (data.success && Array.isArray(data.staff) && data.staff.length > 0) {
          const mapped: StaffMember[] = data.staff.map((s: any) => ({
            id: s.staff_id,
            name: s.name,
            avatarUrl: s.avatar_url || null,
          }));
          setStaffMembers(mapped);
        }
      }
      setLastSyncAt(new Date());
      if (!silent) showToast("Synced from cloud successfully");
    } catch (err: any) {
      if (!silent) showError("Sync failed: " + (err.message || "network error"));
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Staff sync helpers
  const syncStaffToSupabase = async (staff_id: string, data: { name?: string; avatar_url?: string | null }) => {
    try {
      await fetch(`/api/staff/${encodeURIComponent(staff_id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.warn("Failed to sync staff update:", err);
    }
  };

  const deleteStaffFromSupabase = async (staff_id: string) => {
    try {
      await fetch(`/api/staff/${encodeURIComponent(staff_id)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.warn("Failed to delete staff:", err);
    }
  };

  const updateConfigPrice = (catName: string, newRate: string) => {
    setConfigPrices((prev) =>
      prev.map((p) => (p.category === catName ? { ...p, price: newRate } : p))
    );
    showToast(`Pricing updated: ${catName} → ${newRate}M`);
  };

  const handleSaveAndSyncClient = async (
    clientData: ClientData
  ): Promise<{ success: boolean; simulated: boolean; message: string; error?: string }> => {
    const newRecord: ClientRecord = {
      ...clientData,
      id: "rec_" + Date.now().toString(36),
      created_at: new Date().toISOString(),
    };
    setClientRecords((prev) => [newRecord, ...prev]);
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
          message: result.message || "Synced to Supabase successfully",
        };
      } else {
        let serverErrorMsg = "";
        try {
          const errObj = await response.json();
          serverErrorMsg = errObj.error || errObj.message;
        } catch (_) {}
        throw new Error(serverErrorMsg || `Server error ${response.status}`);
      }
    } catch (err: any) {
      console.warn("Sync error:", err);
      return {
        success: false,
        simulated: false,
        message: err.message || "Failed to sync to cloud",
        error: err.message,
      };
    }
  };

  const handleStartEditClient = (record: ClientRecord) => {
    setEditingRecord(record);
    setIsEditModalOpen(true);
    setIsDetailOpen(false);
  };

  const handleOpenDetail = (record: ClientRecord) => {
    setDetailRecord(record);
    setIsDetailOpen(true);
  };

  const handleUpdateAndSyncClient = async (
    id: string,
    updatedFields: Partial<ClientRecord>
  ): Promise<{ success: boolean; simulated: boolean; message: string; error?: string }> => {
    const originalRecord = clientRecords.find((r) => r.id === id);
    if (!originalRecord) {
      return { success: false, simulated: false, message: "Record not found.", error: "Not found" };
    }

    const original_passport_number = originalRecord.passport_number;
    const mergedRecord: ClientRecord = { ...originalRecord, ...updatedFields };
    const { id: _, created_at: __, ...clientData } = mergedRecord;

    setClientRecords((prev) => prev.map((r) => (r.id === id ? mergedRecord : r)));

    try {
      const response = await fetch("/api/update-in-supabase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original_passport_number, clientData }),
      });
      if (response.ok) {
        const result = await response.json();
        return {
          success: result.success === undefined ? true : result.success,
          simulated: result.simulated ?? false,
          message: result.message || "Profile updated",
        };
      } else {
        let msg = "";
        try {
          const e = await response.json();
          msg = e.error || e.message;
        } catch (_) {}
        throw new Error(msg || `Server error ${response.status}`);
      }
    } catch (err: any) {
      return {
        success: true,
        simulated: true,
        message: err.message || "Updated locally",
        error: err.message,
      };
    }
  };

  const handleDeleteClient = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const target = clientRecords.find((r) => r.id === id);
    if (!target) return;
    setClientRecords((prev) => prev.filter((r) => r.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    showToast("Profile removed.");
    if (target.passport_number) {
      try {
        const response = await fetch("/api/delete-from-supabase", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passport_number: target.passport_number }),
        });
        if (response.ok) {
          const json = await response.json();
          if (json.success) showToast("Synced deletion to cloud.");
        }
      } catch (err) {
        console.error("Delete sync error:", err);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} client(s)? This cannot be undone.`)) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await handleDeleteClient(id);
    }
    setSelectedIds(new Set());
    showToast(`Deleted ${ids.length} clients.`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
    }
  };

  const handleExportCSV = () => {
    const data = selectedIds.size > 0
      ? filteredRecords.filter((r) => selectedIds.has(r.id))
      : filteredRecords;
    if (data.length === 0) {
      showError("No clients to export");
      return;
    }
    const csv = exportClientsToCSV(data);
    const date = new Date().toISOString().split("T")[0];
    downloadFile(`taw3na-clients-${date}.csv`, csv, "text/csv");
    showToast(`Exported ${data.length} client(s) to CSV`);
  };

  const handleExportJSON = () => {
    const data = selectedIds.size > 0
      ? filteredRecords.filter((r) => selectedIds.has(r.id))
      : filteredRecords;
    if (data.length === 0) {
      showError("No clients to export");
      return;
    }
    const json = exportClientsToJSON(data);
    const date = new Date().toISOString().split("T")[0];
    downloadFile(`taw3na-clients-${date}.json`, json, "application/json");
    showToast(`Exported ${data.length} client(s) to JSON`);
  };

  // Filter + sort
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = clientRecords.filter((r) => r.account_email === "taw3na@mkservice.com");
    if (q) {
      result = result.filter((r) => {
        return (
          (r.last_name || "").toLowerCase().includes(q) ||
          (r.first_name || "").toLowerCase().includes(q) ||
          (r.passport_number || "").toLowerCase().includes(q) ||
          (r.phone_number || "").toLowerCase().includes(q) ||
          (r.category || "").toLowerCase().includes(q) ||
          (r.staff_member || "").toLowerCase().includes(q)
        );
      });
    }
    if (staffFilter) {
      result = result.filter((r) => r.staff_member === staffFilter);
    }
    if (categoryFilter) {
      result = result.filter((r) => r.category === categoryFilter);
    }
    if (paymentFilter !== "all") {
      result = result.filter((r) => {
        const price = parseFloat(r.payment?.price || "0");
        const vers = parseFloat(r.payment?.versment || "0");
        const paid = price > 0 && vers >= price;
        return paymentFilter === "paid" ? paid : !paid;
      });
    }

    const cmp = (a: any, b: any, dir: 1 | -1) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return a < b ? -1 * dir : a > b ? 1 * dir : 0;
    };

    const dir: 1 | -1 = sortDir === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      switch (sortField) {
        case "name":
          return cmp((a.last_name || "").toLowerCase(), (b.last_name || "").toLowerCase(), dir);
        case "phone":
          return cmp(a.phone_number || "", b.phone_number || "", dir);
        case "category":
          return cmp(a.category || "", b.category || "", dir);
        case "versment":
          return cmp(parseFloat(a.payment?.versment || "0"), parseFloat(b.payment?.versment || "0"), dir);
        case "rest": {
          const ar = Math.max(0, parseFloat(a.payment?.price || "0") - parseFloat(a.payment?.versment || "0"));
          const br = Math.max(0, parseFloat(b.payment?.price || "0") - parseFloat(b.payment?.versment || "0"));
          return cmp(ar, br, dir);
        }
        case "staff":
          return cmp(a.staff_member || "", b.staff_member || "", dir);
        case "created":
        default:
          return cmp(
            new Date(a.created_at || 0).getTime(),
            new Date(b.created_at || 0).getTime(),
            dir
          );
      }
    });
    return result;
  }, [clientRecords, searchQuery, staffFilter, categoryFilter, paymentFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const t = THEMES[theme];

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} font-sans pb-16 transition-colors`}>
      {/* Header */}
      <header className={`${t.header} ${theme === "light" ? "" : "bg-[#0f172a]"} border-b ${t.border} shadow-lg relative overflow-hidden`}>
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 360, scale: 1.05 }}
              transition={{ duration: 0.6 }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"
            >
              <span className="text-white font-black text-xl">T</span>
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-base font-extrabold tracking-tight ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                  Taw3na
                </h1>
                <motion.span
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    isSyncing
                      ? "bg-amber-950/40 border border-amber-900/50 text-amber-300"
                      : lastSyncAt
                      ? "bg-emerald-950/40 border border-emerald-900/50 text-emerald-300"
                      : "bg-slate-800 border border-slate-700 text-slate-400"
                  }`}
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      Syncing
                    </>
                  ) : lastSyncAt ? (
                    <>
                      <Cloud className="w-2.5 h-2.5" />
                      Live
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-2.5 h-2.5" />
                      Offline
                    </>
                  )}
                </motion.span>
              </div>
              <p className={`text-xs ${t.subtle} mt-0.5`}>
                Biometric OCR &middot; Visa Application Registry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Tabs */}
            <div className={`flex items-center gap-1 ${theme === "light" ? "bg-slate-100" : "bg-slate-900/80"} border ${t.border} p-1 rounded-xl`}>
              {[
                { id: "dashboard", label: "Dashboard" },
                { id: "clients", label: "Clients" },
                { id: "prices", label: "Pricing" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === tab.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : `${t.subtle} hover:${theme === "light" ? "text-slate-900" : "text-slate-200"}`
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`p-2 ${theme === "light" ? "bg-slate-100 hover:bg-slate-200" : "bg-slate-900/80 hover:bg-slate-800"} border ${t.border} rounded-xl transition`}
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Manual sync */}
            <button
              onClick={() => refreshData()}
              disabled={isSyncing}
              className={`p-2 ${theme === "light" ? "bg-slate-100 hover:bg-slate-200" : "bg-slate-900/80 hover:bg-slate-800"} border ${t.border} rounded-xl transition disabled:opacity-50`}
              title="Refresh from cloud"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            </button>

            {/* Add new */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:from-indigo-700 active:to-purple-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Client</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-5">
        {activeTab === "dashboard" && (
          <div className="space-y-5 animate-fade-in">
            <DashboardCards clients={clientRecords} staff={staffMembers} />
            <StatisticsCharts clients={clientRecords} staff={staffMembers} />

            {/* Recent activity */}
            <div className={`${t.card} border ${t.border} rounded-2xl p-5 shadow-lg`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-950/40 border border-amber-900/50">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </div>
                  <h3 className={`text-sm font-extrabold ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                    Recent Activity
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab("clients")}
                  className="text-[10px] text-indigo-300 hover:text-indigo-200 font-bold uppercase tracking-wider font-mono"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-2">
                {clientRecords.slice(0, 5).map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => handleOpenDetail(rec)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl ${t.hover} cursor-pointer transition group`}
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                      {rec.client_pic ? (
                        <img src={rec.client_pic} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-extrabold ${theme === "light" ? "text-slate-900" : "text-white"} truncate uppercase`}>
                        {rec.last_name} {rec.first_name}
                      </div>
                      <div className={`text-[10px] ${t.subtle} font-mono`}>
                        {rec.passport_number} · {rec.staff_member} · {new Date(rec.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-[10px] text-indigo-300 font-mono font-bold">{rec.category}</span>
                  </div>
                ))}
                {clientRecords.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No clients yet. Add one to get started.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "clients" && (
          <div className="space-y-4 animate-fade-in">
            {/* Search & filter bar */}
            <div className={`${t.card} border ${t.border} rounded-2xl p-4 shadow-lg`}>
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className={`w-4 h-4 ${t.subtle} absolute left-3 top-1/2 -translate-y-1/2`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, passport, phone, category, staff..."
                    className={`w-full pl-9 pr-3 py-2 ${t.input} border ${t.border} rounded-lg text-xs font-bold outline-none focus:border-indigo-500 ${theme === "light" ? "text-slate-900" : "text-white"}`}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={staffFilter}
                    onChange={(e) => setStaffFilter(e.target.value)}
                    className={`px-3 py-2 ${t.input} border ${t.border} rounded-lg text-xs font-bold outline-none focus:border-indigo-500`}
                  >
                    <option value="">All Staff</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className={`px-3 py-2 ${t.input} border ${t.border} rounded-lg text-xs font-bold outline-none focus:border-indigo-500`}
                  >
                    <option value="">All Categories</option>
                    {configPrices.map((cp) => (
                      <option key={cp.id} value={cp.category}>
                        {cp.category}
                      </option>
                    ))}
                  </select>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value as any)}
                    className={`px-3 py-2 ${t.input} border ${t.border} rounded-lg text-xs font-bold outline-none focus:border-indigo-500`}
                  >
                    <option value="all">All Payments</option>
                    <option value="paid">Fully Paid</option>
                    <option value="unpaid">Outstanding</option>
                  </select>
                </div>
              </div>

              {/* Action bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3 pt-3 border-t border-slate-800/50">
                <div className="flex items-center gap-2 text-xs">
                  <span className={t.subtle}>
                    <span className="font-bold text-indigo-300">{filteredRecords.length}</span> of {clientRecords.length} clients
                  </span>
                  {selectedIds.size > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-indigo-950/40 border border-indigo-900/50 text-indigo-300 font-mono text-[10px]">
                      {selectedIds.size} selected
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-900/50 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete ({selectedIds.size})
                    </button>
                  )}
                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                    title="Export to CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                    title="Export to JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                    JSON
                  </button>
                  <div className={`flex ${theme === "light" ? "bg-slate-100" : "bg-slate-900/80"} border ${t.border} rounded-lg overflow-hidden`}>
                    <button
                      onClick={() => setView("table")}
                      className={`px-2 py-1.5 ${view === "table" ? "bg-indigo-600 text-white" : t.subtle} transition`}
                      title="Table view"
                    >
                      <ListIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setView("cards")}
                      className={`px-2 py-1.5 ${view === "cards" ? "bg-indigo-600 text-white" : t.subtle} transition`}
                      title="Card view"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Clients table/cards */}
            <div className={`${t.card} border ${t.border} rounded-2xl shadow-lg overflow-hidden`}>
              {filteredRecords.length === 0 ? (
                <div className="text-center py-16 text-slate-300">
                  <Database className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-100">No Clients Found</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {clientRecords.length === 0
                      ? "No active clients. Click '+ Add Client' to start!"
                      : "No clients match the current filters. Try clearing them."}
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 text-xs font-bold rounded-xl border border-indigo-800/50 transition"
                  >
                    Add First Client
                  </button>
                </div>
              ) : view === "table" ? (
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className={`${theme === "light" ? "bg-slate-100" : "bg-[#111a2e]"} ${t.subtle} border-b ${t.border} uppercase font-mono text-[9px] tracking-wider font-bold`}>
                      <tr>
                        <th className="p-3 w-8">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
                            onChange={toggleSelectAll}
                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-indigo-600"
                          />
                        </th>
                        <th className="p-3 w-[10%]">Pic</th>
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("name")}>
                          <div className="flex items-center gap-1">Name <SortIcon field="name" /></div>
                        </th>
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("phone")}>
                          <div className="flex items-center gap-1">Phone <SortIcon field="phone" /></div>
                        </th>
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("category")}>
                          <div className="flex items-center gap-1">Category <SortIcon field="category" /></div>
                        </th>
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("versment")}>
                          <div className="flex items-center gap-1">Paid <SortIcon field="versment" /></div>
                        </th>
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("rest")}>
                          <div className="flex items-center gap-1">Rest <SortIcon field="rest" /></div>
                        </th>
                        <th className="p-3 cursor-pointer select-none" onClick={() => handleSort("staff")}>
                          <div className="flex items-center gap-1">Staff <SortIcon field="staff" /></div>
                        </th>
                        <th className="p-3 text-center w-[10%]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${theme === "light" ? "divide-slate-200" : "divide-slate-800"}`}>
                      {filteredRecords.map((rec) => {
                        const price = parseFloat(rec.payment?.price || "0");
                        const versment = parseFloat(rec.payment?.versment || "0");
                        const rest = Math.max(0, price - versment);
                        return (
                          <tr
                            key={rec.id}
                            className={`${t.hover} transition cursor-pointer`}
                            onClick={() => handleOpenDetail(rec)}
                          >
                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(rec.id)}
                                onChange={() => toggleSelect(rec.id)}
                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-indigo-600"
                              />
                            </td>
                            <td className="p-3">
                              <div className={`w-9 h-9 rounded-full ${theme === "light" ? "bg-slate-200" : "bg-slate-800"} border ${t.border} overflow-hidden flex items-center justify-center shrink-0`}>
                                {rec.client_pic ? (
                                  <img src={rec.client_pic} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-4 h-4 text-slate-500" />
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className={`font-extrabold text-sm ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                                {rec.last_name || "—"} {rec.first_name || ""}
                              </div>
                              <div className={`text-[10px] ${t.subtle} font-mono mt-0.5`}>
                                Pass: {rec.passport_number || "PENDING"}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-indigo-400" />
                                <span className="font-bold">{rec.phone_number || "—"}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/40 border border-indigo-900/50 font-mono font-bold text-[10px] text-indigo-300">
                                {rec.category} ({rec.payment?.price || "0"}M)
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="font-mono font-extrabold text-[11px] text-emerald-300">
                                {versment}M
                              </span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`font-mono font-extrabold text-[11px] ${
                                  rest > 0 ? "text-rose-300" : "text-emerald-300"
                                }`}
                              >
                                {rest}M
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/40 border border-indigo-900/40 px-2 py-0.5 rounded font-mono uppercase">
                                {rec.staff_member || "—"}
                              </span>
                            </td>
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleStartEditClient(rec)}
                                  className="p-1.5 bg-indigo-950/45 hover:bg-indigo-900/45 text-indigo-300 border border-indigo-900/50 rounded-md transition"
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteClient(rec.id, e)}
                                  className="p-1.5 bg-rose-950/45 hover:bg-rose-900/45 text-rose-300 border border-rose-900/50 rounded-md transition"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Card view */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {filteredRecords.map((rec) => {
                    const price = parseFloat(rec.payment?.price || "0");
                    const versment = parseFloat(rec.payment?.versment || "0");
                    const rest = Math.max(0, price - versment);
                    return (
                      <motion.div
                        key={rec.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`${t.secondary} border ${t.border} rounded-xl p-4 hover:border-indigo-500/60 transition cursor-pointer group relative`}
                        onClick={() => handleOpenDetail(rec)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(rec.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(rec.id);
                          }}
                          className="absolute top-3 right-3 w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-indigo-600"
                        />
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 rounded-full ${theme === "light" ? "bg-slate-200" : "bg-slate-800"} border ${t.border} overflow-hidden flex items-center justify-center shrink-0`}>
                            {rec.client_pic ? (
                              <img src={rec.client_pic} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-slate-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-extrabold text-sm ${theme === "light" ? "text-slate-900" : "text-white"} uppercase truncate`}>
                              {rec.last_name} {rec.first_name}
                            </div>
                            <div className={`text-[10px] ${t.subtle} font-mono mt-0.5`}>
                              {rec.passport_number || "—"}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/50 text-center">
                          <div>
                            <div className="text-[8px] uppercase font-mono font-bold text-slate-400">Cat</div>
                            <div className="text-[10px] font-mono font-extrabold text-indigo-300 mt-0.5">{rec.category}</div>
                          </div>
                          <div>
                            <div className="text-[8px] uppercase font-mono font-bold text-slate-400">Paid</div>
                            <div className="text-[10px] font-mono font-extrabold text-emerald-300 mt-0.5">{versment}M</div>
                          </div>
                          <div>
                            <div className="text-[8px] uppercase font-mono font-bold text-slate-400">Rest</div>
                            <div className={`text-[10px] font-mono font-extrabold mt-0.5 ${rest > 0 ? "text-rose-300" : "text-emerald-300"}`}>{rest}M</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/50">
                          <span className="text-[9px] text-slate-500 font-mono">{new Date(rec.created_at).toLocaleDateString()}</span>
                          <span className="text-[9px] font-bold text-indigo-300 bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded font-mono uppercase">
                            {rec.staff_member}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Mobile card view (always) */}
              {view === "table" && (
                <div className="block md:hidden divide-y divide-slate-800">
                  {filteredRecords.map((rec) => {
                    const price = parseFloat(rec.payment?.price || "0");
                    const versment = parseFloat(rec.payment?.versment || "0");
                    const rest = Math.max(0, price - versment);
                    return (
                      <div
                        key={rec.id}
                        className={`p-4 flex flex-col gap-2 ${t.hover} transition cursor-pointer`}
                        onClick={() => handleOpenDetail(rec)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full ${theme === "light" ? "bg-slate-200" : "bg-slate-800"} border ${t.border} overflow-hidden flex items-center justify-center shrink-0`}>
                            {rec.client_pic ? (
                              <img src={rec.client_pic} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-slate-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-extrabold text-sm ${theme === "light" ? "text-slate-900" : "text-white"} truncate uppercase`}>
                              {rec.last_name} {rec.first_name}
                            </div>
                            <div className={`text-[10px] ${t.subtle} font-mono`}>
                              {rec.passport_number || "—"}
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-indigo-300 bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded font-mono uppercase shrink-0">
                            {rec.staff_member}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-center bg-slate-900/40 p-2 rounded-lg">
                          <div>
                            <div className="text-[8px] uppercase font-mono font-bold text-slate-400">Cat</div>
                            <div className="text-[10px] font-mono font-extrabold text-indigo-300 mt-0.5">{rec.category}</div>
                          </div>
                          <div>
                            <div className="text-[8px] uppercase font-mono font-bold text-slate-400">Paid</div>
                            <div className="text-[10px] font-mono font-extrabold text-emerald-300 mt-0.5">{versment}M</div>
                          </div>
                          <div>
                            <div className="text-[8px] uppercase font-mono font-bold text-slate-400">Rest</div>
                            <div className={`text-[10px] font-mono font-extrabold mt-0.5 ${rest > 0 ? "text-rose-300" : "text-emerald-300"}`}>{rest}M</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "prices" && (
          <div className="space-y-5 animate-fade-in">
            <div className={`${t.card} border ${t.border} rounded-2xl p-5 shadow-lg`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-indigo-950/40 border border-indigo-900/50">
                  <Settings className="w-4 h-4 text-indigo-300" />
                </div>
                <h3 className={`text-sm font-extrabold ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                  Service Pricing
                </h3>
              </div>
              <p className={`text-xs ${t.subtle} mt-0.5`}>
                Update standard cost matrices (M) for each category.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {configPrices.map((cp) => (
                  <div key={cp.id} className={`${t.secondary} border ${t.border} rounded-xl p-4`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-indigo-300 text-sm bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/50">
                        {cp.category}
                      </span>
                    </div>
                    <p className={`${t.subtle} text-[11px] mb-3`}>{cp.description}</p>
                    <div className={`flex items-center justify-between border-t ${t.border} pt-3`}>
                      <span className={`text-[10px] ${t.subtle} uppercase font-mono font-bold`}>Rate</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          defaultValue={cp.price}
                          onBlur={(e) => updateConfigPrice(cp.category, e.target.value)}
                          className={`w-20 ${t.input} border ${t.border} rounded-lg px-2 py-1 text-right font-mono font-bold text-xs focus:border-indigo-500 outline-none`}
                          step="0.5"
                        />
                        <span className="font-extrabold text-xs font-mono text-indigo-300">M</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${t.card} border ${t.border} rounded-2xl p-5 shadow-lg`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4 gap-4 mb-4">
                <div>
                  <h3 className={`text-sm font-extrabold ${theme === "light" ? "text-slate-900" : "text-white"} flex items-center gap-2`}>
                    <User className="w-4 h-4 text-indigo-400" />
                    Agency Staff Directory
                  </h3>
                  <p className={`text-xs ${t.subtle} mt-0.5`}>
                    Manage active staff member accounts.
                  </p>
                </div>
                <div className="text-[10px] font-bold px-2 py-1 bg-indigo-950/40 border border-indigo-900/50 text-indigo-300 rounded-md font-mono">
                  {staffMembers.length} staff
                </div>
              </div>

              {/* Add staff */}
              <div className={`p-3 ${t.secondary} border ${t.border} rounded-xl flex flex-col md:flex-row gap-3 items-stretch md:items-end mb-4`}>
                <div className="flex-1 w-full flex flex-col gap-1.5">
                  <label className={`text-[10px] font-bold ${t.subtle} flex items-center gap-1 uppercase tracking-wider font-mono`}>
                    <UserPlus className="w-3 h-3 text-indigo-400" /> Name
                  </label>
                  <input
                    type="text"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="Representative name..."
                    className={`w-full ${t.input} border ${t.border} rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 ${theme === "light" ? "text-slate-900" : "text-white"}`}
                  />
                </div>
                <div className="w-full md:w-auto flex flex-col gap-1.5">
                  <label className={`text-[10px] font-bold ${t.subtle} uppercase tracking-wider font-mono`}>Photo</label>
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-full border ${t.border} ${theme === "light" ? "bg-slate-200" : "bg-slate-800"} flex items-center justify-center overflow-hidden shrink-0`}>
                      {newStaffAvatar ? (
                        <img src={newStaffAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <label className={`px-3 py-1.5 ${theme === "light" ? "bg-slate-200 hover:bg-slate-300" : "bg-slate-800 hover:bg-slate-700"} text-xs font-bold rounded-md border ${t.border} cursor-pointer flex items-center gap-1`}>
                      <Upload className="w-3 h-3" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const r = new FileReader();
                            r.onload = () => setNewStaffAvatar(r.result as string);
                            r.readAsDataURL(f);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newStaffName.trim()) {
                      showError("Please specify a staff name.");
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
                    }).catch(() => {});
                    showToast(`Staff "${newStaff.name}" added.`);
                  }}
                  className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-lg shadow-md transition shrink-0"
                >
                  Register
                </button>
              </div>

              {/* Staff grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {staffMembers.map((sm, idx) => {
                  const gradients = [
                    "from-indigo-500 to-violet-600",
                    "from-purple-500 to-fuchsia-600",
                    "from-emerald-500 to-cyan-600",
                    "from-amber-500 to-rose-600",
                  ];
                  const grad = gradients[idx % gradients.length];
                  return (
                    <div
                      key={sm.id}
                      className={`${t.secondary} border ${t.border} rounded-xl p-3 flex items-center gap-3 hover:border-indigo-500/60 transition`}
                    >
                      <label className="relative block w-10 h-10 rounded-full border border-slate-700 overflow-hidden shrink-0 cursor-pointer">
                        {sm.avatarUrl ? (
                          <img src={sm.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-tr ${grad} flex items-center justify-center text-white font-bold text-sm`}>
                            {(sm.name?.[0] || "U").toUpperCase()}
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              const r = new FileReader();
                              r.onload = () => {
                                const newUrl = r.result as string;
                                setStaffMembers((p) => p.map((i) => (i.id === sm.id ? { ...i, avatarUrl: newUrl } : i)));
                                syncStaffToSupabase(sm.id, { avatar_url: newUrl });
                              };
                              r.readAsDataURL(f);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={sm.name}
                          onChange={(e) => setStaffMembers((p) => p.map((i) => (i.id === sm.id ? { ...i, name: e.target.value } : i)))}
                          onBlur={() => syncStaffToSupabase(sm.id, { name: sm.name })}
                          className={`w-full bg-transparent font-bold text-xs border-b border-transparent focus:border-indigo-500 py-0.5 outline-none ${theme === "light" ? "text-slate-900" : "text-white"}`}
                        />
                        <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">{sm.id}</p>
                      </div>
                      <button
                        onClick={() => {
                          setStaffMembers((p) => p.filter((i) => i.id !== sm.id));
                          deleteStaffFromSupabase(sm.id);
                          showToast(`Removed "${sm.name}"`);
                        }}
                        className="p-1.5 bg-slate-800 text-slate-400 border border-slate-700 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-900/40 rounded-md transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`${t.card} border ${t.border} rounded-xl p-3 flex items-start gap-2`}>
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className={`text-[11px] leading-relaxed ${t.subtle}`}>
                <span className={`font-bold ${theme === "light" ? "text-slate-900" : "text-slate-100"}`}>Pro tip:</span>{" "}
                Categories starting with <span className="font-mono font-bold text-indigo-300">ALG</span> represent Algeria districts, and <span className="font-mono font-bold text-indigo-300">ORN</span> represent Oran consular templates.
              </div>
            </div>
          </div>
        )}
      </main>

      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        configPrices={configPrices}
        staffMembers={staffMembers}
        onSaveClient={handleSaveAndSyncClient}
        showToast={showToast}
      />

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

      <ClientDetailDrawer
        isOpen={isDetailOpen}
        record={detailRecord}
        onClose={() => setIsDetailOpen(false)}
        onEdit={handleStartEditClient}
      />

      {/* Toasts */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-5 right-5 bg-slate-900 border border-emerald-700/50 text-white rounded-xl shadow-2xl p-3 flex items-center gap-2 max-w-sm z-50"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold">{successToast}</span>
          </motion.div>
        )}
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-5 right-5 bg-slate-900 border border-rose-700/50 text-white rounded-xl shadow-2xl p-3 flex items-center gap-2 max-w-sm z-50"
          >
            <div className="w-7 h-7 rounded-lg bg-rose-950/50 border border-rose-900/50 flex items-center justify-center shrink-0">
              <X className="w-4 h-4 text-rose-400" />
            </div>
            <span className="text-xs font-semibold">{errorToast}</span>
          </motion.div>
        )}
        {infoToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-5 right-5 bg-slate-900 border border-indigo-700/50 text-white rounded-xl shadow-2xl p-3 flex items-center gap-2 max-w-sm z-50"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-950/50 border border-indigo-900/50 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-xs font-semibold">{infoToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
