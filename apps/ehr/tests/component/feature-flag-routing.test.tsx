import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── PlanTab: FORMS_ENABLED ─────────────────────────────────────────────────
// Each describe block is a separate file-level test group with its own vi.mock calls.
// vi.mock is hoisted to the top of the file, so we use vi.hoisted() for shared state.

const featureFlagsMock = vi.hoisted(() => ({
  FEATURE_FLAGS: {
    LAB_ORDERS_ENABLED: false,
    RADIOLOGY_ENABLED: false,
    IN_HOUSE_LABS_ENABLED: false,
    NURSING_ORDERS_ENABLED: false,
    SUPERVISOR_APPROVAL_ENABLED: false,
    DEMO_VISITS_ENABLED: false,
    GLOBAL_TEMPLATES_ENABLED: false,
    FORMS_ENABLED: false,
    LEGACY_DATA_ENABLED: false,
    LEGACY_PATIENT_FOLLOWUPS_ENABLED: false,
    MAILING_PAPER_STATEMENTS_ENABLED: false,
    SKIP_SENDING_VISIT_NOTE_TO_PATIENT_PORTAL_WHEN_THE_NOTE_IS_SIGNED_FEATURE_FLAG: false,
  },
}));

vi.mock('src/constants/feature-flags', () => featureFlagsMock);

// Mock stores used by PlanTab and Plan
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: vi.fn(() => ({ isChartDataLoading: false, chartDataError: null })),
  useAppointmentData: vi.fn(() => ({
    locationVirtual: { name: 'Test Location' },
    appointment: { id: 'test-appointment' },
    location: { name: 'Test Location' },
    isAppointmentLoading: false,
    appointmentError: null,
  })),
  useDeleteChartData: vi.fn(() => ({ mutate: vi.fn() })),
}));

// Stub child components to isolate flag behavior
vi.mock('../../src/features/visits/shared/components/DispositionCard', () => ({
  DispositionCard: () => <div data-testid="disposition-card">DispositionCard</div>,
}));
vi.mock('../../src/features/visits/shared/components/FormsCard', () => ({
  FormsCard: () => <div data-testid="forms-card">FormsCard</div>,
}));
vi.mock('../../src/features/visits/shared/components/SchoolWorkExcuseCard', () => ({
  SchoolWorkExcuseCard: () => <div data-testid="school-work-excuse-card">SchoolWorkExcuseCard</div>,
}));
vi.mock('../../src/features/visits/shared/components/plan-tab/ERxCard', () => ({
  ERxCard: () => <div data-testid="erx-card">ERxCard</div>,
}));
vi.mock('../../src/features/visits/shared/components/plan-tab/HealthwiseDocumentsCard', () => ({
  HealthwiseDocumentsCard: () => <div>HealthwiseDocumentsCard</div>,
}));
vi.mock('../../src/features/visits/shared/components/plan-tab/PatientInstructionsCard', () => ({
  PatientInstructionsCard: () => <div data-testid="patient-instructions-card">PatientInstructionsCard</div>,
}));
vi.mock('../../src/features/visits/shared/components/Loader', () => ({
  Loader: () => <div>Loading...</div>,
}));
vi.mock('../../src/features/visits/shared/components/PageTitle', () => ({
  PageTitle: ({ label, dataTestId }: { label: string; dataTestId?: string }) => (
    <h1 data-testid={dataTestId}>{label}</h1>
  ),
}));

// Mock HistoryAndTemplates dependencies
vi.mock('src/components/AccordionCard', () => ({
  AccordionCard: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div data-testid="template-accordion" data-label={label}>
      {children}
    </div>
  ),
}));
vi.mock('../../src/features/visits/shared/components/HpiSection', () => ({
  HPISection: () => <div data-testid="hpi-section">HPI</div>,
}));
vi.mock('../../src/features/visits/shared/components/templates/ApplyTemplate', () => ({
  ApplyTemplate: () => <div data-testid="apply-template">ApplyTemplate</div>,
}));

import { HistoryAndTemplates } from '../../src/features/visits/in-person/pages/HistoryAndTemplates';
import { Plan } from '../../src/features/visits/in-person/pages/Plan';
import { PlanTab } from '../../src/features/visits/shared/components/plan-tab/PlanTab';

// Helper to set flags for each test
function setFlags(overrides: Partial<typeof featureFlagsMock.FEATURE_FLAGS>): void {
  Object.assign(featureFlagsMock.FEATURE_FLAGS, {
    LAB_ORDERS_ENABLED: false,
    RADIOLOGY_ENABLED: false,
    IN_HOUSE_LABS_ENABLED: false,
    NURSING_ORDERS_ENABLED: false,
    SUPERVISOR_APPROVAL_ENABLED: false,
    DEMO_VISITS_ENABLED: false,
    GLOBAL_TEMPLATES_ENABLED: false,
    FORMS_ENABLED: false,
    LEGACY_DATA_ENABLED: false,
    LEGACY_PATIENT_FOLLOWUPS_ENABLED: false,
    MAILING_PAPER_STATEMENTS_ENABLED: false,
    SKIP_SENDING_VISIT_NOTE_TO_PATIENT_PORTAL_WHEN_THE_NOTE_IS_SIGNED_FEATURE_FLAG: false,
    ...overrides,
  });
}

describe('PlanTab - FORMS_ENABLED flag', () => {
  beforeEach(() => {
    setFlags({});
  });

  it('shows FormsCard when FORMS_ENABLED is true', () => {
    setFlags({ FORMS_ENABLED: true });
    render(<PlanTab />);
    expect(screen.getByTestId('forms-card')).toBeDefined();
  });

  it('hides FormsCard when FORMS_ENABLED is false', () => {
    setFlags({ FORMS_ENABLED: false });
    render(<PlanTab />);
    expect(screen.queryByTestId('forms-card')).toBeNull();
  });

  it('always shows ERxCard regardless of FORMS_ENABLED', () => {
    setFlags({ FORMS_ENABLED: false });
    render(<PlanTab />);
    expect(screen.getByTestId('erx-card')).toBeDefined();
  });
});

describe('Plan (in-person) - FORMS_ENABLED flag', () => {
  beforeEach(() => {
    setFlags({});
  });

  it('shows FormsCard when FORMS_ENABLED is true', () => {
    setFlags({ FORMS_ENABLED: true });
    render(<Plan />);
    expect(screen.getByTestId('forms-card')).toBeDefined();
  });

  it('hides FormsCard when FORMS_ENABLED is false', () => {
    setFlags({ FORMS_ENABLED: false });
    render(<Plan />);
    expect(screen.queryByTestId('forms-card')).toBeNull();
  });
});

describe('HistoryAndTemplates - GLOBAL_TEMPLATES_ENABLED flag', () => {
  beforeEach(() => {
    setFlags({});
  });

  it('shows Template accordion when GLOBAL_TEMPLATES_ENABLED is true', () => {
    setFlags({ GLOBAL_TEMPLATES_ENABLED: true });
    render(<HistoryAndTemplates />);
    expect(screen.getByTestId('template-accordion')).toBeDefined();
    expect(screen.getByTestId('apply-template')).toBeDefined();
  });

  it('hides Template accordion when GLOBAL_TEMPLATES_ENABLED is false', () => {
    setFlags({ GLOBAL_TEMPLATES_ENABLED: false });
    render(<HistoryAndTemplates />);
    expect(screen.queryByTestId('template-accordion')).toBeNull();
    expect(screen.queryByTestId('apply-template')).toBeNull();
    // HPI section should still be present
    expect(screen.getByTestId('hpi-section')).toBeDefined();
  });
});
