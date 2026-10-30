// Fictional people shared by the data generator and the Demo-mode personas, so the
// sample history and the demo logins are consistent (e.g. "Manager (IT)" in demo
// mode is the same person who reviewed IT requests in the sample data).
// All names and EMP numbers are invented.
import { DEPARTMENTS, TEAMS } from './enums.js';

export const MANAGERS = {
  Finance: { id: 'EMP-3001', name: 'Morgan Ellery' },
  HR: { id: 'EMP-3002', name: 'Devika Ranasuriya' },
  IT: { id: 'EMP-3003', name: 'Theo Blackwood' },
  Operations: { id: 'EMP-3004', name: 'Asha Wimalaratne' },
  Sales: { id: 'EMP-3005', name: 'Lucas Hartwell' },
  Marketing: { id: 'EMP-3006', name: 'Priyanka Dissan' },
  Legal: { id: 'EMP-3007', name: 'Oliver Grant' },
};

export const FULFILLERS = {
  'IT Service Desk': { id: 'EMP-4001', name: 'Kasun Jayaweera', department: 'IT' },
  'IT Asset Team': { id: 'EMP-4002', name: 'Mira Solberg', department: 'IT' },
  'Facilities Team': { id: 'EMP-4003', name: 'Rohan Gunasekara', department: 'Operations' },
  'Operations Support': { id: 'EMP-4004', name: 'Fatima Noorani', department: 'Operations' },
};

export const ADMIN = { id: 'EMP-5001', name: 'Sam Rivera', department: 'IT' };
export const LEADER = { id: 'EMP-6001', name: 'Helena Marsh', department: 'Operations' };

/** One fixed staff member per department; the generator makes them regular requesters. */
export const DEMO_STAFF = {
  Finance: { id: 'EMP-2001', name: 'Avery Fernwood' },
  HR: { id: 'EMP-2002', name: 'Jordan Ashby' },
  IT: { id: 'EMP-2003', name: 'Kiran Morrow' },
  Operations: { id: 'EMP-2004', name: 'Sasha Quill' },
  Sales: { id: 'EMP-2005', name: 'Rowan Halden' },
  Marketing: { id: 'EMP-2006', name: 'Tariq Brightwater' },
  Legal: { id: 'EMP-2007', name: 'Mei Senarath' },
};

/** Demo-mode personas (Demo mode only - NOT authentication). */
export const PERSONAS = [
  { key: 'leadership', label: 'Leadership', role: 'Leadership', ...LEADER },
  { key: 'staff-it', label: 'Staff (IT)', role: 'Staff', department: 'IT', ...DEMO_STAFF.IT },
  { key: 'staff-finance', label: 'Staff (Finance)', role: 'Staff', department: 'Finance', ...DEMO_STAFF.Finance },
  { key: 'manager-it', label: 'Manager (IT)', role: 'Manager', department: 'IT', ...MANAGERS.IT },
  { key: 'manager-operations', label: 'Manager (Operations)', role: 'Manager', department: 'Operations', ...MANAGERS.Operations },
  { key: 'fulfiller-servicedesk', label: 'Fulfiller (IT Service Desk)', role: 'Fulfiller', team: 'IT Service Desk', ...FULFILLERS['IT Service Desk'] },
  { key: 'fulfiller-facilities', label: 'Fulfiller (Facilities Team)', role: 'Fulfiller', team: 'Facilities Team', ...FULFILLERS['Facilities Team'] },
  { key: 'admin', label: 'Admin', role: 'Admin', ...ADMIN },
];

// Sanity: every department has a manager and staff member, every team a fulfiller.
for (const d of DEPARTMENTS) if (!MANAGERS[d] || !DEMO_STAFF[d]) throw new Error(`people.js: missing people for ${d}`);
for (const t of TEAMS) if (!FULFILLERS[t]) throw new Error(`people.js: missing fulfiller for ${t}`);
