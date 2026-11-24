import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, ShieldAlert, CheckCircle, CheckCircle2,
  Filter, Search, Check, AlertOctagon, Info, ArrowUpRight
} from 'lucide-react';
import { api } from '../services/api';
import { SchedulingConflict, Roster } from '../types';

export const CoverageConflicts: React.FC = () => {
  const [conflicts, setConflicts] = useState<SchedulingConflict[]>([]);
  const [coverageData, setCoverageData] = useState<any>(null);
  const [latestRoster, setLatestRoster] = useState<Roster | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'conflicts' | 'coverage'>('conflicts');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const rosterList = await api.getRosters();
      if (rosterList.length > 0) {
        const r = rosterList[0];
        setLatestRoster(r);
        const [cList, cov] = await Promise.all([
          api.getRosterConflicts(r.id),
          api.getRosterCoverage(r.id)
        ]);
        setConflicts(cList);
        setCoverageData(cov);
      } else {
        setConflicts([]);
        setCoverageData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (conflictId: number) => {
    if (!latestRoster) return;
    const notes = prompt('Enter resolution justification notes:', 'Approved manager override');
    if (!notes) return;

    try {
      await api.resolveConflict(latestRoster.id, conflictId, notes);
      showToast('Conflict marked as resolved.');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error resolving conflict');
    }
  };

  const filteredConflicts = selectedSeverity === 'ALL'
    ? conflicts
    : conflicts.filter(c => c.severity === selectedSeverity);

  const criticalCount = conflicts.filter(c => c.severity === 'CRITICAL' && !c.resolved).length;
  const warningCount = conflicts.filter(c => c.severity === 'WARNING' && !c.resolved).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Coverage Audit & Conflict Resolution</h1>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              criticalCount > 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {criticalCount > 0 ? `${criticalCount} Critical Gaps` : '100% Validated'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Independent constraint validation inspecting process coverage, employee double-booking, and leave violations.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('conflicts')}
            className={`px-4 py-1.5 rounded-lg transition ${
              activeTab === 'conflicts' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Scheduling Conflicts ({conflicts.length})
          </button>
          <button
            onClick={() => setActiveTab('coverage')}
            className={`px-4 py-1.5 rounded-lg transition ${
              activeTab === 'coverage' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Brand Coverage Matrix
          </button>
        </div>
      </div>

      {activeTab === 'conflicts' ? (
        <div className="space-y-4">
          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map(sev => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedSeverity === sev
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {sev === 'ALL' ? `All Severities (${conflicts.length})` :
                 sev === 'CRITICAL' ? `Critical (${criticalCount})` :
                 sev === 'WARNING' ? `Warnings (${warningCount})` : sev}
              </button>
            ))}
          </div>

          {/* Conflict Items */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {loading ? (
              <div className="p-16 text-center text-slate-400 text-xs">Validating constraints...</div>
            ) : filteredConflicts.length > 0 ? (
              filteredConflicts.map((c) => (
                <div key={c.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/60 transition">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                        c.severity === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {c.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono">{c.date}</span>
                      {c.brand_name && (
                        <span className="text-xs font-semibold text-blue-600">• {c.brand_name}</span>
                      )}
                      {c.process_name && (
                        <span className="text-xs text-slate-600">[{c.process_name}]</span>
                      )}
                      {c.resolved && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 font-medium">{c.explanation}</p>
                    <p className="text-xs text-slate-500 font-normal">
                      <strong>Required:</strong> {c.expected_staffing} | <strong>Actual:</strong> {c.actual_staffing}
                      {c.employee_name && ` | Affected: ${c.employee_name}`}
                    </p>
                    <div className="p-2.5 bg-blue-50/60 rounded-lg text-[11px] text-blue-900 font-medium">
                      <strong>Resolution:</strong> {c.suggested_resolution}
                    </div>
                    {c.resolution_notes && (
                      <p className="text-[11px] text-emerald-700 italic">Audit Note: {c.resolution_notes}</p>
                    )}
                  </div>

                  {!c.resolved && (
                    <button
                      onClick={() => handleResolve(c.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-semibold text-xs border border-slate-200 transition shrink-0"
                    >
                      Resolve Conflict
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="p-16 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                No conflicts match the selected severity filter.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Brand Coverage Matrix Tab */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {coverageData && coverageData.brands ? (
            <div className="divide-y divide-slate-100">
              {coverageData.brands.map((b: any) => (
                <div key={b.brand_id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{b.brand_name} ({b.brand_code})</h3>
                      <p className="text-xs text-slate-400">Pod: {b.pod_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">{b.coverage_percentage}%</span>
                        <p className="text-[10px] text-slate-400">Monthly Coverage</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        b.coverage_percentage >= 99 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                  </div>

                  {/* Processes table */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    {b.processes.map((p: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-slate-800 truncate">{p.process_name}</span>
                          <span className="text-blue-600 font-bold">{p.coverage_pct}%</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Mode: {p.operating_mode} • Slots: {p.covered_slots}/{p.total_required_slots}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 text-center text-slate-400 text-xs">No coverage breakdown data available.</div>
          )}
        </div>
      )}
    </div>
  );
};
