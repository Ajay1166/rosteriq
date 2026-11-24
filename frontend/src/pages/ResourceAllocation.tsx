import React, { useState, useEffect } from 'react';
import {
  Split, Plus, Trash2, ShieldAlert, CheckCircle,
  Users, Store, Workflow, Percent, Info, X
} from 'lucide-react';
import { api } from '../services/api';
import { Assignment, Brand, Process, Employee } from '../types';

export const ResourceAllocation: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');

  // Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [formEmpId, setFormEmpId] = useState<number>(1);
  const [formBrandId, setFormBrandId] = useState<number>(1);
  const [formProcId, setFormProcId] = useState<number>(1);
  const [formRole, setFormRole] = useState<string>('Primary');
  const [formPct, setFormPct] = useState<number>(100.0);

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
      api.getAssignments(),
      api.getBrands(),
      api.getProcesses(),
      api.getEmployees()
    ])
      .then(([aList, bList, pList, eList]) => {
        setAssignments(aList);
        setBrands(bList);
        setProcesses(pList);
        setEmployees(eList);
        if (eList.length > 0) setFormEmpId(eList[0].id);
        if (bList.length > 0) setFormBrandId(bList[0].id);
        if (pList.length > 0) setFormProcId(pList[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this process assignment?')) return;
    try {
      await api.deleteAssignment(id);
      showToast('Assignment removed successfully');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to remove assignment');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAssignment({
        employee_id: formEmpId,
        brand_id: formBrandId,
        process_id: formProcId,
        assigned_role: formRole,
        allocation_percentage: formPct,
        priority: 1,
        active: true
      });
      showToast('Assignment mapped successfully');
      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create assignment');
    }
  };

  // Group by brand
  const filteredAssignments = selectedBrand === 'ALL'
    ? assignments
    : assignments.filter(a => a.brand_id === Number(selectedBrand));

  const brandGroups = brands.map(b => ({
    brand: b,
    items: filteredAssignments.filter(a => a.brand_id === b.id)
  })).filter(g => g.items.length > 0);

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
          <h1 className="text-xl font-bold text-slate-900">Resource & Capability Allocation Matrix</h1>
          <p className="text-xs text-slate-500 mt-1">
            Map employees to brands and processes. Supports dedicated sole-operators (1 employee covering all processes) and multi-resource shared staffing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium"
          >
            <option value="ALL">All Brands ({brands.length})</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Allocation
          </button>
        </div>
      </div>

      {/* Visual Allocation Cards */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs">Loading allocations...</div>
      ) : (
        <div className="space-y-4">
          {brandGroups.map(({ brand, items }) => {
            const isSingle = brand.employee_count === 1;
            return (
              <div key={brand.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                      {brand.code.slice(0, 3)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{brand.name}</h3>
                      <p className="text-[11px] text-slate-400 font-medium">Pod: {brand.assigned_pod_name}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    isSingle ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}>
                    {isSingle ? '80% Model: Single Dedicated Resource' : 'Multi-Resource Team'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  {items.map((alloc) => (
                    <div key={alloc.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <Workflow className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{alloc.process_name}</span>
                        </div>
                        <p className="text-slate-700 font-medium truncate flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{alloc.employee_name}</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {alloc.assigned_role} • {alloc.allocation_percentage}%
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(alloc.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition"
                        title="Remove Assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Map Process Responsibility</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Employee</label>
                <select
                  value={formEmpId}
                  onChange={(e) => setFormEmpId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Brand</label>
                <select
                  value={formBrandId}
                  onChange={(e) => setFormBrandId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                >
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Process</label>
                <select
                  value={formProcId}
                  onChange={(e) => setFormProcId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                >
                  {processes.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Allocation %</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={formPct}
                    onChange={(e) => setFormPct(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20"
              >
                Save Allocation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
