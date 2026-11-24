import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Store,
  Workflow,
  Network,
  Split,
  CalendarOff,
  Sun,
  AlertTriangle,
  FileSpreadsheet,
  Settings,
  Bell,
  ChevronDown,
  Layers,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Roster Planner', href: '/planner', icon: CalendarDays },
  { name: 'Employees', href: '/employees', icon: Users },
  { name: 'Brands', href: '/brands', icon: Store },
  { name: 'Processes', href: '/processes', icon: Workflow },
  { name: 'Pods & Teams', href: '/pods', icon: Network },
  { name: 'Resource Allocation', href: '/allocation', icon: Split },
  { name: 'Availability & Leaves', href: '/availability', icon: CalendarOff },
  { name: 'Holidays', href: '/holidays', icon: Sun },
  { name: 'Coverage & Conflicts', href: '/conflicts', icon: AlertTriangle },
  { name: 'Reports & Exports', href: '/reports', icon: FileSpreadsheet },
  { name: 'Settings & Simulation', href: '/settings', icon: Settings },
];

export const DashboardLayout: React.FC = () => {
  const [criticalCount, setCriticalCount] = useState<number>(0);
  const location = useLocation();

  useEffect(() => {
    api.getDashboardAnalytics()
      .then(data => {
        setCriticalCount(data.metrics?.open_critical_conflicts || 0);
      })
      .catch(() => {});
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Dark Navy Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col z-20 shadow-xl border-r border-slate-800">
        {/* Logo & Product Brand */}
        <div className="h-16 flex items-center px-6 bg-slate-950/80 border-b border-slate-800/80 gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">RosterIQ</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-900/80 text-blue-300 border border-blue-700/50">v1.0</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Workforce OS</p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Operations Console
          </div>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.name}</span>
                {item.name === 'Coverage & Conflicts' && criticalCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white animate-pulse">
                    {criticalCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Demo Mode Notice */}
        <div className="p-3.5 m-3 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>DEMO ENVIRONMENT</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            30 employees & 25 brands seeded with real constraint rules.
          </p>
        </div>

        {/* User Card */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs ring-2 ring-blue-500/30">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">Aditi Deshmukh</p>
            <p className="text-[10px] text-slate-400 truncate">Lead Ops Manager</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Scheduler Engine Active
            </span>
          </div>

          <div className="flex items-center gap-4">
            {criticalCount > 0 ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span>{criticalCount} Critical Conflict{criticalCount > 1 ? 's' : ''} Detected</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                <span>All Constraints Satisfied</span>
              </div>
            )}

            <button
              onClick={() => window.location.href = '/conflicts'}
              className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {criticalCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500"></span>
              )}
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
