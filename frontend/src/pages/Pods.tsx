import React, { useState, useEffect } from 'react';
import { Network, Users, UserCheck, Shield, Plus, Edit, X, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { Pod } from '../types';

export const Pods: React.FC = () => {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingPod, setEditingPod] = useState<Pod | null>(null);

  const [formName, setFormName] = useState<string>('');
  const [formLead, setFormLead] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadPods();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadPods = () => {
    setLoading(true);
    api.getPods()
      .then(setPods)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPod) {
        await api.updatePod(editingPod.id, {
          pod_name: formName,
          pod_lead_name: formLead,
          description: formDesc
        });
        showToast('Pod updated successfully');
        setEditingPod(null);
      } else {
        await api.createPod({
          pod_name: formName,
          pod_lead_name: formLead,
          description: formDesc,
          status: 'Active'
        });
        showToast('Pod created successfully');
        setShowModal(false);
      }
      loadPods();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error saving pod');
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
          <h1 className="text-xl font-bold text-slate-900">Operational Pods & Leadership</h1>
          <p className="text-xs text-slate-500 mt-1">Cross-functional squads managing clusters of dedicated and multi-resource D2C brands.</p>
        </div>
        <button
          onClick={() => {
            setFormName('');
            setFormLead('');
            setFormDesc('');
            setShowModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Pod
        </button>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs">Loading operational pods...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pods.map((pod) => (
            <div key={pod.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Network className="w-5 h-5" />
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                  {pod.employee_count || 6} Members
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-base">{pod.pod_name}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {pod.description || 'Specialized brand operations pod.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3 text-xs">
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[11px]">
                  {pod.pod_lead_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-medium">Pod Lead</p>
                  <p className="font-semibold text-slate-800">{pod.pod_lead_name}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => {
                    setEditingPod(pod);
                    setFormName(pod.pod_name);
                    setFormLead(pod.pod_lead_name);
                    setFormDesc(pod.description || '');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit Pod
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {(showModal || editingPod) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingPod ? `Edit Pod: ${editingPod.pod_name}` : 'Create Operational Pod'}
              </h3>
              <button
                type="button"
                onClick={() => { setShowModal(false); setEditingPod(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pod Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zeta Vanguard"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pod Lead Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Iyer"
                  value={formLead}
                  onChange={(e) => setFormLead(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
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
                onClick={() => { setShowModal(false); setEditingPod(null); }}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/20"
              >
                Save Pod
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
