import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckCircle, AlertTriangle, ShieldCheck, Download,
  RefreshCw, Play, Filter, Layers, Users, Store, Workflow,
  X, Check, Info, FileSpreadsheet, AlertOctagon
} from 'lucide-react';
import { api } from '../services/api';
import { Roster, RosterGridResponse, GridRow, GridCell, Pod, Brand } from '../types';

export const RosterPlanner: React.FC = () => {
  const [month, setMonth] = useState<number>(12);
  const [year, setYear] = useState<number>(2026);
  const [selectedPod, setSelectedPod] = useState<string>('ALL');
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<string>('company'); // company, pod, brand, process, employee

  const [rosters, setRosters] = useState<Roster[]>([]);
  const [currentRoster, setCurrentRoster] = useState<Roster | null>(null);
  const [gridData, setGridData] = useState<RosterGridResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const [pods, setPods] = useState<Pod[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Manual Edit Cell Modal State
  const [editingCell, setEditingCell] = useState<{
    employeeName: string;
    employeeId: number;
    cell: GridCell;
  } | null>(null);

  const [editStatus, setEditStatus] = useState<string>('Working');
  const [editBrandId, setEditBrandId] = useState<number | undefined>(undefined);
  const [editNotes, setEditNotes] = useState<string>('');

  // Toast / Status Message
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    // Load reference pods & brands
    api.getPods().then(setPods).catch(() => {});
    api.getBrands().then(setBrands).catch(() => {});
    loadRosters();
  }, [month, year]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const loadRosters = () => {
    setLoading(true);
    api.getRosters(month, year)
      .then(list => {
        setRosters(list);
        if (list.length > 0) {
          const latest = list[0];
          setCurrentRoster(latest);
          loadGrid(latest.id);
        } else {
          setCurrentRoster(null);
          setGridData(null);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const loadGrid = (rosterId: number) => {
    setLoading(true);
    const params: any = { view: viewMode };
    if (selectedPod !== 'ALL') params.pod_id = Number(selectedPod);
    if (selectedBrand !== 'ALL') params.brand_id = Number(selectedBrand);

    api.getRosterGrid(rosterId, params)
      .then(res => setGridData(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handleGenerateRoster = async () => {
    setActionLoading(true);
    try {
      const payload: any = { month, year, generated_by: 'Aditi Deshmukh (Lead)' };
      if (selectedPod !== 'ALL') payload.pod_id = Number(selectedPod);
      if (selectedBrand !== 'ALL') payload.brand_id = Number(selectedBrand);

      const newRoster = await api.generateRoster(payload);
      setCurrentRoster(newRoster);
      showToast('success', `Roster generated for ${month}/${year}! Validation: ${newRoster.validation_status} (${newRoster.coverage_percentage}% coverage).`);
      loadRosters();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Failed to generate roster');
    } finally {
      setActionLoading(false);
    }
  };

  const handleValidateRoster = async () => {
    if (!currentRoster) return;
    setActionLoading(true);
    try {
      const res = await api.validateRoster(currentRoster.id);
      showToast('info', `Independent Validation complete: ${res.validation_status} with ${res.critical_conflicts} critical gaps (${res.coverage_percentage}% coverage).`);
      loadRosters();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Validation failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirmation Dialog State
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

  const handleClearValidationResults = () => {
    if (!currentRoster) return;
    setConfirmModal({
      isOpen: true,
      title: 'Clear Previous Validation Results?',
      description: 'This will remove all unresolved validation conflict records for this roster version. Active assignments, employee profiles, leaves, and holidays will NOT be deleted.',
      confirmText: 'Clear Results',
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          const res = await api.clearRosterConflicts(currentRoster.id);
          showToast('success', res.message || 'Validation results cleared.');
          loadRosters();
        } catch (err: any) {
          showToast('error', err.response?.data?.detail || 'Failed to clear validation results');
        } finally {
          setActionLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleResetDraft = () => {
    if (!currentRoster) return;
    if (currentRoster.status === 'Published') {
      showToast('error', 'Cannot reset a published roster. Published rosters are immutable history.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Reset Draft Roster?',
      description: 'Are you sure you want to reset this draft roster? This will clear all draft assignments and conflict records for this draft version. Published history is preserved.',
      confirmText: 'Reset Draft to Blank',
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          const res = await api.resetDraftRoster(currentRoster.id);
          showToast('success', res.message || 'Draft roster reset.');
          loadRosters();
        } catch (err: any) {
          showToast('error', err.response?.data?.detail || 'Failed to reset draft roster');
        } finally {
          setActionLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleRegenerateDraft = () => {
    if (!currentRoster) return;
    if (currentRoster.status === 'Published') {
      showToast('error', 'Cannot regenerate a published roster. Please generate a new draft version instead.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Regenerate Draft Roster?',
      description: 'This will re-run the deterministic scheduling engine for this draft roster, rebuilding assignments and executing independent validation.',
      confirmText: 'Regenerate & Validate',
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          const res = await api.regenerateRoster(currentRoster.id, 'Aditi Deshmukh (Lead)');
          showToast('success', res.message || 'Draft regenerated and validated.');
          loadRosters();
        } catch (err: any) {
          showToast('error', err.response?.data?.detail || 'Failed to regenerate draft');
        } finally {
          setActionLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handlePublishRoster = async () => {
    if (!currentRoster) return;
    if (currentRoster.status === 'Published') {
      showToast('info', 'This roster version is already published.');
      return;
    }
    if ((currentRoster.critical_conflicts || 0) > 0) {
      showToast('error', `Publication rejected: Roster has ${currentRoster.critical_conflicts} critical unresolved conflict(s). Resolve all critical gaps before publishing.`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Publish Final Roster?',
      description: `Publish Version ${currentRoster.version} for operations? This will lock the roster and create an immutable historical version snapshot.`,
      confirmText: 'Publish & Lock',
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await api.publishRoster(currentRoster.id, 'Aditi Deshmukh');
          showToast('success', 'Roster published successfully! Schedule is now locked for operations.');
          loadRosters();
        } catch (err: any) {
          showToast('error', err.response?.data?.detail || 'Publication rejected. Critical conflicts must be resolved first.');
        } finally {
          setActionLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleOpenEditCell = (empName: string, empId: number, cell: GridCell) => {
    if (!cell.assignment_id) return;
    setEditingCell({ employeeName: empName, employeeId: empId, cell });
    setEditStatus(cell.work_status);
    setEditBrandId(cell.brand_id);
    setEditNotes(cell.notes || '');
  };

  const handleSaveCellEdit = async () => {
    if (!currentRoster || !editingCell || !editingCell.cell.assignment_id) return;
    setActionLoading(true);
    try {
      await api.updateRosterAssignment(currentRoster.id, editingCell.cell.assignment_id, {
        work_status: editStatus,
        brand_id: editBrandId,
        notes: editNotes,
        modified_by: 'Operations Manager'
      });
      showToast('success', `Shift on ${editingCell.cell.date} updated to ${editStatus}. Roster automatically revalidated.`);
      setEditingCell(null);
      loadGrid(currentRoster.id);
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Failed to update shift');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Working':
        return <span className="w-6 h-6 rounded flex items-center justify-center font-bold text-[11px] bg-blue-100 text-blue-700">W</span>;
      case 'Weekly Off':
        return <span className="w-6 h-6 rounded flex items-center justify-center font-bold text-[11px] bg-slate-100 text-slate-500">WO</span>;
      case 'Leave':
        return <span className="w-6 h-6 rounded flex items-center justify-center font-bold text-[11px] bg-amber-100 text-amber-700">L</span>;
      case 'Comp-Off':
        return <span className="w-6 h-6 rounded flex items-center justify-center font-bold text-[11px] bg-purple-100 text-purple-700">CO</span>;
      case 'Public Holiday':
        return <span className="w-6 h-6 rounded flex items-center justify-center font-bold text-[11px] bg-emerald-100 text-emerald-700">PH</span>;
      case 'Unavailable':
        return <span className="w-6 h-6 rounded flex items-center justify-center font-bold text-[11px] bg-red-100 text-red-700">U</span>;
      default:
        return <span className="w-6 h-6 rounded flex items-center justify-center font-bold text-[11px] bg-slate-100 text-slate-500">-</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 text-xs font-semibold animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
          toast.type === 'error' ? 'bg-red-50 text-red-800 border-red-300' :
          'bg-blue-50 text-blue-800 border-blue-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> :
           toast.type === 'error' ? <AlertOctagon className="w-4 h-4 text-red-600" /> :
           <Info className="w-4 h-4 text-blue-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header and Controls Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                Monthly Schedule Planner
              </span>
              {currentRoster && (
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  currentRoster.status === 'Published' ? 'bg-emerald-100 text-emerald-800' :
                  currentRoster.status === 'Needs Attention' ? 'bg-amber-100 text-amber-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {currentRoster.status} (v{currentRoster.version})
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">Enterprise Roster Matrix</h1>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleGenerateRoster}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
              title="Generate new draft version"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              New Draft
            </button>

            {currentRoster && (
              <>
                {currentRoster.status !== 'Published' && (
                  <button
                    onClick={handleRegenerateDraft}
                    disabled={actionLoading}
                    className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 transition flex items-center gap-1.5"
                    title="Regenerate this draft roster"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                )}

                <button
                  onClick={handleValidateRoster}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition flex items-center gap-1.5"
                  title="Run independent validation engine"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Validate
                </button>

                <button
                  onClick={handleClearValidationResults}
                  disabled={actionLoading}
                  className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-200 transition flex items-center gap-1.5"
                  title="Clear unresolved validation conflicts"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
                  Clear Results
                </button>

                {currentRoster.status !== 'Published' && (
                  <button
                    onClick={handleResetDraft}
                    disabled={actionLoading}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition flex items-center gap-1.5"
                    title="Reset draft assignments to blank slate"
                  >
                    <X className="w-3.5 h-3.5 text-rose-600" />
                    Reset Draft
                  </button>
                )}

                <button
                  onClick={handlePublishRoster}
                  disabled={actionLoading || currentRoster.status === 'Published' || (currentRoster.critical_conflicts || 0) > 0}
                  className={`px-3.5 py-2 rounded-xl font-semibold text-xs shadow-md transition flex items-center gap-1.5 ${
                    currentRoster.status === 'Published'
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : (currentRoster.critical_conflicts || 0) > 0
                        ? 'bg-red-50 text-red-600 border border-red-200 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                  }`}
                  title={
                    currentRoster.status === 'Published'
                      ? 'Roster is already published'
                      : (currentRoster.critical_conflicts || 0) > 0
                        ? `Cannot publish: ${currentRoster.critical_conflicts} critical gaps must be resolved`
                        : 'Publish and lock this roster version'
                  }
                >
                  <CheckCircle className="w-4 h-4" />
                  {currentRoster.status === 'Published' ? 'Published' : 'Publish Roster'}
                </button>

                <a
                  href={api.getRosterExportUrl(currentRoster.id)}
                  download
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </a>
              </>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Month */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500"
            >
              {[
                { m: 1, name: 'January' }, { m: 2, name: 'February' }, { m: 3, name: 'March' },
                { m: 4, name: 'April' }, { m: 5, name: 'May' }, { m: 6, name: 'June' },
                { m: 7, name: 'July' }, { m: 8, name: 'August' }, { m: 9, name: 'September' },
                { m: 10, name: 'October' }, { m: 11, name: 'November' }, { m: 12, name: 'December' }
              ].map(item => (
                <option key={item.m} value={item.m}>{item.name}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          {/* Pod Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Operational Pod</label>
            <select
              value={selectedPod}
              onChange={(e) => {
                setSelectedPod(e.target.value);
                if (currentRoster) loadGrid(currentRoster.id);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Pods (5)</option>
              {pods.map(p => (
                <option key={p.id} value={p.id}>{p.pod_name}</option>
              ))}
            </select>
          </div>

          {/* Brand Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Brand Filter</label>
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                if (currentRoster) loadGrid(currentRoster.id);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Brands (25)</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          {/* Perspective View */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Matrix View</label>
            <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
              {['company', 'pod', 'brand'].map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition ${
                    viewMode === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Roster Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Status Legend Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs px-6 gap-3">
          <div className="flex items-center gap-4">
            <span className="font-bold text-slate-600 text-[11px]">STATUS CODES:</span>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-blue-100 text-blue-700 font-bold text-[9px] flex items-center justify-center">W</span><span>Working</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-slate-200 text-slate-600 font-bold text-[9px] flex items-center justify-center">WO</span><span>Weekly Off</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-amber-100 text-amber-700 font-bold text-[9px] flex items-center justify-center">L</span><span>Leave</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-purple-100 text-purple-700 font-bold text-[9px] flex items-center justify-center">CO</span><span>Comp-Off</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[9px] flex items-center justify-center">PH</span><span>Holiday</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-red-100 text-red-700 font-bold text-[9px] flex items-center justify-center">U</span><span>Unavailable</span></div>
          </div>
          <span className="text-[11px] text-slate-500 italic">Click on any cell to modify shift or view details</span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-medium">Loading high-density monthly schedule...</p>
          </div>
        ) : gridData && gridData.rows.length > 0 ? (
          <div className="overflow-x-auto max-w-full">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600">
                  <th className="sticky left-0 bg-slate-100 z-10 px-4 py-3 min-w-[200px] border-r border-slate-200 font-bold text-[11px] uppercase tracking-wider">
                    Employee / Pod / Brands
                  </th>
                  <th className="px-2 py-3 text-center border-r border-slate-200 font-semibold text-slate-500 min-w-[70px]">
                    Shifts
                  </th>
                  {Array.from({ length: gridData.days_in_month }, (_, i) => {
                    const dayNum = i + 1;
                    const dateObj = new Date(year, month - 1, dayNum);
                    const isSun = dateObj.getDay() === 0;
                    const isSat = dateObj.getDay() === 6;
                    return (
                      <th
                        key={dayNum}
                        className={`px-1.5 py-2 text-center border-r border-slate-200 min-w-[34px] ${
                          isSun ? 'bg-amber-50 text-amber-900 font-bold' : isSat ? 'bg-slate-100 font-semibold text-slate-700' : ''
                        }`}
                      >
                        <div className="text-[10px] text-slate-400 font-medium">
                          {dateObj.toLocaleDateString('en-US', { weekday: 'narrow' })}
                        </div>
                        <div className="text-xs font-bold">{dayNum}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gridData.rows.map((row) => (
                  <tr key={row.employee_id} className="hover:bg-blue-50/30 transition">
                    {/* Employee Info Column (Sticky) */}
                    <td className="sticky left-0 bg-white z-10 px-4 py-2 border-r border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 truncate">{row.full_name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{row.emp_code}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                        <span className="font-medium text-blue-600 truncate">{row.pod_name}</span>
                        <span>•</span>
                        <span className="truncate text-slate-600 font-medium">{row.assigned_brands.join(', ') || 'Unassigned'}</span>
                      </div>
                    </td>

                    {/* Stats Summary */}
                    <td className="px-2 py-2 text-center border-r border-slate-200 bg-slate-50 font-bold text-slate-700">
                      {row.stats.working_days}
                    </td>

                    {/* Daily Shift Cells */}
                    {row.days.map((cell) => (
                      <td
                        key={cell.date}
                        onClick={() => handleOpenEditCell(row.full_name, row.employee_id, cell)}
                        className={`p-1 text-center border-r border-slate-100 cursor-pointer hover:scale-105 transition ${
                          cell.is_weekend ? 'bg-slate-50/50' : ''
                        }`}
                        title={`${cell.date}: ${cell.work_status} ${cell.brand_name ? `(${cell.brand_name})` : ''} ${cell.notes ? `\nNote: ${cell.notes}` : ''}`}
                      >
                        {getStatusBadge(cell.work_status)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No Roster Generated for {month}/{year}</p>
            <p className="text-xs text-slate-500 mt-1">Click the "Generate Roster" button above to solve and produce the optimal shift schedule.</p>
          </div>
        )}
      </div>

      {/* Manual Edit Cell Modal */}
      {editingCell && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Modify Shift Assignment</h3>
                <p className="text-xs text-slate-500">{editingCell.employeeName} • {editingCell.cell.date}</p>
              </div>
              <button
                onClick={() => setEditingCell(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Work Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Working">Working (Normal Operating Shift)</option>
                  <option value="Weekly Off">Weekly Off</option>
                  <option value="Leave">Leave (Approved Absence)</option>
                  <option value="Comp-Off">Comp-Off (Compensatory Leave)</option>
                  <option value="Public Holiday">Public Holiday</option>
                  <option value="Unavailable">Unavailable / Training</option>
                </select>
              </div>

              {editStatus === 'Working' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Assigned Brand</label>
                  <select
                    value={editBrandId || ''}
                    onChange={(e) => setEditBrandId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Default Brand</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Audit Note / Reason for Change</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Swapped with Priya Mehta due to personal emergency"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>Constraint Notice:</strong> Changing an employee to Weekly Off on an operating day without backup will generate a critical coverage gap conflict.
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingCell(null)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCellEdit}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
              >
                Save & Revalidate
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal for Destructive/Publish Actions */}
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
