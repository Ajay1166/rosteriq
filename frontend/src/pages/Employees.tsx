import React, { useState, useEffect } from 'react';
import {
  Users, Search, Filter, Plus, Edit, UserX, Eye, Mail,
  Phone, Briefcase, Calendar, Award, CheckCircle, XCircle, X
} from 'lucide-react';
import { api } from '../services/api';
import { Employee, Pod } from '../types';

export const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedPod, setSelectedPod] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeSchedule, setEmployeeSchedule] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form State
  const [formEmpId, setFormEmpId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formPodId, setFormPodId] = useState<number>(1);
  const [formDesignation, setFormDesignation] = useState<string>('Associate');
  const [formPrefOff, setFormPrefOff] = useState<number>(6); // Sunday
  const [formSkills, setFormSkills] = useState<string>('');

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedPod, selectedStatus]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = () => {
    setLoading(true);
    const params: any = {};
    if (selectedPod !== 'ALL') params.pod_id = Number(selectedPod);
    if (selectedStatus !== 'ALL') params.status = selectedStatus;
    if (search.trim()) params.search = search.trim();

    Promise.all([
      api.getEmployees(params),
      api.getPods()
    ])
      .then(([empList, podList]) => {
        setEmployees(empList);
        setPods(podList);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleViewProfile = async (emp: Employee) => {
    setSelectedEmployee(emp);
    try {
      const sched = await api.getEmployeeSchedule(emp.id, 12, 2026);
      setEmployeeSchedule(sched);
    } catch {
      setEmployeeSchedule(null);
    }
  };

  const handleDeactivate = async (emp: Employee) => {
    if (!window.confirm(`Are you sure you want to deactivate ${emp.full_name}? Historical roster records will be preserved.`)) return;
    try {
      await api.deactivateEmployee(emp.id);
      showToast(`${emp.full_name} deactivated successfully.`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to deactivate employee');
    }
  };

  const handleOpenAdd = () => {
    setFormEmpId(`EMP${String(employees.length + 1).padStart(3, '0')}`);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormPodId(pods[0]?.id || 1);
    setFormDesignation('Associate');
    setFormPrefOff(6);
    setFormSkills('Customer Support, ACC');
    setShowAddModal(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, {
          full_name: formName,
          email: formEmail,
          phone: formPhone,
          pod_id: formPodId,
          designation: formDesignation,
          preferred_weekly_off: formPrefOff,
          skills: formSkills
        });
        showToast('Employee updated successfully');
        setEditingEmployee(null);
      } else {
        await api.createEmployee({
          employee_id: formEmpId,
          full_name: formName,
          email: formEmail,
          phone: formPhone,
          pod_id: formPodId,
          designation: formDesignation,
          status: 'Active',
          employment_type: 'Full-Time',
          max_hours_per_day: 8.0,
          preferred_weekly_off: formPrefOff,
          skills: formSkills
        });
        showToast('Employee created successfully');
        setShowAddModal(false);
      }
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error saving employee');
    }
  };

  const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
            <h1 className="text-xl font-bold text-slate-900">Workforce Directory</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {employees.length} Staff Members
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Manage employee profiles, weekly-off constraints, and operational pod affiliations.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3 text-xs">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, employee ID, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold">
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedPod}
            onChange={(e) => setSelectedPod(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium"
          >
            <option value="ALL">All Pods</option>
            {pods.map(p => (
              <option key={p.id} value={p.id}>{p.pod_name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium"
          >
            <option value="ALL">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">Loading employees...</div>
        ) : employees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Operational Pod</th>
                  <th className="px-4 py-3">Assigned Brands</th>
                  <th className="px-4 py-3">Preferred Off</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {emp.full_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{emp.full_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{emp.employee_id} • {emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{emp.designation}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700">
                        {emp.pod_name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {emp.assigned_brands && emp.assigned_brands.length > 0
                        ? emp.assigned_brands.join(', ')
                        : 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {weekdayNames[emp.preferred_weekly_off]}
                      {emp.fixed_weekly_off !== null && emp.fixed_weekly_off !== undefined && (
                        <span className="ml-1 text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                          Fixed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewProfile(emp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          title="View Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingEmployee(emp);
                            setFormName(emp.full_name);
                            setFormEmail(emp.email);
                            setFormPhone(emp.phone || '');
                            setFormPodId(emp.pod_id || 1);
                            setFormDesignation(emp.designation);
                            setFormPrefOff(emp.preferred_weekly_off);
                            setFormSkills(emp.skills || '');
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="Edit Employee"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {emp.status === 'Active' && (
                          <button
                            onClick={() => handleDeactivate(emp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Deactivate"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">No employees found.</div>
        )}
      </div>

      {/* Employee Profile View Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center shadow-md">
                  {selectedEmployee.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base">{selectedEmployee.full_name}</h3>
                  <p className="text-xs text-slate-300 font-mono">{selectedEmployee.employee_id} • {selectedEmployee.designation}</p>
                </div>
              </div>
              <button onClick={() => setSelectedEmployee(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-slate-400 font-medium">Email Address</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedEmployee.email}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Phone</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedEmployee.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Operational Pod</p>
                  <p className="font-semibold text-blue-600 mt-0.5">{selectedEmployee.pod_name}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Weekly-Off Preference</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{weekdayNames[selectedEmployee.preferred_weekly_off]}</p>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-slate-400 font-medium mb-1.5">Assigned Brands & Responsibilities</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEmployee.assigned_brands?.map((b, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold">
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <p className="text-slate-400 font-medium mb-1.5">Verified Process Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEmployee.skills?.split(',').map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      {s.trim()}
                    </span>
                  ))}
                </div>
              </div>

              {employeeSchedule && (
                <div className="pt-4">
                  <p className="text-slate-400 font-medium mb-2">Upcoming Schedule (December 2026)</p>
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-50 border rounded-lg">
                    {employeeSchedule.schedule.slice(0, 10).map((s: any, idx: number) => (
                      <div key={idx} className="p-2 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-600">{s.date}</span>
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          s.work_status === 'Working' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {s.work_status} {s.brand_name ? `(${s.brand_name})` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {(showAddModal || editingEmployee) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveEmployee} className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingEmployee ? `Edit ${editingEmployee.full_name}` : 'Add New Employee'}
              </h3>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setEditingEmployee(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              {!editingEmployee && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    required
                    value={formEmpId}
                    onChange={(e) => setFormEmpId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="name@datastraw.io"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Operational Pod</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferred Weekly Off</label>
                  <select
                    value={formPrefOff}
                    onChange={(e) => setFormPrefOff(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  >
                    {weekdayNames.map((w, idx) => (
                      <option key={idx} value={idx}>{w}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Skills (comma-separated)</label>
                <input
                  type="text"
                  placeholder="Customer Support, ACC, Retention"
                  value={formSkills}
                  onChange={(e) => setFormSkills(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setEditingEmployee(null); }}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20"
              >
                Save Employee
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
