export interface Employee {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  phone?: string;
  status: string;
  pod_id?: number;
  pod_name?: string;
  designation: string;
  joining_date: string;
  employment_type: string;
  max_hours_per_day: number;
  preferred_weekly_off: number;
  fixed_weekly_off?: number;
  skills: string;
  assigned_brands?: string[];
  assigned_processes?: string[];
}

export interface Pod {
  id: number;
  pod_name: string;
  pod_lead_name: string;
  description?: string;
  status: string;
  employee_count?: number;
}

export interface Brand {
  id: number;
  name: string;
  code: string;
  industry: string;
  description?: string;
  status: string;
  assigned_pod_id?: number;
  assigned_pod_name?: string;
  employee_count?: number;
  operating_rules?: OperatingRule[];
}

export interface Process {
  id: number;
  name: string;
  code: string;
  description?: string;
  default_shift_duration: number;
  status: string;
}

export interface OperatingRule {
  id: number;
  brand_id: number;
  brand_name?: string;
  process_id: number;
  process_name?: string;
  operating_mode: string;
  working_weekdays: string;
  sunday_operation: boolean;
  public_holiday_operation: boolean;
  min_required_employees: number;
  max_required_employees: number;
  shift_start_time: string;
  shift_end_time: string;
}

export interface Assignment {
  id: number;
  employee_id: number;
  employee_name?: string;
  brand_id: number;
  brand_name?: string;
  process_id: number;
  process_name?: string;
  assigned_role: string;
  allocation_percentage: number;
  priority: number;
  active: boolean;
}

export interface Availability {
  id: number;
  employee_id: number;
  employee_name?: string;
  date: string;
  status: string;
  leave_type?: string;
  approval_status: string;
  reason: string;
  notes?: string;
}

export interface PublicHoliday {
  id: number;
  holiday_name: string;
  date: string;
  applicable_region: string;
  applicable_brands: string;
  holiday_type: string;
}

export interface Roster {
  id: number;
  month: number;
  year: number;
  version: number;
  status: string;
  generated_date: string;
  generated_by: string;
  validation_status: string;
  published_date?: string;
  published_by?: string;
  total_assignments: number;
  coverage_percentage: number;
  critical_conflicts: number;
  warnings_count: number;
}

export interface GridCell {
  date: string;
  day_number: number;
  weekday: string;
  is_weekend: boolean;
  assignment_id?: number;
  work_status: string; // Working, Weekly Off, Leave, Comp-Off, Public Holiday, Unavailable
  brand_id?: number;
  brand_name?: string;
  process_id?: number;
  process_name?: string;
  shift_start: string;
  shift_end: string;
  assignment_source: string;
  notes?: string;
}

export interface GridRow {
  employee_id: number;
  emp_code: string;
  full_name: string;
  designation: string;
  pod_id?: number;
  pod_name?: string;
  assigned_brands: string[];
  assigned_processes: string[];
  stats: {
    working_days: number;
    weekly_offs: number;
    leaves: number;
  };
  days: GridCell[];
}

export interface RosterGridResponse {
  roster_id: number;
  month: number;
  year: number;
  days_in_month: number;
  status: string;
  validation_status: string;
  rows: GridRow[];
}

export interface SchedulingConflict {
  id: number;
  roster_id: number;
  severity: string; // CRITICAL, WARNING, INFO
  date: string;
  brand_id?: number;
  brand_name?: string;
  process_id?: number;
  process_name?: string;
  employee_id?: number;
  employee_name?: string;
  expected_staffing: number;
  actual_staffing: number;
  explanation: string;
  suggested_resolution: string;
  resolved: boolean;
  resolution_notes?: string;
}

export interface BackupCandidate {
  employee_id: number;
  employee_name: string;
  pod_id?: number;
  pod_name?: string;
  current_weekly_shifts: number;
  max_weekly_shifts: number;
  is_same_pod: boolean;
  skill_match: boolean;
  recommendation_score: number;
  explanation: string;
}

export interface ImpactAnalysisResult {
  affected_employee_id: number;
  affected_employee_name: string;
  date: string;
  new_status: string;
  affected_assignments: Array<{
    brand_id: number;
    brand_name: string;
    process_id: number;
    process_name: string;
    role: string;
    priority: number;
  }>;
  coverage_before_percent: number;
  coverage_after_percent: number;
  critical_conflicts_before: number;
  critical_conflicts_after: number;
  backup_recommendations: BackupCandidate[];
  can_auto_replace: boolean;
}

export interface SPOFRisk {
  brand_id: number;
  brand_name: string;
  brand_code: string;
  industry: string;
  pod_name: string;
  dedicated_employees_count: number;
  dedicated_employees: string[];
  process_count: number;
  risk_level: string; // HIGH, MEDIUM, LOW
  risk_summary: string;
  recommended_mitigation: string;
}
