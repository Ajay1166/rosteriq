import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, ShieldAlert, CheckCircle, CheckCircle2,
  Filter, Search, Check, AlertOctagon, Info, ArrowUpRight,
  RefreshCw, ShieldCheck, X, FileText, ChevronRight, Play
} from 'lucide-react';
import { api } from '../services/api';
import { SchedulingConflict, Roster, Pod, Employee, Brand, Process } from '../types';

export const CoverageConflicts: React.FC = () => {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null);
  const [selectedRoster, setSelectedRoster] = useState<Roster | null>(null);

  const [conflicts, setConflicts] = useState<SchedulingConflict[]>([]);
  const [coverageData, setCoverageData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Metadata for filters
  const [pods, setPods] = useState<Pod[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);

  // Filter States
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterPodId, setFilterPodId] = useState<string>('ALL');
  const [filterBrandId, setFilterBrandId] = useState<string>('ALL');
  const [filterProcessId, setFilterProcessId] = useState<string>('ALL');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const [activeTab, setActiveTab] = useState<'conflicts' | 'coverage'>('conflicts');
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Resolution & Details Modal
  const [detailModal, setDetailModal] = useState<SchedulingConflict | null>(null);
  const [resolveNotes, setResolveNotes] = useState<string>('');

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
    confirmText: string;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: '',
    description: '',
    action: async () => {},
    confirmText: 'Confirm',
    isDestructive: false
  });

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    // Load metadata
    Promise.all([
      api.getPods().catch(() => []),
      api.getEmployees().catch(() => []),
      api.getBrands().catch(() => []),
      api.getProcesses().catch(() => []),
      api.getRosters()
    ]).then(([pList, eList, bList, prList, rList]) => {
      setPods(pList);
      setEmployees(eList);
      setBrands(bList);
      setProcesses(prList);
      setRosters(rList);
      if (rList.length > 0) {
        setSelectedRosterId(rList[0].id);
        setSelectedRoster(rList[0]);
      } else {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedRosterId) {
      loadRosterDetails(selectedRosterId);
    }
  }, [selectedRosterId, filterSeverity, filterPodId, filterBrandId, filterProcessId, filterEmployeeId, filterCategory]);

  const loadRosterDetails = async (rosterId: number) => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterSeverity !== 'ALL') params.severity = filterSeverity;
      if (filterPodId !== 'ALL') params.pod_id = Number(filterPodId);
      if (filterBrandId !== 'ALL') params.brand_id = Number(filterBrandId);
      if (filterProcessId !== 'ALL') params.process_id = Number(filterProcessId);
      if (filterEmployeeId !== 'ALL') params.employee_id = Number(filterEmployeeId);
      if (filterCategory !== 'ALL') params.category = filterCategory;

      const [cList, cov, freshRosters] = await Promise.all([
        api.getRosterConflicts(rosterId, params),
        api.getRosterCoverage(rosterId),
        api.getRosters()
      ]);

      setConflicts(cList);
      setCoverageData(cov);
      setRosters(freshRosters);
      const curr = freshRosters.find(r => r.id === rosterId);
      if (curr) setSelectedRoster(curr);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to load roster conflicts');
    } finally {
      setLoading(false);
    }
  };

  // Revalidate action
  const handleRevalidate = async () => {
    if (!selectedRosterId) return;
    setActionLoading(true);
    try {
      const res = await api.validateRoster(selectedRosterId);
      showToast('info', `Independent validation finished: ${res.validation_status} with ${res.critical_conflicts} critical gaps (${res.coverage_percentage}% coverage).`);
      loadRosterDetails(selectedRosterId);
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Revalidation failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Clear Previous Validation Results action
  const handleClearResults = () => {
    if (!selectedRosterId) return;
    setConfirmModal({
      isOpen: true,
      title: 'Clear Previous Validation Results?',
      description: 'This will purge all stale or duplicate un-resolved validation conflict records for this roster version. Active employee assignments, master brand configs, and holiday rules will remain completely untouched.',
      confirmText: 'Clear Validation Results',
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          const res = await api.clearRosterConflicts(selectedRosterId);
          showToast('success', res.message || 'Validation results cleared.');
          loadRosterDetails(selectedRosterId);
        } catch (err: any) {
          showToast('error', err.response?.data?.detail || 'Failed to clear validation results');
        } finally {
          setActionLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Reset Draft Roster action
  const handleResetDraft = () => {
    if (!selectedRoster || !selectedRosterId) return;
    if (selectedRoster.status === 'Published') {
      showToast('error', 'Cannot reset a published roster. Published rosters are immutable operational history.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Reset Draft Roster?',
      description: `Reset Version ${selectedRoster.version} back to an empty draft slate? All draft shift allocations and conflict records will be cleared. Published rosters are never touched.`,
      confirmText: 'Reset Draft',
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          const res = await api.resetDraftRoster(selectedRosterId);
          showToast('success', res.message || 'Draft roster reset to blank slate.');
          loadRosterDetails(selectedRosterId);
        } catch (err: any) {
          showToast('error', err.response?.data?.detail || 'Failed to reset draft roster');
        } finally {
          setActionLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Publish Roster action
  const handlePublishRoster = () => {
    if (!selectedRoster || !selectedRosterId) return;
    if (selectedRoster.status === 'Published') {
      showToast('info', 'This roster version is already published.');
      return;
    }
    if ((selectedRoster.critical_conflicts || 0) > 0) {
      showToast('error', `Cannot publish: ${selectedRoster.critical_conflicts} critical gaps must be resolved.`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Publish Final Roster Version?',
      description: `Confirm publishing Version ${selectedRoster.version}? This validates 100% of critical constraints, locks shifts for operation, and creates a permanent historical version record.`,
      confirmText: 'Publish & Lock Version',
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await api.publishRoster(selectedRosterId, 'Aditi Deshmukh');
          showToast('success', 'Roster published successfully! Schedule is now locked.');
          loadRosterDetails(selectedRosterId);
        } catch (err: any) {
          showToast('error', err.response?.data?.detail || 'Publication rejected. Critical conflicts must be resolved.');
        } finally {
          setActionLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Resolve conflict action
  const handleResolveSubmit = async () => {
    if (!selectedRosterId || !detailModal) return;
    setActionLoading(true);
    try {
      await api.resolveConflict(selectedRosterId, detailModal.id, resolveNotes || 'Approved operational exception');
      showToast('success', `Conflict on ${detailModal.date} resolved.`);
      setDetailModal(null);
      setResolveNotes('');
      loadRosterDetails(selectedRosterId);
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Error resolving conflict');
    } finally {
      setActionLoading(false);
    }
  };

  const criticalCount = conflicts.filter(c => c.severity === 'CRITICAL' && !c.resolved).length;
  const warningCount = conflicts.filter(c => c.severity === 'WARNING' && !c.resolved).length;
  const resolvedCount = conflicts.filter(c => c.resolved).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-white text-xs font-semibold shadow-xl flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">Coverage Audit & Conflict Center</h1>
              {selectedRoster && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  selectedRoster.status === 'Published'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedRoster.status === 'Needs Attention'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                }`}>
                  {selectedRoster.status} (v{selectedRoster.version})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Deterministic constraint validation: isolates hard coverage violations, approved leave conflicts, double booking, and preferred weekly off overrides.
            </p>
          </div>

          {/* Roster Version Selector & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Version / Month Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Active Roster:</label>
              <select
                value={selectedRosterId || ''}
                onChange={(e) => setSelectedRosterId(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                {rosters.map(r => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.year, r.month - 1).toLocaleString('default', { month: 'short' })} {r.year} – Version {r.version} ({r.status})
                  </option>
                ))}
              </select>
            </div>

            {selectedRoster && (
              <>
                <button
                  onClick={handleRevalidate}
                  disabled={actionLoading}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition flex items-center gap-1.5"
                  title="Run independent validation pass"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Revalidate
                </button>

                <button
                  onClick={handleClearResults}
                  disabled={actionLoading}
                  className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-200 transition flex items-center gap-1.5"
                  title="Clear unresolved validation conflicts for this roster"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
                  Clear Results
                </button>

                {selectedRoster.status !== 'Published' && (
                  <button
                    onClick={handleResetDraft}
                    disabled={actionLoading}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition flex items-center gap-1.5"
                    title="Reset draft assignments to blank slate"
                  >
                    <X className="w-3.5 h-3.5 text-rose-600" />
                    Reset Draft
                  </button>
                )}

                <button
                  onClick={handlePublishRoster}
                  disabled={actionLoading || selectedRoster.status === 'Published' || (selectedRoster.critical_conflicts || 0) > 0}
                  className={`px-3.5 py-2 rounded-xl font-semibold text-xs shadow-md transition flex items-center gap-1.5 ${
                    selectedRoster.status === 'Published'
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : (selectedRoster.critical_conflicts || 0) > 0
                        ? 'bg-red-50 text-red-600 border border-red-200 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                  }`}
                  title={
                    selectedRoster.status === 'Published'
                      ? 'Roster is already published'
                      : (selectedRoster.critical_conflicts || 0) > 0
                        ? `Cannot publish: ${selectedRoster.critical_conflicts} critical gaps must be resolved`
                        : 'Publish and lock this roster version'
                  }
                >
                  <CheckCircle className="w-4 h-4" />
                  {selectedRoster.status === 'Published' ? 'Published' : 'Publish Roster'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 block">Total Active Conflicts</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{conflicts.length}</span>
            <span className="text-[10px] text-slate-400">Associated with current version</span>
          </div>

          <div className="p-3.5 rounded-xl bg-red-50/60 border border-red-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-red-700 block">Hard Conflicts (Critical)</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-200 text-red-800">Blocks Publishing</span>
            </div>
            <span className="text-xl font-bold text-red-700 mt-1 block">{criticalCount}</span>
            <span className="text-[10px] text-red-600">Coverage gaps, leaves & double bookings</span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-700 block">Soft Guidelines (Warnings)</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-200 text-amber-800">Advisory</span>
            </div>
            <span className="text-xl font-bold text-amber-700 mt-1 block">{warningCount}</span>
            <span className="text-[10px] text-amber-600">Preferred weekly off overrides & workload</span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-700 block">Resolved / Overridden</span>
            <span className="text-xl font-bold text-emerald-700 mt-1 block">{resolvedCount}</span>
            <span className="text-[10px] text-emerald-600">Documented operational overrides</span>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('conflicts')}
              className={`px-4 py-1.5 rounded-lg transition ${
                activeTab === 'conflicts' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Conflict Stream ({conflicts.length})
            </button>
            <button
              onClick={() => setActiveTab('coverage')}
              className={`px-4 py-1.5 rounded-lg transition ${
                activeTab === 'coverage' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Brand Coverage Audit Matrix
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'conflicts' ? (
        <div className="space-y-4">
          {/* Detailed Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Multi-Dimensional Conflict Filters</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 text-xs">
              {/* Severity */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Severity</label>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium"
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">Critical (Hard)</option>
                  <option value="WARNING">Warning (Soft)</option>
                </select>
              </div>

              {/* Conflict Category */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium"
                >
                  <option value="ALL">All Categories</option>
                  <option value="coverage">Coverage Gap</option>
                  <option value="leave">Approved Leave / Off</option>
                  <option value="weekly_off">Weekly Off Violation</option>
                  <option value="double_booking">Double Booking</option>
                  <option value="workload">Excessive Workload</option>
                </select>
              </div>

              {/* Pod */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Pod</label>
                <select
                  value={filterPodId}
                  onChange={(e) => setFilterPodId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium"
                >
                  <option value="ALL">All Pods</option>
                  {pods.map(p => (
                    <option key={p.id} value={p.id}>{p.pod_name}</option>
                  ))}
                </select>
              </div>

              {/* Brand */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Brand</label>
                <select
                  value={filterBrandId}
                  onChange={(e) => setFilterBrandId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium"
                >
                  <option value="ALL">All Brands</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Process */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Process</label>
                <select
                  value={filterProcessId}
                  onChange={(e) => setFilterProcessId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium"
                >
                  <option value="ALL">All Processes</option>
                  {processes.map(pr => (
                    <option key={pr.id} value={pr.id}>{pr.name}</option>
                  ))}
                </select>
              </div>

              {/* Employee */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Employee</label>
                <select
                  value={filterEmployeeId}
                  onChange={(e) => setFilterEmployeeId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium"
                >
                  <option value="ALL">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Conflict Items List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {loading ? (
              <div className="p-16 text-center text-slate-400 text-xs">Validating constraints and evaluating conflicts...</div>
            ) : conflicts.length > 0 ? (
              conflicts.map((c) => (
                <div key={c.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/60 transition">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                        c.severity === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {c.severity === 'CRITICAL' ? 'HARD CONFLICT' : 'SOFT WARNING'}
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono">{c.date}</span>
                      {c.brand_name && (
                        <span className="text-xs font-semibold text-blue-600">• {c.brand_name}</span>
                      )}
                      {c.process_name && (
                        <span className="text-xs text-slate-600">[{c.process_name}]</span>
                      )}
                      {c.employee_name && (
                        <span className="text-xs font-medium text-slate-700">({c.employee_name})</span>
                      )}
                      {c.resolved && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 font-medium">{c.explanation}</p>
                    <p className="text-xs text-slate-500 font-normal">
                      <strong>Expected Staffing:</strong> {c.expected_staffing} | <strong>Actual:</strong> {c.actual_staffing}
                    </p>
                    <div className="p-2.5 bg-blue-50/60 rounded-lg text-[11px] text-blue-900 font-medium">
                      <strong>Suggested Resolution:</strong> {c.suggested_resolution}
                    </div>
                    {c.resolution_notes && (
                      <p className="text-[11px] text-emerald-700 italic">Audit Note: {c.resolution_notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setDetailModal(c);
                        setResolveNotes(c.resolution_notes || '');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                    >
                      View Details
                    </button>
                    {!c.resolved && (
                      <button
                        onClick={() => {
                          setDetailModal(c);
                          setResolveNotes('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-16 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">No conflicts found matching current filters.</p>
                <p className="text-slate-400 mt-1">All operating constraints for this criteria are fully validated.</p>
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
                      <p className="text-xs text-slate-400">Operational Pod: {b.pod_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">{b.coverage_percentage}%</span>
                        <p className="text-[10px] text-slate-400">Monthly Coverage SLA</p>
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
                          Mode: {p.operating_mode} • Covered: {p.covered_slots}/{p.total_required_slots} slots
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 text-center text-slate-400 text-xs">No coverage breakdown data available for this roster.</div>
          )}
        </div>
      )}

      {/* Conflict Details & Resolution Modal */}
      {detailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  detailModal.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {detailModal.severity}
                </span>
                <h3 className="font-bold text-slate-900 text-sm">Conflict Inspection</h3>
              </div>
              <button onClick={() => setDetailModal(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Date:</span>
                  <span className="text-slate-900 font-bold">{detailModal.date}</span>
                </div>
                {detailModal.brand_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Brand:</span>
                    <span className="text-blue-600 font-bold">{detailModal.brand_name}</span>
                  </div>
                )}
                {detailModal.process_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Process:</span>
                    <span className="text-slate-900 font-bold">{detailModal.process_name}</span>
                  </div>
                )}
                {detailModal.employee_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Employee:</span>
                    <span className="text-slate-900 font-bold">{detailModal.employee_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Staffing Gap:</span>
                  <span className="text-slate-900 font-medium">Expected: {detailModal.expected_staffing} / Actual: {detailModal.actual_staffing}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Violation Explanation</label>
                <p className="p-2.5 rounded-lg bg-red-50/50 border border-red-100 text-red-900 leading-relaxed font-medium">
                  {detailModal.explanation}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Engine Suggested Resolution</label>
                <p className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 text-blue-900 leading-relaxed font-medium">
                  {detailModal.suggested_resolution}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Operational Resolution Justification</label>
                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Enter manager override justification (e.g. 'Cross-brand allocation adjusted', 'Approved emergency backup coverage')."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setDetailModal(null)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-200 transition"
              >
                Close
              </button>
              <button
                onClick={handleResolveSubmit}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
              >
                Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-xl ${confirmModal.isDestructive ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                  {confirmModal.isDestructive ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                </div>
                <h3 className="text-base font-bold text-slate-900">{confirmModal.title}</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                {confirmModal.description}
              </p>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmModal.action}
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition flex items-center gap-1.5 ${
                    confirmModal.isDestructive
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                  }`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};