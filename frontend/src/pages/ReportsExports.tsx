import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Printer, Shield, Calendar, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { Roster } from '../types';

export const ReportsExports: React.FC = () => {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState<number | null>(null);

  useEffect(() => {
    api.getRosters().then(list => {
      setRosters(list);
      if (list.length > 0) setSelectedRosterId(list[0].id);
    });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports & Audit Exports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Export monthly company rosters, conflict analysis, and employee coverage audits in CSV and printer-ready formats.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition flex items-center gap-2 shrink-0"
        >
          <Printer className="w-4 h-4" />
          Print Roster Overview
        </button>
      </div>

      {/* Select Roster */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 text-xs">
        <label className="font-bold text-slate-700">Select Roster Version:</label>
        <select
          value={selectedRosterId || ''}
          onChange={(e) => setSelectedRosterId(Number(e.target.value))}
          className="px-3.5 py-2 rounded-xl border border-slate-200 font-medium bg-slate-50"
        >
          {rosters.map(r => (
            <option key={r.id} value={r.id}>
              {r.month}/{r.year} – Version {r.version} ({r.status} • {r.coverage_percentage}% Coverage)
            </option>
          ))}
        </select>
      </div>

      {/* Export Options Grid */}
      {selectedRosterId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Master Company Roster */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Monthly Master Roster (CSV)</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Includes all calendar dates, employees, assigned brands, processes, shift timings (09:00-18:00), work statuses (W, WO, L, CO, PH, U), and modification notes.
              </p>
            </div>
            <a
              href={api.getRosterExportUrl(selectedRosterId)}
              download
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Master Roster (.CSV)
            </a>
          </div>

          {/* Card 2: Conflict & Gap Audit Log */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Scheduling Conflicts Audit (CSV)</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Detailed compliance report of all detected conflicts, severity levels (Critical, Warning), affected dates, required vs actual staffing, and suggested resolutions.
              </p>
            </div>
            <a
              href={api.getConflictsExportUrl(selectedRosterId)}
              download
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Conflicts Report (.CSV)
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
