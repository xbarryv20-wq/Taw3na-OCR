import React, { useEffect, useState } from "react";
import {
  X,
  User,
  CreditCard,
  Phone,
  Calendar,
  FileText,
  Copy,
  Check,
  QrCode,
  Download,
  ShieldCheck,
  Clock,
  MapPin,
  Hash,
  Hash as HashIcon,
  Mail,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ClientRecord } from "../types";
import { generateQRDataURL, buildClientSummaryString } from "../utils/qrcode";
import { formatCurrency } from "../utils/export";

interface ClientDetailDrawerProps {
  isOpen: boolean;
  record: ClientRecord | null;
  onClose: () => void;
  onEdit: (record: ClientRecord) => void;
}

function Field({
  label,
  value,
  mono = false,
  uppercase = false,
  icon,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  uppercase?: boolean;
  icon?: React.ReactNode;
}) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div
        className={`text-sm font-bold text-slate-100 ${
          mono ? "font-mono" : ""
        } ${uppercase ? "uppercase" : ""}`}
      >
        {display}
      </div>
    </div>
  );
}

function SectionTitle({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
      <div className="p-1.5 rounded-lg bg-indigo-950/40 border border-indigo-900/50 text-indigo-300">
        {icon}
      </div>
      <h3 className="text-sm font-extrabold text-slate-100">{title}</h3>
    </div>
  );
}

