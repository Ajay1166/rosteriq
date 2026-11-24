import React, { useState, useEffect } from 'react';
import {
  Store, Plus, Edit, Sliders, CheckCircle, ShieldCheck,
  Calendar, Clock, X, ChevronRight, AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { Brand, Pod, Process, OperatingRule } from '../types';

export const Brands: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [configuringBrand, setConfiguringBrand] = useState<Brand | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formIndustry, setFormIndustry] = useState<string>('Apparel');
  const [formPodId, setFormPodId] = useState<number>(1);
  const [formDesc, setFormDesc] = useState<string>('');

  // Rule Form State
  const [ruleProcessId, setRuleProcessId] = useState<number>(1);
  const [ruleMode, setRuleMode] = useState<string>('365_DAYS');
  const [ruleMinStaff, setRuleMinStaff] = useState<number>(1);
  const [ruleShiftStart, setRuleShiftStart] = useState<string>('09:00');
  const [ruleShiftEnd, setRuleShiftEnd] = useState<string>('18:00');

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getBrands(),
      api.getPods(),
      api.getProcesses()
    ])
      .then(([bList, pList, procList]) => {
        setBrands(bList);
        setPods(pList);
        setProcesses(procList);
        if (procList.length > 0) setRuleProcessId(procList[0].id);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBrand) {
        await api.updateBrand(editingBrand.id, {
          name: formName,
          code: formCode,
          industry: formIndustry,
          assigned_pod_id: formPodId,
          description: formDesc
        });
        showToast('Brand updated successfully');
        setEditingBrand(null);
      } else {
        await api.createBrand({
          name: formName,
          code: formCode,
          industry: formIndustry,
          assigned_pod_id: formPodId,
          description: formDesc,
          status: 'Active'
        });
        showToast('Brand added successfully');
        setShowAddModal(false);
      }
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error saving brand');
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringBrand) return;
    try {
      const isSunday = (ruleMode === '365_DAYS' || ruleMode === 'DAILY_EXCEPT_HOLIDAYS');
      const isHoliday = (ruleMode === '365_DAYS');

      await api.setBrandRule(configuringBrand.id, {
        brand_id: configuringBrand.id,
        process_id: ruleProcessId,
        operating_mode: ruleMode,
        working_weekdays: isSunday ? '0,1,2,3,4,5,6' : '0,1,2,3,4,5',
        sunday_operation: isSunday,
        public_holiday_operation: isHoliday,
        min_required_employees: ruleMinStaff,
        max_required_employees: ruleMinStaff + 1,
        shift_start_time: ruleShiftStart,
        shift_end_time: ruleShiftEnd
      });
      showToast(`Rule updated for ${configuringBrand.name}`);
      setConfiguringBrand(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error saving operating rule');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast */}
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
            <h1 className="text-xl font-bold text-slate-900">Brand Portfolio & Operating Rules</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              {brands.length} D2C Brands
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Configure client operating calendars (365 Days, Sunday/Holiday rules), process overrides, and required staffing slots.</p>
        </div>
        <button
          onClick={() => {
            setFormName('');
            setFormCode('');
            setFormIndustry('Apparel');
            setFormPodId(pods[0]?.id || 1);
            setFormDesc('');
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Brand
        </button>
      </div>

      {/* Brands Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs">Loading brand portfolio...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {brands.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                    {b.code.slice(0, 3)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{b.name}</h3>
                    <p className="text-[11px] text-slate-400 font-medium">{b.industry} • Pod: {b.assigned_pod_name}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  (b.employee_count || 0) <= 1 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {b.employee_count === 1 ? '1 Dedicated' : `${b.employee_count} Staffed`}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                {b.description || 'Enterprise managed brand operations with multi-process SLA delivery.'}
              </p>

              {/* Operating Rules Preview */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>PROCESS RULES</span>
                  <span className="text-blue-600">{b.operating_rules?.length || 0} configured</span>
                </div>
                {b.operating_rules && b.operating_rules.length > 0 ? (
                  <div className="space-y-1">
                    {b.operating_rules.slice(0, 2).map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-700 truncate">{r.process_name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">
                          {r.operating_mode}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">Default 365-day operation rule active</p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    setEditingBrand(b);
                    setFormName(b.name);
                    setFormCode(b.code);
                    setFormIndustry(b.industry);
                    setFormPodId(b.assigned_pod_id || 1);
                    setFormDesc(b.description || '');
                  }}
                  className="text-slate-500 hover:text-slate-900 font-semibold flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => {
                    setConfiguringBrand(b);
                  }}
                  className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                >
                  <Sliders className="w-3.5 h-3.5" /> Configure Rules
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Configure Brand Rules Modal */}
      {configuringBrand && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveRule} className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Operating Rules Configuration</h3>
                <p className="text-xs text-slate-500">{configuringBrand.name} ({configuringBrand.code})</p>
              </div>
              <button
                type="button"
                onClick={() => setConfiguringBrand(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Process</label>
                <select
                  value={ruleProcessId}
                  onChange={(e) => setRuleProcessId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                >
                  {processes.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Operating Calendar Mode</label>
                <select
                  value={ruleMode}
                  onChange={(e) => setRuleMode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                >
                  <option value="365_DAYS">365 DAYS – Mon to Sun, including Public Holidays</option>
                  <option value="DAILY_EXCEPT_HOLIDAYS">DAILY EXCEPT HOLIDAYS – Mon to Sun, excluding Holidays</option>
                  <option value="SUNDAYS_AND_HOLIDAYS_OFF">SUNDAYS AND HOLIDAYS OFF – Mon to Sat, closed on Sundays & Holidays</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Staff</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={ruleMinStaff}
                    onChange={(e) => setRuleMinStaff(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Shift Start</label>
                  <input
                    type="text"
                    value={ruleShiftStart}
                    onChange={(e) => setRuleShiftStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Shift End</label>
                  <input
                    type="text"
                    value={ruleShiftEnd}
                    onChange={(e) => setRuleShiftEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium font-mono"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
                <strong>Engine Behavior:</strong> The scheduler will strictly enforce this process calendar. Shifts will be skipped on closed days, and minimum staffing slots will be allocated on active days.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfiguringBrand(null)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20"
              >
                Apply Operating Rule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add / Edit Brand Modal */}
      {(showAddModal || editingBrand) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveBrand} className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingBrand ? `Edit Brand: ${editingBrand.name}` : 'Register New D2C Brand'}
              </h3>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setEditingBrand(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Brand Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UrbanNest"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Brand Code (Unique)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UNEST"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Industry / Category</label>
                  <input
                    type="text"
                    required
                    value={formIndustry}
                    onChange={(e) => setFormIndustry(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Pod</label>
                  <select
                    value={formPodId}
                    onChange={(e) => setFormPodId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  >
                    {pods.map(p => (
                      <option key={p.id} value={p.id}>{p.pod_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setEditingBrand(null); }}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20"
              >
                Save Brand
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
