import { APIGatewayProxyResult } from 'aws-lambda';
import { DiagnosticReport, Encounter, Patient, Practitioner, ServiceRequest } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZambdaInput } from '../../src/shared/types/common';

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

const { mockOystehr } = vi.hoisted(() => ({
  mockOystehr: {
    fhir: {
      search: vi.fn(),
      transaction: vi.fn(),
    },
  },
}));

vi.mock('../../src/shared/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createClinicalOystehrClient: vi.fn(() => mockOystehr),
  };
});

vi.mock('../../src/shared/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
  };
});

vi.mock('@sentry/node-core/light', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    init: vi.fn(),
    isInitialized: vi.fn(() => true),
    setTag: vi.fn(),
    setTags: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  };
});

import { ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM } from 'utils/lib/fhir/radiology';
import { index as pacsWebhookRaw } from '../../src/ehr/radiology/pacs-webhook/index';

const pacsWebhook = pacsWebhookRaw as unknown as ZambdaHandler;

const ADVAPACS_REPORT_ID = 'advapacs-report-1';
const WEBHOOK_SECRET = 'webhook-secret';

const secrets = {
  AUTH0_ENDPOINT: 'https://auth.example.com',
  AUTH0_CLIENT: 'client',
  AUTH0_SECRET: 'secret',
  AUTH0_AUDIENCE: 'audience',
  FHIR_API: 'https://fhir.example.com',
  PROJECT_API: 'https://project-api.example.com',
  ADVAPACS_CLIENT_ID: 'advapacs-client',
  ADVAPACS_CLIENT_SECRET: 'advapacs-secret',
  ADVAPACS_WEBHOOK_SECRET: WEBHOOK_SECRET,
  ENVIRONMENT: 'local',
};

const callback = (status: DiagnosticReport['status']): ZambdaInput => ({
  headers: { Authorization: `Bearer ${WEBHOOK_SECRET}` },
  body: JSON.stringify({
    resourceType: 'DiagnosticReport',
    id: ADVAPACS_REPORT_ID,
    status,
    code: { text: 'Diagnostic imaging study' },
    presentedForm: [{ contentType: 'text/html', data: 'UHJlbGltaW5hcnk=' }],
  }),
  secrets,
});

const ourReport = (status: DiagnosticReport['status']): DiagnosticReport => ({
  resourceType: 'DiagnosticReport',
  id: 'our-report-1',
  meta: { versionId: 'version-7' },
  status,
  code: { text: 'Diagnostic imaging study' },
  identifier: [{ system: ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM, value: ADVAPACS_REPORT_ID }],
  basedOn: [{ reference: 'ServiceRequest/service-request-1' }],
  subject: { reference: 'Patient/patient-1' },
  presentedForm: [{ contentType: 'text/html', data: 'RmluYWw=' }],
  performer: [{ reference: 'Practitioner/practitioner-1', display: 'Dr. Author' }],
});

const orderResources = [
  {
    resourceType: 'ServiceRequest',
    id: 'service-request-1',
    status: 'completed',
    intent: 'order',
    subject: { reference: 'Patient/patient-1' },
  } as ServiceRequest,
  { resourceType: 'Patient', id: 'patient-1' } as Patient,
  { resourceType: 'Encounter', id: 'encounter-1', status: 'in-progress', class: { code: 'AMB' } } as Encounter,
  { resourceType: 'Practitioner', id: 'practitioner-1' } as Practitioner,
];

describe('radiology-pacs-webhook - DiagnosticReport callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOystehr.fhir.transaction.mockResolvedValue({});
  });

  const storedReportIs = (report: DiagnosticReport): void => {
    mockOystehr.fhir.search.mockResolvedValue({ unbundle: () => [report, ...orderResources] });
  };

  it('ignores a preliminary callback for a read already finalized here', async () => {
    storedReportIs(ourReport('final'));

    const response = await pacsWebhook(callback('preliminary'));

    expect(response.statusCode).toBe(200);
    expect(mockOystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('updates the report only if it is still the version that was read', async () => {
    storedReportIs(ourReport('preliminary'));

    const response = await pacsWebhook(callback('preliminary'));

    expect(response.statusCode).toBe(200);
    const [patch] = mockOystehr.fhir.transaction.mock.calls[0][0].requests;
    expect(patch).toMatchObject({
      method: 'PATCH',
      url: '/DiagnosticReport/our-report-1',
      ifMatch: 'W/"version-7"',
      resource: { resourceType: 'Binary', contentType: 'application/json-patch+json' },
    });
    expect(JSON.parse(atob(patch.resource.data))).toContainEqual({
      op: 'replace',
      path: '/status',
      value: 'preliminary',
    });
  });
});
