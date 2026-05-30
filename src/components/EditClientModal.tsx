import React, { useState, useEffect } from "react";
import {
  X,
  User,
  CreditCard,
  Phone,
  Check,
  Calendar,
  AlertTriangle,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { ClientRecord, ConfigPrice, StaffMember } from "../types";

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: ClientRecord | null;
  configPrices: ConfigPrice[];
  staffMembers: StaffMember[];
  onSaveEdit: (id: string, updatedFields: Partial<ClientRecord>) => Promise<{ success: boolean; simulated: boolean; message: string; error?: string }>;
  showToast: (msg: string) => void;
}

export default function EditClientModal({
  isOpen,
  onClose,
  record,
  configPrices,
  staffMembers,
  onSaveEdit,
  showToast,
}: EditClientModalProps) {
  if (!isOpen || !record) return null;

  // Form states initialized from the current record values
  const [firstName, setFirstName] = useState(record.first_name || "");
  const [lastName, setLastName] = useState(record.last_name || "");
  const [passportNumber, setPassportNumber] = useState(record.passport_number || "");
  const [dob, setDob] = useState(record.dob || "");
  const [phoneNumber, setPhoneNumber] = useState(record.phone_number || "");
  const [selectedStaff, setSelectedStaff] = useState(record.staff_member || "");
  const [category, setCategory] = useState(record.category || "");
  const [versment, setVersment] = useState(record.payment?.versment || "0");
  
  // Other fields carried over
  const [issueDate, setIssueDate] = useState(record.issue_date || "");
  const [expiryDate, setExpiryDate] = useState(record.expiry_date || "");
  const [placeOfIssue, setPlaceOfIssue] = useState(record.place_of_issue || "");
  const [previousVisaNumber, setPreviousVisaNumber] = useState(record.previous_visa_number || "");
  const [visaFrom, setVisaFrom] = useState(record.visa_from || "");
  const [visaTo, setVisaTo] = useState(record.visa_to || "");

  // Status/submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Sync state if record changes
  useEffect(() => {
    if (record) {
      setFirstName(record.first_name || "");
      setLastName(record.last_name || "");
      setPassportNumber(record.passport_number || "");
      setDob(record.dob || "");
      setPhoneNumber(record.phone_number || "");
      setSelectedStaff(record.staff_member || "");
      setCategory(record.category || "");
      setVersment(record.payment?.versment || "0");
      setIssueDate(record.issue_date || "");
      setExpiryDate(record.expiry_date || "");
      setPlaceOfIssue(record.place_of_issue || "");
      setPreviousVisaNumber(record.previous_visa_number || "");
      setVisaFrom(record.visa_from || "");
      setVisaTo(record.visa_to || "");
    }
  }, [record]);

  // Read pricing for the active category
  const activePricing = configPrices.find((p) => p.category === category);
  const currentPrice = activePricing ? activePricing.price : "16";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !passportNumber.trim()) {
      setErrorMessage("Full Name and Passport Number are strictly required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    // Prepare updated fields matching ClientRecord/ClientData structure
    const updatedFields: Partial<ClientRecord> = {
      first_name: firstName.toUpperCase().trim(),
      last_name: lastName.toUpperCase().trim(),
      passport_number: passportNumber.toUpperCase().trim(),
      dob,
      phone_number: phoneNumber.trim(),
      staff_member: selectedStaff,
      category,
      payment: {
        category,
        price: currentPrice,
        currency: "M",
        versment,
      },
      issue_date: issueDate,
      expiry_date: expiryDate,
      place_of_issue: placeOfIssue.toUpperCase().trim(),
      previous_visa_number: previousVisaNumber.toUpperCase().trim(),
      visa_from: visaFrom,
      visa_to: visaTo,
    };

    try {
      const response = await onSaveEdit(record.id, updatedFields);
      if (response.success) {
        showToast("Profile updated and synced successfully.");
        onClose();
      } else {
        setErrorMessage(response.error || response.message || "An error occurred while saving updates.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
      {/* Background Mask */}
      <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={onClose} />

      {/* Main Modal container */}
      <div className="relative w-full max-w-2xl bg-[#0f172a] rounded-2xl shadow-xl border border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[95vh] sm:max-h-[90vh] z-10">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-950/50 text-indigo-400 rounded-lg">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-[#f1f5f9] text-sm sm:text-base leading-tight">
                Edit Client Registry Profile
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                Updating passport: {record.passport_number || "PENDING"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 px-1.5 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white transition rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Scrollable content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 flex flex-col text-xs bg-[#0f172a]">
          <div className="p-4 sm:p-6 space-y-4">
            
            {/* Error Banner */}
            {errorMessage && (
              <div className="bg-rose-950/20 border-l-4 border-rose-500 rounded-r-lg p-3 flex items-start gap-3 text-[11px] text-rose-300 border border-y-rose-950/30 border-r-rose-950/30">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.25" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Profile/Identity Field Set */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
              <h4 className="font-bold text-slate-200 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Identity Details
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Last name */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Family Name (Last Name)</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="E.G. BARRY"
                    className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] text-white outline-none uppercase font-semibold focus:border-indigo-500"
                    required
                  />
                </div>

                {/* First name */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">First Name (Given Name)</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="E.G. MOSTAPHA YOUCEF"
                    className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] text-white outline-none uppercase font-semibold focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Passport Number */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Passport Number</label>
                  <input
                    type="text"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value)}
                    placeholder="E.G. DZ9845129"
                    className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] text-white outline-none uppercase font-mono font-bold focus:border-indigo-500"
                    required
                  />
                </div>

                {/* DOB */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] text-white outline-none font-mono focus:border-indigo-500"
                  />
                </div>

                {/* Phone Number */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Phone Number</label>
                  <div className="relative flex items-center">
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+213 555 12 34 56"
                      className="w-full p-2 pl-9 sm:p-2.5 sm:pl-9 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] text-white outline-none font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Config & Financial Field Set */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
              <h4 className="font-bold text-slate-200 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" /> Category & Financial Audits
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Category Selection */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Visa Service Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-slate-200 focus:bg-[#111a2e] outline-none"
                  >
                    {configPrices.map((cp) => (
                      <option key={cp.id} value={cp.category} className="bg-slate-950 text-slate-200">
                        {cp.category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Price (Automated) */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-400">Rated Service Price</label>
                  <div className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg font-mono font-extrabold text-slate-300 flex items-center justify-between">
                    <span>{currentPrice} Millions</span>
                    <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.25 rounded">AUTO</span>
                  </div>
                </div>

                {/* Paid Versment */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Versment (Amount Paid)</label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={versment}
                      onChange={(e) => setVersment(e.target.value)}
                      placeholder="0"
                      className="w-full p-2 pr-12 sm:p-2.5 sm:pr-12 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] outline-none font-mono font-bold text-emerald-400"
                    />
                    <span className="absolute right-3.5 text-[10px] font-bold text-slate-500 font-mono">M (DZD)</span>
                  </div>
                </div>
              </div>

              {/* Staff chooser */}
              <div className="flex flex-col gap-1 pt-1">
                <label className="font-bold text-slate-355 text-slate-300">Registered By (Staff Representative)</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-slate-200 focus:bg-[#111a2e] outline-none"
                >
                  {staffMembers.map((sm) => (
                    <option key={sm.id} value={sm.id} className="bg-slate-950 text-slate-200">
                      {sm.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Passport & Visa Extras Set */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
              <h4 className="font-bold text-slate-200 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Additional Passport / Visa Metrics
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] text-white outline-none font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] text-white outline-none font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Place of Issue</label>
                  <input
                    type="text"
                    value={placeOfIssue}
                    onChange={(e) => setPlaceOfIssue(e.target.value)}
                    placeholder="E.G. ALGIERS"
                    className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] text-white outline-none uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Previous Visa Number</label>
                  <input
                    type="text"
                    value={previousVisaNumber}
                    onChange={(e) => setPreviousVisaNumber(e.target.value)}
                    placeholder="E.G. EU74819032"
                    className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] text-white outline-none font-mono uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Visa Duration From</label>
                  <input
                    type="date"
                    value={visaFrom}
                    onChange={(e) => setVisaFrom(e.target.value)}
                    className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] text-white outline-none font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-350">Visa Duration To</label>
                  <input
                    type="date"
                    value={visaTo}
                    onChange={(e) => setVisaTo(e.target.value)}
                    className="p-2 sm:p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:bg-[#111a2e] text-white outline-none font-mono"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Modal Footer */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-800 bg-slate-900/50 flex justify-end items-center gap-2 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:bg-slate-850 hover:text-white rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-extrabold text-white bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-300 rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Save Profile Edits
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
