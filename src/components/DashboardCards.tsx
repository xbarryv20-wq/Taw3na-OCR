import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Users, DollarSign, AlertCircle, CheckCircle2, TrendingUp, Calendar, UserCheck } from "lucide-react";
import { ClientRecord, StaffMember } from "../types";
import { formatCurrency } from "../utils/export";

interface DashboardCardsProps {
  clients: ClientRecord[];
  staff: StaffMember[];
}

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 700;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (value - start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <span>{Math.round(display).toLocaleString()}{suffix}</span>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "indigo",
  trend,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  color?: "indigo" | "emerald" | "rose" | "amber" | "cyan";
  trend?: string;
  delay?: number;
}) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-500/20 to-indigo-600/5 border-indigo-500/30 text-indigo-300",
    emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-300",
    rose: "from-rose-500/20 to-rose-600/5 border-rose-500/30 text-rose-300",
    amber: "from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-300",
    cyan: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30 text-cyan-300",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colors[color]} p-4 sm:p-5 shadow-lg`}
    >
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono">
            {label}
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 truncate">
            {value}
          </div>
          {sub && <div className="text-[10px] text-slate-300/80 mt-1.5 font-mono">{sub}</div>}
        </div>
        <div className={`p-2 rounded-xl border ${colors[color]} bg-slate-900/40 shrink-0`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-emerald-300/90 font-mono">
          <TrendingUp className="w-3 h-3" /> {trend}
        </div>
      )}
    </motion.div>
  );
}

export default function DashboardCards({ clients, staff }: DashboardCardsProps) {
  const totalRevenue = clients.reduce((sum, c) => sum + parseFloat(c.payment?.price || "0"), 0);
  const totalPaid = clients.reduce((sum, c) => sum + parseFloat(c.payment?.versment || "0"), 0);
  const totalRest = Math.max(0, totalRevenue - totalPaid);
  const fullyPaid = clients.filter((c) => {
    const p = parseFloat(c.payment?.price || "0");
    const v = parseFloat(c.payment?.versment || "0");
    return p > 0 && v >= p;
  }).length;
  const outstanding = clients.length - fullyPaid;

  // Last 7 days
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const last7 = clients.filter((c) => c.created_at && new Date(c.created_at).getTime() > sevenDaysAgo).length;

  // Top staff
  const staffCount: Record<string, number> = {};
  clients.forEach((c) => {
    if (c.staff_member) {
      staffCount[c.staff_member] = (staffCount[c.staff_member] || 0) + 1;
    }
  });
  const topStaff = Object.entries(staffCount).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <StatCard
        icon={Users}
        label="Total Clients"
        value={<AnimatedNumber value={clients.length} />}
        sub={`${last7} new in last 7 days`}
        color="indigo"
        delay={0}
      />
      <StatCard
        icon={DollarSign}
        label="Total Revenue"
        value={formatCurrency(totalRevenue)}
        sub={`${formatCurrency(totalPaid)} collected`}
        color="emerald"
        delay={0.05}
      />
      <StatCard
        icon={AlertCircle}
        label="Outstanding"
        value={formatCurrency(totalRest)}
        sub={`${outstanding} clients with balance`}
        color="rose"
        delay={0.1}
      />
      <StatCard
        icon={CheckCircle2}
        label="Fully Paid"
        value={<AnimatedNumber value={fullyPaid} />}
        sub={`${outstanding} pending payment`}
        color={fullyPaid > 0 ? "emerald" : "amber"}
        delay={0.15}
      />
      <StatCard
        icon={UserCheck}
        label="Active Staff"
        value={<AnimatedNumber value={staff.length} />}
        sub={topStaff ? `Top: ${topStaff[0]} (${topStaff[1]} clients)` : "No staff assigned"}
        color="cyan"
        delay={0.2}
      />
      <StatCard
        icon={Calendar}
        label="Avg Ticket"
        value={
          clients.length > 0
            ? formatCurrency(totalRevenue / clients.length)
            : formatCurrency(0)
        }
        sub="Per client"
        color="amber"
        delay={0.25}
      />
    </div>
  );
}
