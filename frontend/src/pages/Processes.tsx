import React, { useState, useEffect } from 'react';
import { Workflow, Plus, Edit, Clock, CheckCircle, X } from 'lucide-react';
import { api } from '../services/api';
import { Process } from '../types';

export const Processes: React.FC = () => {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingProc, setEditingProc] = useState<Process | null>(null);

  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formDuration, setFormDuration] = useState<number>(8.0);
  const [formDesc, setFormDesc] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadProcesses();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadProcesses = () => {
    setLoading(true);
    api.getProcesses()
      .then(setProcesses)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProc) {
        await api.updateProcess(editingProc.id, {
          name: formName,
          code: formCode,
          default_shift_duration: formDuration,
          description: formDesc
        });
        showToast('Process updated successfully');
        setEditingProc(null);
      } else {
        await api.createProcess({
          name: formName,
          code: formCode,
          default_shift_duration: formDuration,
          description: formDesc,
          status: 'Active'
        });
        showToast('Process created successfully');
        setShowModal(false);
      }
      loadProcesses();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error saving process');
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
          <h1 className="text-xl font-bold text-slate-900">Configurable Operations Processes</h1>
          <p className="text-xs text-slate-500 mt-1">Define workflows, SLA delivery metrics, and default shift requirements across brands.</p>
        </div>
        <button
          onClick={() => {
            setFormName('');
            setFormCode('');
            setFormDuration(8.0);
            setFormDesc('');
            setShowModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Process
        </button>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs">Loading processes...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {processes.map((proc) => (
            <div key={proc.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-blue-50 text-blue-700">
                  {proc.code}
                </span>
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {proc.default_shift_duration}h Shift
                </span>
              </div>
              <h3 className="font-bold text-slate-900 text-sm">{proc.name}</h3>
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {proc.description || 'Configurable operational SLA workflow.'}
              </p>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => {
                    setEditingProc(proc);
                    setFormName(proc.name);
                    setFormCode(proc.code);
                    setFormDuration(proc.default_shift_duration);
                    setFormDesc(proc.description || '');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit Process
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {(showModal || editingProc) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingProc ? `Edit Process: ${editingProc.name}` : 'New Operational Process'}
              </h3>
              <button
                type="button"
                onClick={() => { setShowModal(false); setEditingProc(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Process Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Non-Delivery Report (NDR)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NDR"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Duration (Hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  />
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
                onClick={() => { setShowModal(false); setEditingProc(null); }}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20"
              >
                Save Process
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
