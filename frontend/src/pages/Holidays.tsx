import React, { useState, useEffect } from 'react';
import { Sun, Plus, Trash2, Calendar, CheckCircle, X } from 'lucide-react';
import { api } from '../services/api';
import { PublicHoliday } from '../types';

export const Holidays: React.FC = () => {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);

  const [formName, setFormName] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('2026-01-26');
  const [formType, setFormType] = useState<string>('National');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadHolidays();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadHolidays = () => {
    setLoading(true);
    api.getHolidays(2026)
      .then(setHolidays)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this public holiday?')) return;
    try {
      await api.deleteHoliday(id);
      showToast('Holiday deleted successfully');
      loadHolidays();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error deleting holiday');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createHoliday({
        holiday_name: formName,
        date: formDate,
        applicable_region: 'All India',
        applicable_brands: 'ALL',
        holiday_type: formType
      });
      showToast('Public holiday added successfully');
      setShowModal(false);
      loadHolidays();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error adding holiday');
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Public Holidays Calendar (2026)</h1>
          <p className="text-xs text-slate-500 mt-1">Configurable public holidays determining client brand calendar closures.</p>
        </div>
        <button
          onClick={() => {
            setFormName('');
            setFormDate('2026-12-25');
            setShowModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Holiday
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs">Loading holiday calendar...</div>
        ) : holidays.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Holiday Name</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Applicable Region</th>
                  <th className="px-4 py-3">Applicable Brands</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {holidays.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3 font-bold text-slate-900">{h.holiday_name}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{h.date}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                        {h.holiday_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{h.applicable_region}</td>
                    <td className="px-4 py-3 text-slate-600">{h.applicable_brands}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(h.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center text-slate-400 text-xs">No holidays configured.</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Add Public Holiday</h3>
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
                <label className="block font-semibold text-slate-700 mb-1">Holiday Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
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
                  <label className="block font-semibold text-slate-700 mb-1">Holiday Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  >
                    <option value="National">National</option>
                    <option value="Festival">Festival</option>
                    <option value="Optional">Optional</option>
                  </select>
                </div>
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
                Save Holiday
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
