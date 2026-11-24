import React, { useState, useEffect } from 'react';
import {
  CalendarOff, Plus, Check, X, Clock, CheckCircle,
  Calendar, AlertCircle, FileText
} from 'lucide-react';
import { api } from '../services/api';
import { Availability, Employee } from '../types';

export const AvailabilityPage: React.FC = () => {
  const [records, setRecords] = useState<Availability[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formEmpId, setFormEmpId] = useState<number>(1);
  const [formDate, setFormDate] = useState<string>('2026-12-15');
  const [formStatus, setFormStatus] = useState<string>('Approved Leave');
  const [formType, setFormType] = useState<string>('Casual Leave');
  const [formReason, setFormReason] = useState<string>('Personal emergency');

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
      api.getAvailabilities({ month: 12, year: 2026 }),
      api.getEmployees()
    ])
      .then(([aList, eList]) => {
        setRecords(aList);
        setEmployees(eList);
        if (eList.length > 0) setFormEmpId(eList[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleUpdateStatus = async (id: number, newApproval: string) => {
    try {
      await api.updateAvailability(id, { approval_status: newApproval });
      showToast(`Request marked as ${newApproval}`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error updating approval');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAvailability({
        employee_id: formEmpId,
        date: formDate,
        status: formStatus,
        leave_type: formType,
        approval_status: 'Approved',
        reason: formReason
      });
      showToast('Leave entry recorded successfully');
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error recording leave');
    }
  };

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
          <h1 className="text-xl font-bold text-slate-900">Employee Availability & Leave Governance</h1>
          <p className="text-xs text-slate-500 mt-1">
            Approved leaves and comp-offs are enforced as mandatory hard constraints during roster generation.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Record Absence / Leave
        </button>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs">Loading availability calendar...</div>
        ) : records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Effective Date</th>
                  <th className="px-4 py-3">Status Category</th>
                  <th className="px-4 py-3">Leave Type</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3 font-bold text-slate-900">{r.employee_name}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{r.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        r.status.includes('Leave') ? 'bg-amber-100 text-amber-800' :
                        r.status === 'Comp-Off' ? 'bg-purple-100 text-purple-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.leave_type || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.approval_status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                        r.approval_status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {r.approval_status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.approval_status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleUpdateStatus(r.id, 'Approved')}
                            className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px]"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(r.id, 'Rejected')}
                            className="px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-[11px]"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center text-slate-400 text-xs">No leave or availability records.</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Record Employee Absence / Leave</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Category</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  >
                    <option value="Approved Leave">Approved Leave</option>
                    <option value="Comp-Off">Comp-Off</option>
                    <option value="Unavailable">Unavailable / Training</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Leave Type</label>
                <input
                  type="text"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <textarea
                  rows={2}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20"
              >
                Record Leave
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
