import React, { useMemo } from "react";
import { motion } from "motion/react";
import { TrendingUp, Users, BarChart3, PieChart as PieIcon } from "lucide-react";
import { ClientRecord, StaffMember } from "../types";
import { formatCurrency } from "../utils/export";

interface ChartsProps {
  clients: ClientRecord[];
  staff: StaffMember[];
}

const palette = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f59e0b",
  "#10b981", "#06b6d4", "#3b82f6", "#a855f7", "#14b8a6",
];

export default function StatisticsCharts({ clients, staff }: ChartsProps) {
  // Category distribution
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    clients.forEach((c) => {
      const key = c.category || "Uncategorized";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [clients]);

  // Staff revenue
  const staffData = useMemo(() => {
    const map: Record<string, { count: number; revenue: number; paid: number }> = {};
    clients.forEach((c) => {
      const key = c.staff_member || "Unassigned";
      if (!map[key]) map[key] = { count: 0, revenue: 0, paid: 0 };
      map[key].count += 1;
      map[key].revenue += parseFloat(c.payment?.price || "0");
      map[key].paid += parseFloat(c.payment?.versment || "0");
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [clients]);

  const maxCategoryCount = Math.max(1, ...categoryData.map((c) => c.value));
  const maxStaffRevenue = Math.max(1, ...staffData.map((s) => s.revenue));

  if (clients.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Category distribution */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-lg"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-950/40 border border-indigo-900/50">
              <PieIcon className="w-4 h-4 text-indigo-300" />
            </div>
            <h3 className="text-sm font-extrabold text-white">Category Distribution</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{categoryData.length} categories</span>
        </div>
        <div className="space-y-2.5">
          {categoryData.map((cat, idx) => {
            const percent = (cat.value / clients.length) * 100;
            return (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: palette[idx % palette.length] }}
                    />
                    <span className="font-mono font-bold text-slate-200">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 font-mono">
                    <span>{cat.value}</span>
                    <span className="text-slate-500">({percent.toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(cat.value / maxCategoryCount) * 100}%` }}
                    transition={{ delay: 0.4 + idx * 0.05, duration: 0.7, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(to right, ${palette[idx % palette.length]}, ${palette[(idx + 1) % palette.length]})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Staff performance */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-lg"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-900/50">
              <BarChart3 className="w-4 h-4 text-emerald-300" />
            </div>
            <h3 className="text-sm font-extrabold text-white">Staff Performance</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">By revenue</span>
        </div>
        <div className="space-y-2.5">
          {staffData.map((sm, idx) => {
            const paidPercent = sm.revenue > 0 ? (sm.paid / sm.revenue) * 100 : 0;
            return (
              <div key={sm.name} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: palette[(idx + 3) % palette.length] }}
                    />
                    <span className="font-bold text-slate-200 uppercase">{sm.name}</span>
                    <span className="text-[9px] text-slate-500 font-mono">({sm.count})</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-slate-400">
                    <span className="text-emerald-300 font-bold">{formatCurrency(sm.paid)}</span>
                    <span className="text-slate-500">/ {formatCurrency(sm.revenue)}</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(sm.revenue / maxStaffRevenue) * 100}%` }}
                    transition={{ delay: 0.45 + idx * 0.05, duration: 0.7, ease: "easeOut" }}
                    className="h-full rounded-full absolute inset-y-0 left-0"
                    style={{
                      background: `linear-gradient(to right, ${palette[(idx + 3) % palette.length]}, ${palette[(idx + 4) % palette.length]})`,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 border-r-2 border-emerald-300"
                    style={{ left: `${(sm.revenue / maxStaffRevenue) * paidPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>Top performer: <span className="text-emerald-300 font-bold">{staffData[0]?.name}</span></span>
          <span>{formatCurrency(staffData[0]?.revenue || 0)}</span>
        </div>
      </motion.div>
    </div>
  );
}