function CopyableField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className="group flex items-center justify-between gap-2 px-3 py-2 bg-slate-950/60 hover:bg-slate-900/80 border border-slate-800 hover:border-indigo-700/60 rounded-lg transition w-full text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[9px] text-slate-500 uppercase font-mono font-bold tracking-wider">{label}</div>
        <div className={`text-[11px] font-bold text-slate-200 truncate ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      <div className="text-slate-500 group-hover:text-emerald-400 transition shrink-0">
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </div>
    </button>
  );
}

export default function ClientDetailDrawer({ isOpen, record, onClose, onEdit }: ClientDetailDrawerProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && record) {
      const text = buildClientSummaryString(record);
      generateQRDataURL(text, 200)
        .then(setQrUrl)
        .catch(() => setQrUrl(null));
    } else {
      setQrUrl(null);
    }
  }, [isOpen, record]);

  if (!record) return null;

  const price = parseFloat(record.payment?.price || "0");
  const versment = parseFloat(record.payment?.versment || "0");
  const rest = Math.max(0, price - versment);
  const paidPercent = price > 0 ? Math.min(100, (versment / price) * 100) : 0;

  const sampleGradients = [
    "from-indigo-500 to-violet-600",
    "from-purple-500 to-fuchsia-600",
    "from-emerald-500 to-cyan-600",
    "from-amber-500 to-rose-600",
    "from-sky-500 to-indigo-600",
  ];
  const gradIdx = ((record.last_name?.charCodeAt(0) || 0) + (record.first_name?.charCodeAt(0) || 0)) % sampleGradients.length;
  const gradient = sampleGradients[gradIdx];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:max-w-md md:max-w-lg lg:max-w-xl z-50 bg-[#0f172a] border-l border-slate-800 shadow-2xl overflow-y-auto"
          >
            <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-950/50 border border-indigo-900/50 text-indigo-300">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-white leading-none">Client Profile</h2>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">ID: {record.id}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Hero header */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5">
                <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-tr ${gradient} opacity-20 blur-2xl`} />
                <div className="flex items-start gap-4 relative z-10">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-extrabold text-2xl shadow-lg border-2 border-slate-800 shrink-0`}>
                    {record.client_pic ? (
                      <img src={record.client_pic} alt="" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <>
                        {(record.last_name?.[0] || "U").toUpperCase()}
                        {(record.first_name?.[0] || "").toUpperCase()}
                      </>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-extrabold text-white truncate uppercase">
                      {record.last_name || "—"} {record.first_name || ""}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                      <span className="truncate">{record.passport_number || "PENDING"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {record.staff_member && (
                        <span className="text-[9px] font-bold text-indigo-300 bg-indigo-950/40 border border-indigo-900/50 px-2 py-0.5 rounded-full font-mono uppercase">
                          STAFF: {record.staff_member}
                        </span>
                      )}
                      {record.category && (
                        <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded-full font-mono">
                          {record.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick copy fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {record.passport_number && (
                  <CopyableField label="Passport Number" value={record.passport_number} />
                )}
                {record.phone_number && (
                  <CopyableField label="Phone Number" value={record.phone_number} mono={false} />
                )}
                {record.account_email && (
                  <CopyableField label="Account Email" value={record.account_email} mono={false} />
                )}
                {record.created_at && (
                  <CopyableField
                    label="Registered At"
                    value={new Date(record.created_at).toLocaleString()}
                    mono={false}
                  />
                )}
              </div>

              {/* Identity section */}
              <div className="space-y-3">
                <SectionTitle title="Identity Details" icon={<User className="w-3.5 h-3.5" />} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Last Name" value={record.last_name} uppercase icon={<User className="w-3 h-3" />} />
                  <Field label="First Name" value={record.first_name} uppercase />
                  <Field label="Date of Birth" value={record.dob} mono icon={<Calendar className="w-3 h-3" />} />
                  <Field label="Place of Issue" value={record.place_of_issue} uppercase icon={<MapPin className="w-3 h-3" />} />
                </div>
              </div>

              {/* Passport section */}
              <div className="space-y-3">
                <SectionTitle title="Passport Metrics" icon={<FileText className="w-3.5 h-3.5" />} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Passport Number" value={record.passport_number} mono />
                  <Field label="Issue Date" value={record.issue_date} mono />
                  <Field label="Expiry Date" value={record.expiry_date} mono />
                  <Field label="Account Email" value={record.account_email} mono={false} />
                </div>
              </div>

              {/* Visa section */}
              {(record.previous_visa_number || record.visa_from || record.visa_to) && (
                <div className="space-y-3">
                  <SectionTitle title="Visa Sticker" icon={<ShieldCheck className="w-3.5 h-3.5" />} />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Visa Number" value={record.previous_visa_number} mono />
                    <Field label="Valid From" value={record.visa_from} mono />
                    <Field label="Valid Until" value={record.visa_to} mono />
                  </div>
                </div>
              )}

              {/* Financial section */}
              <div className="space-y-3">
                <SectionTitle title="Financial Audit" icon={<CreditCard className="w-3.5 h-3.5" />} />
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center">
                    <div className="text-[9px] uppercase font-mono font-bold text-slate-400 tracking-wider">Total</div>
                    <div className="text-sm font-extrabold text-indigo-300 font-mono mt-1">
                      {formatCurrency(price)}
                    </div>
                  </div>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center">
                    <div className="text-[9px] uppercase font-mono font-bold text-slate-400 tracking-wider">Paid</div>
                    <div className="text-sm font-extrabold text-emerald-300 font-mono mt-1">
                      {formatCurrency(versment)}
                    </div>
                  </div>
                  <div
                    className={`bg-slate-900/50 border rounded-xl p-3 text-center ${
                      rest > 0 ? "border-rose-900/50" : "border-emerald-900/50"
                    }`}
                  >
                    <div className="text-[9px] uppercase font-mono font-bold text-slate-400 tracking-wider">Rest</div>
                    <div
                      className={`text-sm font-extrabold font-mono mt-1 ${
                        rest > 0 ? "text-rose-300" : "text-emerald-300"
                      }`}
                    >
                      {formatCurrency(rest)}
                    </div>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-800/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                    style={{ width: `${paidPercent}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 font-mono text-right">
                  {paidPercent.toFixed(0)}% paid
                </div>
              </div>

              {/* Document images */}
              {(record.client_pic || record.visa_pic) && (
                <div className="space-y-3">
                  <SectionTitle title="Scanned Documents" icon={<FileText className="w-3.5 h-3.5" />} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {record.client_pic && (
                      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-2">
                        <div className="text-[10px] text-slate-400 font-mono font-bold uppercase mb-1.5">Portrait</div>
                        <img src={record.client_pic} alt="Portrait" className="w-full h-40 object-contain rounded-lg bg-slate-950" />
                      </div>
                    )}
                    {record.visa_pic && (
                      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-2">
                        <div className="text-[10px] text-slate-400 font-mono font-bold uppercase mb-1.5">Visa Scan</div>
                        <img src={record.visa_pic} alt="Visa" className="w-full h-40 object-contain rounded-lg bg-slate-950" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* QR Code */}
              {qrUrl && (
                <div className="space-y-3">
                  <SectionTitle title="Quick Access QR" icon={<QrCode className="w-3.5 h-3.5" />} />
                  <div className="bg-white p-4 rounded-2xl flex justify-center">
                    <img src={qrUrl} alt="QR Code" className="w-40 h-40" />
                  </div>
                </div>
              )}

              {/* Activity timeline */}
              <div className="space-y-3">
                <SectionTitle title="Activity Timeline" icon={<Activity className="w-3.5 h-3.5" />} />
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-2.5 bg-slate-900/40 border border-slate-800/80 rounded-lg">
                    <div className="p-1.5 bg-emerald-950/40 border border-emerald-900/50 rounded-md shrink-0">
                      <Clock className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px] font-bold text-slate-200">Profile Registered</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {record.created_at ? new Date(record.created_at).toLocaleString() : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2.5 bg-slate-900/40 border border-slate-800/80 rounded-lg">
                    <div className="p-1.5 bg-indigo-950/40 border border-indigo-900/50 rounded-md shrink-0">
                      <User className="w-3 h-3 text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px] font-bold text-slate-200">Handled By</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {record.staff_member || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => onEdit(record)}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md transition"
                >
                  Edit Profile
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
