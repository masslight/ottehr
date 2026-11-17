import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Patient } from 'fhir/r4b';
import { userMe } from 'utils/lib/auth/user-me.helper';
import { SecretsKeys } from 'utils/lib/secrets';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZambdaInput } from '../../src/shared/types/common';

const APPOINTMENT_ID = 'ced69961-839d-4df6-a2f2-35bf9f52e69e';
const M2M_CLIENT_ID = 'hello-patient-client';
const forbidden = (): Error => new Oystehr.OystehrSdkError({ message: 'Forbidden', code: '4031' as unknown as number });

const jwt = (payload: Record<string, unknown>): string => {
  const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.sig`;
};

const appointment: Appointment = {
  resourceType: 'Appointment',
  id: APPOINTMENT_ID,
  status: 'booked',
  start: '2026-10-09T15:00:00Z',
  participant: [{ actor: { reference: 'Patient/patient-1' }, status: 'accepted' }],
};
const patient: Patient = { resourceType: 'Patient', id: 'patient-1' };
const location: Location = { resourceType: 'Location', id: 'loc-1' };
const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'planned',
  class: { code: 'AMB' },
};

const transaction = vi.fn();
const m2mMe = vi.fn();

vi.mock('utils/lib/auth/user-me.helper', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/auth/user-me.helper')>()),
  userMe: vi.fn(async () => {
    throw forbidden();
  }),
}));
vi.mock('../../src/shared/sentry', () => ({
  wrapHandler: (_name: string, handler: (input: ZambdaInput) => unknown) => handler,
}));
vi.mock('../../src/shared/getAuth0Token', () => ({ getAuth0Token: vi.fn(async () => 'zambda-m2m-token') }));
vi.mock('../../src/shared/helpers', () => ({
  createClinicalOystehrClient: vi.fn(() => ({ fhir: { transaction }, m2m: { me: m2mMe } })),
}));
vi.mock('utils/lib/fhir/appointments', () => ({ getAppointmentResourceById: vi.fn(async () => appointment) }));
vi.mock('../../src/shared/encounters', () => ({
  getMainEncounterDetails: vi.fn(async () => ({ encounter, curStatusHistoryIdx: -1, canceledHistoryIdx: -1 })),
}));
vi.mock('../../src/shared/validateBundleAndExtractAppointment', () => ({
  validateBundleAndExtractAppointment: vi.fn(() => ({
    appointment,
    scheduleResource: location,
    patient,
  })),
}));
vi.mock('../../src/shared/userAuditLog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/userAuditLog')>()),
  createAuditEvent: vi.fn(async () => undefined),
}));

const { createClinicalOystehrClient } = await import('../../src/shared/helpers');
const { index } = await import('../../src/patient/appointment/prebook-cancel-appointment');

const invoke = (token: string): Promise<unknown> =>
  (index as unknown as (input: ZambdaInput) => Promise<unknown>)({
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ appointmentID: APPOINTMENT_ID, cancellationReason: 'Patient improved', silent: true }),
    secrets: { [SecretsKeys.PROJECT_ID]: 'project-1' },
  } as ZambdaInput);

describe('cancel-appointment — M2M caller (Hello Patient)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockResolvedValue({ entry: [] });
  });

  const cancelledBy = (): string => {
    const [{ requests }] = transaction.mock.calls[0];
    const appointmentPatch = requests.find((r: { url: string }) => r.url === `/Appointment/${APPOINTMENT_ID}`);
    const ops = JSON.parse(Buffer.from(appointmentPatch.resource.data, 'base64').toString());
    expect(ops).toContainEqual({ op: 'replace', path: '/status', value: 'cancelled' });
    return JSON.stringify(ops);
  };

  it('verifies the M2M token with Oystehr and attributes the change to the verified client', async () => {
    m2mMe.mockResolvedValue({ id: 'm2m-1', clientId: M2M_CLIENT_ID });
    const token = jwt({ sub: `${M2M_CLIENT_ID}@clients` });

    const result = (await invoke(token)) as { statusCode: number };

    expect(result.statusCode).toBe(200);
    expect(userMe).not.toHaveBeenCalled();
    expect(createClinicalOystehrClient).toHaveBeenCalledWith(token, expect.anything(), { projectId: 'project-1' });
    expect(cancelledBy()).toContain(`M2M Client ${M2M_CLIENT_ID}`);
  });

  it('rejects an M2M token Oystehr does not accept instead of trusting its subject', async () => {
    m2mMe.mockRejectedValue(forbidden());

    await expect(invoke(jwt({ sub: 'spoofed-client@clients' }))).rejects.toEqual(NOT_AUTHORIZED);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects an M2M token whose subject does not match the client Oystehr resolves', async () => {
    m2mMe.mockResolvedValue({ id: 'm2m-1', clientId: M2M_CLIENT_ID });

    await expect(invoke(jwt({ sub: 'spoofed-client@clients' }))).rejects.toEqual(NOT_AUTHORIZED);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rethrows non-auth errors from M2M verification', async () => {
    const error = new Oystehr.OystehrSdkError({ message: 'boom', code: 500 });
    m2mMe.mockRejectedValue(error);

    await expect(invoke(jwt({ sub: `${M2M_CLIENT_ID}@clients` }))).rejects.toBe(error);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('still resolves real user tokens through user.me() and maps its 4031 to NOT_AUTHORIZED', async () => {
    await expect(invoke(jwt({ sub: 'auth0|some-user' }))).rejects.toEqual(NOT_AUTHORIZED);
    expect(userMe).toHaveBeenCalledTimes(1);
    expect(m2mMe).not.toHaveBeenCalled();
  });
});
