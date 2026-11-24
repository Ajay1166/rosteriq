import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Store, Workflow, Network, CheckCircle2,
  CalendarCheck, Clock, AlertOctagon, ArrowUpRight,
  TrendingUp, Calendar, AlertTriangle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { api } from '../services/api';

const COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#1E40AF'];

export const Overview: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = () => {
    setLoading(true);
    api.getDashboardAnalytics()
      .then(res => setData(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  if (loading || !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Computing live operational analytics from database...</p>
        </div>
      </div>
    );
  }

  const m = data.metrics || {};

  const statCards = [
    { label: 'Total Employees', value: m.total_employees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', link: '/employees' },
    { label: 'Active Brands', value: m.active_brands, icon: Store, color: 'text-indigo-600', bg: 'bg-indigo-50', link: '/brands' },
    { label: 'Active Processes', value: m.active_processes, icon: Workflow, color: 'text-sky-600', bg: 'bg-sky-50', link: '/processes' },
    { label: 'Operational Pods', value: m.operational_pods, icon: Network, color: 'text-purple-600', bg: 'bg-purple-50', link: '/pods' },
    {
      label: 'Month Coverage',
      value: `${m.current_month_coverage_pct}%`,
      sub: 'Covered / Required Staffing Slots',
      icon: CheckCircle2,
      color: m.current_month_coverage_pct >= 98 ? 'text-emerald-600' : 'text-amber-600',
      bg: m.current_month_coverage_pct >= 98 ? 'bg-emerald-50' : 'bg-amber-50',
      link: '/conflicts'
    },
    { label: 'Working Shifts', value: m.scheduled_working_days, icon: CalendarCheck, color: 'text-slate-700', bg: 'bg-slate-100', link: '/planner' },
    { label: 'Pending Leaves', value: m.pending_leave_requests, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', link: '/availability' },
    {
      label: 'Critical Conflicts',
      value: m.open_critical_conflicts,
      sub: m.open_critical_conflicts > 0 ? 'Requires attention' : 'Zero gaps',
      icon: AlertOctagon,
      color: m.open_critical_conflicts > 0 ? 'text-red-600' : 'text-emerald-600',
      bg: m.open_critical_conflicts > 0 ? 'bg-red-50' : 'bg-emerald-50',
      link: '/conflicts'
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30">
              Operations Control
            </span>
            <span className="text-xs text-slate-400">December 2026 Shift Cycle</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Workforce Scheduling Command Center</h1>
          <p className="text-slate-300 text-xs mt-1 max-w-xl">
            Deterministic rule-driven allocation across 25 D2C brands, process-level coverage constraints, and real-time conflict validation.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/planner')}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-xs text-white shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Open Roster Planner
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-xs text-slate-200 border border-slate-700 transition flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Impact Analyzer
          </button>
        </div>
      </div>

      {/* 8 Primary Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={() => navigate(card.link)}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 group-hover:text-blue-600 transition truncate">
                  {card.label}
                </span>
                <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {card.value}
              </div>
              {card.sub && (
                <p className="text-[11px] text-slate-400 mt-1 truncate">{card.sub}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pod-wise Employee Staffing */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pod-Wise Employee Distribution</h3>
              <p className="text-xs text-slate-500">6 employees dedicated per operational pod</p>
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">5 Pods</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.pod_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={40} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value) => [`${value} Employees`, 'Headcount']} />
                <Bar dataKey="employees" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Process-Wise Staffing Capacity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Process-Wise Resource Allocations</h3>
              <p className="text-xs text-slate-500">Total qualified employee assignments per process</p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">7 Processes</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.process_distribution} layout="vertical" margin={{ top: 10, right: 20, left: 30, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="code" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name, item) => [`${value} Allocations`, item.payload.name]} />
                <Bar dataKey="staffing" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Critical Coverage Gaps & Upcoming Leaves */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Critical Coverage Gaps (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Critical Coverage Gaps</h3>
                <p className="text-xs text-slate-500">Operating brand processes failing minimum headcount requirement</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/conflicts')}
              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              View All ({data.critical_gaps?.length || 0}) <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            {data.critical_gaps && data.critical_gaps.length > 0 ? (
              data.critical_gaps.map((gap: any) => (
                <div key={gap.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700">
                        {gap.brand_name}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{gap.process_name}</span>
                      <span className="text-xs text-slate-400">• {gap.date}</span>
                    </div>
                    <p className="text-xs text-slate-600">{gap.explanation}</p>
                    <p className="text-[11px] text-blue-600 font-medium">Suggestion: {gap.suggested_resolution}</p>
                  </div>
                  <button
                    onClick={() => navigate('/settings')}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs shrink-0"
                  >
                    Solve via Impact
                  </button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                No critical coverage gaps found in current roster cycle!
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Employee Leaves (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Upcoming Leaves</h3>
              <p className="text-xs text-slate-500">Planned & approved absence calendar</p>
            </div>
            <button
              onClick={() => navigate('/availability')}
              className="text-xs text-blue-600 font-semibold hover:underline"
            >
              Manage
            </button>
          </div>

          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            {data.upcoming_leaves && data.upcoming_leaves.length > 0 ? (
              data.upcoming_leaves.map((leave: any) => (
                <div key={leave.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-800">{leave.employee_name}</p>
                    <p className="text-[11px] text-slate-500">{leave.date} • {leave.type}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    leave.approval_status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {leave.approval_status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No upcoming leaves scheduled.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
