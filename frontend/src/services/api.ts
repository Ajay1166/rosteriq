import axios from 'axios';
import {
  Employee, Pod, Brand, Process, Assignment, Availability,
  PublicHoliday, Roster, RosterGridResponse, SchedulingConflict,
  ImpactAnalysisResult, SPOFRisk
} from '../types';

const rawApiBase = (import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8000/api';
// Normalize API_BASE: remove trailing slashes and ensure /api path is present
const cleanBase = rawApiBase.replace(/\/+$/, '');
const API_BASE = cleanBase.endsWith('/api') ? cleanBase : `${cleanBase}/api`;

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Dashboard & Analytics
  getDashboardAnalytics: () => client.get('/analytics/dashboard').then(res => res.data),
  getWorkloadAnalytics: (rosterId?: number) => client.get('/analytics/workload', { params: { roster_id: rosterId } }).then(res => res.data),
  getSPOFAnalytics: (): Promise<SPOFRisk[]> => client.get('/analytics/spof').then(res => res.data),

  // Rosters
  getRosters: (month?: number, year?: number): Promise<Roster[]> => client.get('/rosters', { params: { month, year } }).then(res => res.data),
  getRoster: (id: number): Promise<Roster> => client.get(`/rosters/${id}`).then(res => res.data),
  generateRoster: (data: { month: number; year: number; pod_id?: number; brand_id?: number; generated_by?: string }): Promise<Roster> =>
    client.post('/rosters/generate', data).then(res => res.data),
  getRosterGrid: (id: number, params?: { view?: string; pod_id?: number; brand_id?: number; process_id?: number; employee_id?: number }): Promise<RosterGridResponse> =>
    client.get(`/rosters/${id}/grid`, { params }).then(res => res.data),
  updateRosterAssignment: (rosterId: number, assignmentId: number, data: any) =>
    client.put(`/rosters/${rosterId}/assignments/${assignmentId}`, data).then(res => res.data),
  validateRoster: (id: number) => client.post(`/rosters/${id}/validate`).then(res => res.data),
  publishRoster: (id: number, publishedBy: string = 'Operations Lead') =>
    client.post(`/rosters/${id}/publish`, null, { params: { published_by: publishedBy } }).then(res => res.data),
  getRosterCoverage: (id: number) => client.get(`/rosters/${id}/coverage`).then(res => res.data),
  clearRosterConflicts: (id: number) => client.post(`/rosters/${id}/clear-conflicts`).then(res => res.data),
  resetDraftRoster: (id: number) => client.post(`/rosters/${id}/reset-draft`).then(res => res.data),
  regenerateRoster: (id: number, generatedBy?: string) => client.post(`/rosters/${id}/regenerate`, null, { params: { generated_by: generatedBy } }).then(res => res.data),
  getRosterConflicts: (id: number, params?: { severity?: string; brand_id?: number; process_id?: number; employee_id?: number; pod_id?: number; category?: string; resolved?: boolean }): Promise<SchedulingConflict[]> =>
    client.get(`/rosters/${id}/conflicts`, { params }).then(res => res.data),
  resolveConflict: (rosterId: number, conflictId: number, notes?: string) =>
    client.post(`/rosters/${rosterId}/conflicts/${conflictId}/resolve`, null, { params: { notes } }).then(res => res.data),
  getRosterAuditLogs: (id: number) => client.get(`/rosters/${id}/audit`).then(res => res.data),

  // Impact Analyzer
  analyzeImpact: (rosterId: number, data: { employee_id: number; date: string; new_status: string }): Promise<ImpactAnalysisResult> =>
    client.post('/impact/analyze', data, { params: { roster_id: rosterId } }).then(res => res.data),
  applyImpactReplacement: (data: { employee_id: number; date: string; new_status: string; replacement_employee_id?: number; roster_id: number; reason?: string }) =>
    client.post('/impact/apply', data).then(res => res.data),

  // Employees
  getEmployees: (params?: { pod_id?: number; designation?: string; status?: string; search?: string }): Promise<Employee[]> =>
    client.get('/employees', { params }).then(res => res.data),
  getEmployee: (id: number): Promise<Employee> => client.get(`/employees/${id}`).then(res => res.data),
  createEmployee: (data: any): Promise<Employee> => client.post('/employees', data).then(res => res.data),
  updateEmployee: (id: number, data: any): Promise<Employee> => client.put(`/employees/${id}`, data).then(res => res.data),
  deactivateEmployee: (id: number) => client.delete(`/employees/${id}`).then(res => res.data),
  getEmployeeSchedule: (id: number, month?: number, year?: number) =>
    client.get(`/employees/${id}/schedule`, { params: { month, year } }).then(res => res.data),

  // Brands
  getBrands: (params?: { pod_id?: number; status?: string }): Promise<Brand[]> => client.get('/brands', { params }).then(res => res.data),
  createBrand: (data: any): Promise<Brand> => client.post('/brands', data).then(res => res.data),
  updateBrand: (id: number, data: any): Promise<Brand> => client.put(`/brands/${id}`, data).then(res => res.data),
  deleteBrand: (id: number) => client.delete(`/brands/${id}`).then(res => res.data),
  setBrandRule: (brandId: number, data: any) => client.post(`/brands/${brandId}/rules`, data).then(res => res.data),

  // Processes
  getProcesses: (status?: string): Promise<Process[]> => client.get('/processes', { params: { status } }).then(res => res.data),
  createProcess: (data: any): Promise<Process> => client.post('/processes', data).then(res => res.data),
  updateProcess: (id: number, data: any): Promise<Process> => client.put(`/processes/${id}`, data).then(res => res.data),

  // Pods
  getPods: (): Promise<Pod[]> => client.get('/pods').then(res => res.data),
  createPod: (data: any): Promise<Pod> => client.post('/pods', data).then(res => res.data),
  updatePod: (id: number, data: any): Promise<Pod> => client.put(`/pods/${id}`, data).then(res => res.data),

  // Assignments
  getAssignments: (params?: { employee_id?: number; brand_id?: number; process_id?: number }): Promise<Assignment[]> =>
    client.get('/assignments', { params }).then(res => res.data),
  createAssignment: (data: any): Promise<Assignment> => client.post('/assignments', data).then(res => res.data),
  deleteAssignment: (id: number) => client.delete(`/assignments/${id}`).then(res => res.data),

  // Availability
  getAvailabilities: (params?: { employee_id?: number; month?: number; year?: number; status?: string }): Promise<Availability[]> =>
    client.get('/availability', { params }).then(res => res.data),
  createAvailability: (data: any): Promise<Availability> => client.post('/availability', data).then(res => res.data),
  updateAvailability: (id: number, data: any): Promise<Availability> => client.put(`/availability/${id}`, data).then(res => res.data),
  deleteAvailability: (id: number) => client.delete(`/availability/${id}`).then(res => res.data),

  // Holidays
  getHolidays: (year?: number): Promise<PublicHoliday[]> => client.get('/holidays', { params: { year } }).then(res => res.data),
  createHoliday: (data: any): Promise<PublicHoliday> => client.post('/holidays', data).then(res => res.data),
  deleteHoliday: (id: number) => client.delete(`/holidays/${id}`).then(res => res.data),

  // Exports URLs
  getRosterExportUrl: (rosterId: number) => `${API_BASE}/exports/roster?roster_id=${rosterId}`,
  getConflictsExportUrl: (rosterId: number) => `${API_BASE}/exports/conflicts?roster_id=${rosterId}`
};
