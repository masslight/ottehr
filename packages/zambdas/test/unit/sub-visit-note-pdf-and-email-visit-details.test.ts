import { captureException } from '@sentry/node-core/light';
import { Appointment, Encounter, Patient, Task } from 'fhir/r4b';
import { Secrets } from 'utils/lib/secrets';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect as generateVisitDetailsPdf } from '../../src/ehr/visit-details/visit-details-to-pdf';
import { getEmailClient } from '../../src/shared/communication';
import { getAuth0Token } from '../../src/shared/getAuth0Token';
import { createClinicalOystehrClient } from '../../src/shared/helpers';
import { assembleProgressNoteInput } from '../../src/shared/pdf/assemble-progress-note-input';
import { createProgressNotePdf } from '../../src/shared/pdf/progress-note-pdf';
import { getAppointmentAndRelatedResources } from '../../src/shared/pdf/visit-details-pdf/get-video-resources';
import { makeVisitNotePdfDocumentReference } from '../../src/shared/pdf/visit-details-pdf/make-visit-note-pdf-document-reference';
import { patchTaskStatus } from '../../src/subscriptions/helpers';
import { index as _index } from '../../src/subscriptions/task/sub-visit-note-pdf-and-email/index';
import { validateRequestParameters } from '../../src/subscriptions/task/validateRequestParameters';

vi.mock('@sentry/node-core/light', () => ({ captureException: vi.fn() }));
vi.mock('../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, handler: unknown) => handler,
}));
vi.mock('../../src/subscriptions/task/validateRequestParameters', () => ({ validateRequestParameters: vi.fn() }));
vi.mock('../../src/subscriptions/helpers', () => ({ patchTaskStatus: vi.fn() }));
vi.mock('../../src/shared/getAuth0Token', () => ({ getAuth0Token: vi.fn() }));
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createClinicalOystehrClient: vi.fn(),
}));
vi.mock('../../src/shared/communication', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getEmailClient: vi.fn(),
}));
vi.mock('../../src/shared/pdf/visit-details-pdf/get-video-resources', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAppointmentAndRelatedResources: vi.fn(),
}));
vi.mock('../../src/shared/pdf/assemble-progress-note-input', () => ({ assembleProgressNoteInput: vi.fn() }));
vi.mock('../../src/shared/pdf/progress-note-pdf', () => ({ createProgressNotePdf: vi.fn() }));
vi.mock('../../src/shared/pdf/visit-details-pdf/make-visit-note-pdf-document-reference', () => ({
  makeVisitNotePdfDocumentReference: vi.fn(),
}));
vi.mock('../../src/ehr/visit-details/visit-details-to-pdf', () => ({ performEffect: vi.fn() }));

const index = _index as unknown as (input: unknown) => Promise<{ statusCode: number; body: string }>;

const TASK: Task = {
  resourceType: 'Task',
  id: 'task-1',
  status: 'requested',
  intent: 'plan',
  focus: { type: 'Appointment', reference: 'Appointment/appt-1' },
};
const ENCOUNTER: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'finished',
  class: { code: 'AMB' },
  subject: { reference: 'Patient/patient-1' },
};
const oystehr = { fhir: {} };
const SECRETS: Secrets = {};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateRequestParameters).mockReturnValue({ task: TASK, secrets: SECRETS });
  vi.mocked(getAuth0Token).mockResolvedValue('token');
  vi.mocked(createClinicalOystehrClient).mockReturnValue(oystehr as never);
  vi.mocked(getAppointmentAndRelatedResources).mockResolvedValue({
    appointment: { resourceType: 'Appointment', id: 'appt-1', status: 'fulfilled', participant: [] } as Appointment,
    encounter: ENCOUNTER,
    patient: { resourceType: 'Patient', id: 'patient-1' } as Patient,
    timezone: 'America/New_York',
    listResources: [],
  });
  vi.mocked(assembleProgressNoteInput).mockResolvedValue({} as never);
  vi.mocked(createProgressNotePdf).mockResolvedValue({ pdfInfo: { uploadURL: 'https://z3/note.pdf', title: 'note' } });
  vi.mocked(makeVisitNotePdfDocumentReference).mockResolvedValue({
    resourceType: 'DocumentReference',
    id: 'visit-note-1',
    status: 'current',
    content: [],
  });
  vi.mocked(getEmailClient).mockReturnValue(undefined as never);
  vi.mocked(patchTaskStatus).mockImplementation(async ({ taskStatusToUpdate, statusReasonToUpdate }) => ({
    ...TASK,
    status: taskStatusToUpdate,
    statusReason: { text: statusReasonToUpdate },
  }));
});

describe('sub-visit-note-pdf-and-email Visit Details step', () => {
  it('saves the Visit Details PDF as the signing-time copy without reporting an error', async () => {
    vi.mocked(generateVisitDetailsPdf).mockResolvedValue({ documentReference: 'DocumentReference/visit-details-1' });
    expect((await index({ headers: {}, body: '{}', secrets: SECRETS })).statusCode).toBe(200);
    expect(generateVisitDetailsPdf).toHaveBeenCalledWith(oystehr, 'appt-1', SECRETS, 'token', 'America/New_York', {
      signing: true,
    });
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports a failed Visit Details PDF to Sentry and still completes the visit note task', async () => {
    const error = new Error('Visit Details render failed');
    vi.mocked(generateVisitDetailsPdf).mockRejectedValue(error);
    expect((await index({ headers: {}, body: '{}', secrets: SECRETS })).statusCode).toBe(200);
    expect(captureException).toHaveBeenCalledWith(error);
    expect(makeVisitNotePdfDocumentReference).toHaveBeenCalledOnce();
    expect(patchTaskStatus).toHaveBeenCalledWith(
      expect.objectContaining({ task: { id: 'task-1' }, taskStatusToUpdate: 'completed' }),
      oystehr
    );
  });
});
