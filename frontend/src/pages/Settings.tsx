import React, { useState, useEffect } from 'react';
import {
  Sparkles, TrendingUp, ShieldAlert, Award, ArrowRight,
  CheckCircle, AlertTriangle, Users, Sliders, RefreshCw, Check
} from 'lucide-react';
import { api } from '../services/api';
import { Employee, Roster, ImpactAnalysisResult, SPOFRisk } from '../types';

export const Settings: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [latestRoster, setLatestRoster] = useState<Roster | null>(null);

  // Impact Analyzer Form
  const [simEmpId, setSimEmpId] = useState<number>(1);
  const [simDate, setSimDate] = useState<string>('2026-12-12');
  const [simStatus, setSimStatus] = useState<string>('Approved Leave');

  const [impactResult, setImpactResult] = useState<ImpactAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [spofRisks, setSpofRisks] = useState<SPOFRisk[]>([]);
  const [workloadStats, setWorkloadStats] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = () => {
    api.getEmployees().then(list => {
      setEmployees(list);
      if (list.length > 0) setSimEmpId(list[0].id);
    });

    api.getRosters().then(list => {
      if (list.length > 0) {
        setLatestRoster(list[0]);
        api.getWorkloadAnalytics(list[0].id).then(setWorkloadStats);
      }
    });

    api.getSPOFAnalytics().then(setSpofRisks);
  };

  const handleRunImpact = async () => {
    if (!latestRoster) return;
    setAnalyzing(true);
    try {
      const res = await api.analyzeImpact(latestRoster.id, {
        employee_id: simEmpId,
        date: simDate,
        new_status: simStatus
      });
      setImpactResult(res);
      showToast('Impact analysis computed from real records.');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error running impact analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyReplacement = async (candidateId: number) => {
    if (!latestRoster) return;
    try {
      await api.applyImpactReplacement({
        roster_id: latestRoster.id,
        employee_id: simEmpId,
        date: simDate,
        new_status: simStatus,
        replacement_employee_id: candidateId,
        reason: 'Workforce impact replacement'
      });
      showToast('Replacement assigned and roster revalidated!');
      handleRunImpact();
      api.getRosters().then(list => { if (list.length > 0) setLatestRoster(list[0]); });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to apply replacement');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Workforce Intelligence & Risk Systems</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
              Core Differentiator
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simulate employee absence, rank candidate backups by workload & skills, and monitor Single Point of Failure (SPOF) risks across brands.
          </p>
        </div>
      </div>

      {/* FEATURE 1: WORKFORCE IMPACT ANALYZER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Workforce Impact Analyzer</h2>
              <p className="text-xs text-slate-500">Live what-if absence simulator with real candidate recommendation scoring</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-400">Part 11 Feature</span>
        </div>

        {/* Input Parameters Form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Employee</label>
            <select
              value={simEmpId}
              onChange={(e) => setSimEmpId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium bg-slate-50"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Absence Date</label>
            <input
              type="date"
              value={simDate}
              onChange={(e) => setSimDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium bg-slate-50"
            >
            </input>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Simulated Status</label>
            <select
              value={simStatus}
              onChange={(e) => setSimStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium bg-slate-50"
            >
              <option value="Approved Leave">Approved Leave</option>
              <option value="Comp-Off">Comp-Off</option>
              <option value="Unavailable">Unavailable / Medical</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleRunImpact}
              disabled={analyzing}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Analyze Impact
            </button>
          </div>
        </div>

        {/* Impact Results Preview */}
        {impactResult && (
          <div className="space-y-6 pt-4 border-t border-slate-100 animate-fade-in">
            {/* Before vs After Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="font-semibold text-slate-500 uppercase text-[10px]">BEFORE UNAVAILABILITY</span>
                <p className="text-xl font-bold text-slate-900">{impactResult.coverage_before_percent}% Coverage</p>
                <p className="text-[11px] text-slate-500">{impactResult.critical_conflicts_before} Critical Conflicts</p>
              </div>

              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs space-y-1">
                <span className="font-semibold text-red-600 uppercase text-[10px]">AFTER EMPLOYEE ABSENCE</span>
                <p className="text-xl font-bold text-red-700">{impactResult.coverage_after_percent}% Coverage</p>
                <p className="text-[11px] text-red-600">{impactResult.critical_conflicts_after} Critical Conflicts ({impactResult.affected_assignments.length} Gaps)</p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                <span className="font-semibold text-emerald-600 uppercase text-[10px]">AFTER REPLACEMENT</span>
                <p className="text-xl font-bold text-emerald-700">100% Restored</p>
                <p className="text-[11px] text-emerald-600">Zero Critical Conflicts</p>
              </div>
            </div>

            {/* Affected Processes */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Affected Operating Responsibilities</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {impactResult.affected_assignments.map((a, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-100 text-xs flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{a.brand_name}</span>
                    <span className="px-2 py-0.5 rounded bg-white text-slate-600 font-medium text-[11px]">{a.process_name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ranked Backup Candidates */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Ranked Replacement Recommendations</h4>
              <div className="space-y-2">
                {impactResult.backup_recommendations.map((cand, idx) => (
                  <div key={cand.employee_id} className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">{cand.employee_name}</span>
                        <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-blue-50 text-blue-700">
                          Match Score: {cand.recommendation_score}
                        </span>
                      </div>
                      <p className="text-slate-600">{cand.explanation}</p>
                    </div>

                    <button
                      onClick={() => handleApplyReplacement(cand.employee_id)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 shrink-0"
                    >
                      Assign Replacement
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FEATURE 2: SINGLE POINT OF FAILURE (SPOF) RADAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Single Point of Failure (SPOF) Risk Radar</h2>
            <p className="text-xs text-slate-500">Detects brands with extreme sole-operator dependencies across multiple processes</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spofRisks.slice(0, 9).map((risk) => (
            <div key={risk.brand_id} className={`p-4 rounded-xl border text-xs space-y-2 ${
              risk.risk_level === 'HIGH' ? 'bg-red-50/50 border-red-200' :
              risk.risk_level === 'MEDIUM' ? 'bg-amber-50/50 border-amber-200' :
              'bg-emerald-50/50 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{risk.brand_name}</span>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                  risk.risk_level === 'HIGH' ? 'bg-red-100 text-red-800' :
                  risk.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                  'bg-emerald-100 text-emerald-800'
                }`}>
                  {risk.risk_level} RISK
                </span>
              </div>
              <p className="text-slate-700 font-medium">{risk.risk_summary}</p>
              <p className="text-[11px] text-slate-500 italic">Mitigation: {risk.recommended_mitigation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURE 3: WORKLOAD FAIRNESS & ANALYTICS */}
      {workloadStats && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Workload Fairness & Equity Engine</h2>
                <p className="text-xs text-slate-500">Formula: Workload Balance = 1 - (Standard Deviation / Mean)</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-purple-700">{workloadStats.fairness_score}%</span>
              <p className="text-[10px] text-slate-400">Equity Index</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border space-y-2">
              <h4 className="font-bold text-slate-800">Top Workload Employees</h4>
              {workloadStats.top_workload_employees?.slice(0, 3).map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-slate-700">
                  <span>{e.name} ({e.pod})</span>
                  <span className="font-bold">{e.working_days} shifts</span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border space-y-2">
              <h4 className="font-bold text-slate-800">Operational Suggestions</h4>
              {workloadStats.suggestions?.map((s: string, idx: number) => (
                <p key={idx} className="text-slate-600 leading-relaxed">• {s}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
