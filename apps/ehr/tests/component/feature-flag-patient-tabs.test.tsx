import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: 'test-patient-id' })),
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
    useNavigate: vi.fn(),
  };
});

// Mock patient data hooks
vi.mock('../../src/hooks/useGetPatient', () => ({
  useGetPatient: vi.fn(() => ({
    patient: {
      id: 'test-patient',
      resourceType: 'Patient',
      name: [{ given: ['Test'], family: 'Patient' }],
    },
    isLoading: false,
  })),
}));

vi.mock('../../src/hooks/useGetPatientVisitHistory', () => ({
  useGetPatientVisitHistory: vi.fn(() => ({
    data: [],
    isLoading: false,
  })),
}));

// Stub tab content components
vi.mock('../../src/components/PatientEncountersGrid', () => ({
  PatientEncountersGrid: () => <div data-testid="encounters-grid">Encounters</div>,
}));
vi.mock('../../src/features/visits/shared/components/patient/PatientFollowupEncountersGrid', () => ({
  PatientFollowupEncountersGrid: () => <div data-testid="followup-grid">Followups</div>,
}));
vi.mock('../../src/features/lab-orders/components/PatientLabsTab', () => ({
  PatientLabsTab: () => <div data-testid="labs-tab-content">Labs</div>,
}));
vi.mock('../../src/features/in-house-labs/components/PatientInHouseLabsTab', () => ({
  PatientInHouseLabsTab: () => <div data-testid="in-house-labs-tab-content">InHouseLabs</div>,
}));
vi.mock('../../src/features/radiology/components/PatientRadiologyTab', () => ({
  PatientRadiologyTab: () => <div data-testid="radiology-tab-content">Radiology</div>,
}));
vi.mock('../../src/components/dialogs/AccountSettingsDialog', () => ({
  AccountSettingsDialog: () => null,
}));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: {
      fhir: { search: vi.fn().mockResolvedValue({ unbundle: () => [] }) },
    },
    oystehrZambda: null,
  }),
}));

// Mock api.ts to avoid VITE_APP_IS_LOCAL check
vi.mock('../../src/api/api', () => ({
  getAppointments: vi.fn(),
  getUser: vi.fn(),
  apiClient: {},
}));

// Mock deep dependencies that PatientPage transitively imports
vi.mock('../../src/features/visits/in-person/routing/routesInPerson', () => ({
  ROUTER_PATH: {
    patientInformation: '/patient/:id/info',
  },
  routesInPerson: [],
}));

vi.mock('../../src/features/visits/shared/components/patient/info/Avatar', () => ({
  PatientAvatar: () => <div>Avatar</div>,
}));
vi.mock('../../src/features/visits/shared/components/patient/info/Contacts', () => ({
  default: () => <div>Contacts</div>,
}));
vi.mock('../../src/features/visits/shared/components/patient/info/FullNameDisplay', () => ({
  FullNameDisplay: () => <div>Name</div>,
}));
vi.mock('../../src/features/visits/shared/components/patient/info/IdentifiersRow', () => ({
  IdentifiersRow: () => <div>Identifiers</div>,
}));
vi.mock('../../src/features/visits/shared/components/patient/info/Summary', () => ({
  default: () => <div>Summary</div>,
}));
vi.mock('../../src/components/CustomBreadcrumbs', () => ({
  default: () => <div>Breadcrumbs</div>,
}));
vi.mock('../../src/components/RoundedButton', () => ({
  RoundedButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

import PatientPage from '../../src/pages/PatientPage';

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

const renderPatientPage = (): ReturnType<typeof render> =>
  render(
    <BrowserRouter>
      <PatientPage />
    </BrowserRouter>
  );

describe('PatientPage - LAB_ORDERS_ENABLED', () => {
  beforeEach(() => setFlags({}));

  it('shows Labs tab when enabled', () => {
    setFlags({ LAB_ORDERS_ENABLED: true });
    renderPatientPage();
    const tabs = screen.getAllByRole('tab');
    const labTab = tabs.find((t) => t.textContent?.match(/^Labs/));
    expect(labTab).toBeDefined();
  });

  it('hides Labs tab when disabled', () => {
    setFlags({ LAB_ORDERS_ENABLED: false });
    renderPatientPage();
    const tabs = screen.getAllByRole('tab');
    const labTab = tabs.find((t) => t.textContent?.match(/^Labs/));
    expect(labTab).toBeUndefined();
  });
});

describe('PatientPage - RADIOLOGY_ENABLED', () => {
  beforeEach(() => setFlags({}));

  it('shows Radiology tab when enabled', () => {
    setFlags({ RADIOLOGY_ENABLED: true });
    renderPatientPage();
    expect(screen.getByRole('tab', { name: /radiology/i })).toBeDefined();
  });

  it('hides Radiology tab when disabled', () => {
    setFlags({ RADIOLOGY_ENABLED: false });
    renderPatientPage();
    expect(screen.queryByRole('tab', { name: /radiology/i })).toBeNull();
  });
});

describe('PatientPage - IN_HOUSE_LABS_ENABLED', () => {
  beforeEach(() => setFlags({}));

  it('shows In-House Labs tab when enabled', () => {
    setFlags({ IN_HOUSE_LABS_ENABLED: true });
    renderPatientPage();
    expect(screen.getByRole('tab', { name: /in-house labs/i })).toBeDefined();
  });

  it('hides In-House Labs tab when disabled', () => {
    setFlags({ IN_HOUSE_LABS_ENABLED: false });
    renderPatientPage();
    expect(screen.queryByRole('tab', { name: /in-house labs/i })).toBeNull();
  });
});

describe('PatientPage - LEGACY_PATIENT_FOLLOWUPS_ENABLED', () => {
  beforeEach(() => setFlags({}));

  it('shows Followups tab when enabled', () => {
    setFlags({ LEGACY_PATIENT_FOLLOWUPS_ENABLED: true });
    renderPatientPage();
    expect(screen.getByRole('tab', { name: /follow-up/i })).toBeDefined();
  });

  it('hides Followups tab when disabled', () => {
    setFlags({ LEGACY_PATIENT_FOLLOWUPS_ENABLED: false });
    renderPatientPage();
    expect(screen.queryByRole('tab', { name: /follow-up/i })).toBeNull();
  });
});

describe('PatientPage - all tabs combined', () => {
  beforeEach(() => setFlags({}));

  it('shows all optional tabs when all relevant flags are enabled', () => {
    setFlags({
      LAB_ORDERS_ENABLED: true,
      RADIOLOGY_ENABLED: true,
      IN_HOUSE_LABS_ENABLED: true,
      LEGACY_PATIENT_FOLLOWUPS_ENABLED: true,
    });
    renderPatientPage();
    const tabs = screen.getAllByRole('tab');
    const tabNames = tabs.map((t) => t.textContent);
    expect(tabNames.some((name) => name?.match(/^Labs/))).toBe(true);
    expect(tabNames.some((name) => name?.match(/Radiology/))).toBe(true);
    expect(tabNames.some((name) => name?.match(/In-House Labs/))).toBe(true);
    expect(tabNames.some((name) => name?.match(/Follow-up/i))).toBe(true);
  });

  it('hides all optional tabs when all flags are disabled', () => {
    setFlags({});
    renderPatientPage();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(1);
    expect(tabs[0].textContent).toMatch(/visits/i);
  });
});
