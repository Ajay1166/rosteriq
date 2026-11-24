import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Overview } from './pages/Overview';
import { RosterPlanner } from './pages/RosterPlanner';
import { Employees } from './pages/Employees';
import { Brands } from './pages/Brands';
import { Processes } from './pages/Processes';
import { Pods } from './pages/Pods';
import { ResourceAllocation } from './pages/ResourceAllocation';
import { AvailabilityPage } from './pages/Availability';
import { Holidays } from './pages/Holidays';
import { CoverageConflicts } from './pages/CoverageConflicts';
import { ReportsExports } from './pages/ReportsExports';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Overview />} />
          <Route path="planner" element={<RosterPlanner />} />
          <Route path="employees" element={<Employees />} />
          <Route path="brands" element={<Brands />} />
          <Route path="processes" element={<Processes />} />
          <Route path="pods" element={<Pods />} />
          <Route path="allocation" element={<ResourceAllocation />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="holidays" element={<Holidays />} />
          <Route path="conflicts" element={<CoverageConflicts />} />
          <Route path="reports" element={<ReportsExports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
