import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { Coverage, Patient } from 'fhir/r4b';
import { getConsentAndRelatedDocRefsForAppointment } from 'utils/lib/fhir/appointments';
import { CoverageCheckWithDetails } from 'utils/lib/types/api/patient-account';
import { OrderedCoveragesWithSubscribers } from 'utils/lib/types/data/account';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccountAndCoverageResourcesForPatient } from '../../src/ehr/shared/harvest';
import { searchDocumentReferencesForVisit } from '../../src/ehr/visit-details/get-visit-files';
import { performEffect } from '../../src/ehr/visit-details/visit-details-to-pdf';
import { getPatientCoverageChecks } from '../../src/shared/patient-coverage-checks';
import { makeVisitDetailsPdfDocumentReference } from '../../src/shared/pdf/make-visit-details-document-reference';
import { createVisitDetailsPdf } from '../../src/shared/pdf/visit-details-pdf';
import { getAppointmentAndRelatedResources } from '../../src/shared/pdf/visit-details-pdf/get-video-resources';

vi.mock('@sentry/node-core/light', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sentry/node-core/light')>()),
  captureException: vi.fn(),
}));
vi.mock('utils/lib/fhir/appointments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/fhir/appointments')>()),
  getConsentAndRelatedDocRefsForAppointment: vi.fn(),
}));
vi.mock('../../src/ehr/shared/harvest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/ehr/shared/harvest')>()),
  getAccountAndCoverageResourcesForPatient: vi.fn(),
}));
vi.mock('../../src/ehr/visit-details/get-visit-files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/ehr/visit-details/get-visit-files')>()),
  searchDocumentReferencesForVisit: vi.fn(),
}));
vi.mock('../../src/shared/patient-coverage-checks', () => ({ getPatientCoverageChecks: vi.fn() }));
vi.mock('../../src/shared/pdf/visit-details-pdf', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/pdf/visit-details-pdf')>()),
  createVisitDetailsPdf: vi.fn(),
}));
vi.mock('../../src/shared/pdf/make-visit-details-document-reference', () => ({
  makeVisitDetailsPdfDocumentReference: vi.fn(),
}));
vi.mock('../../src/shared/pdf/visit-details-pdf/get-video-resources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/pdf/visit-details-pdf/get-video-resources')>()),
  getAppointmentAndRelatedResources: vi.fn(),
}));

const PATIENT: Patient = { resourceType: 'Patient', id: 'patient-1' };
const COVERAGE: Coverage = {
  resourceType: 'Coverage',
  id: 'cov-1',
  status: 'active',
  beneficiary: { reference: 'Patient/patient-1' },
  payor: [{ reference: 'Organization/payer' }],
};
const CHECKS = [{ subscriberId: 'S-1' }] as CoverageCheckWithDetails[];
const oystehr = {} as Oystehr;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAppointmentAndRelatedResources).mockResolvedValue({
    appointment: { resourceType: 'Appointment', id: 'appt-1', status: 'fulfilled', participant: [] },
    encounter: { resourceType: 'Encounter', id: 'enc-1', status: 'finished', class: { code: 'AMB' } },
    patient: PATIENT,
    timezone: 'America/New_York',
    listResources: [],
  });
  vi.mocked(getConsentAndRelatedDocRefsForAppointment).mockResolvedValue({ consents: [], docRefs: [] });
  vi.mocked(searchDocumentReferencesForVisit).mockResolvedValue([]);
  vi.mocked(createVisitDetailsPdf).mockResolvedValue({ pdfInfo: { uploadURL: 'https://z3/visit.pdf', title: 'pdf' } });
  vi.mocked(makeVisitDetailsPdfDocumentReference).mockResolvedValue({
    resourceType: 'DocumentReference',
    id: 'doc-1',
    status: 'current',
    content: [],
  });
});

const generate = async (
  coverages: OrderedCoveragesWithSubscribers
): Promise<CoverageCheckWithDetails[] | undefined> => {
  vi.mocked(getAccountAndCoverageResourcesForPatient).mockResolvedValue({
    patient: PATIENT,
    coverages,
    insuranceOrgs: [],
  });
  await performEffect(oystehr, 'appt-1', null, 'token');
  expect(makeVisitDetailsPdfDocumentReference).toHaveBeenCalledOnce();
  return vi.mocked(createVisitDetailsPdf).mock.calls[0][0].coverageChecks;
};

describe('visit-details-to-pdf eligibility loading', () => {
  it('does not load eligibility checks for a visit without insurance', async () => {
    expect(await generate({})).toEqual([]);
    expect(getPatientCoverageChecks).not.toHaveBeenCalled();
  });

  it.each(['primary', 'secondary'] as const)(
    "loads the patient's eligibility checks once when the visit has %s insurance",
    async (priority) => {
      vi.mocked(getPatientCoverageChecks).mockResolvedValue(CHECKS);
      expect(await generate({ [priority]: COVERAGE })).toBe(CHECKS);
      expect(getPatientCoverageChecks).toHaveBeenCalledOnce();
      expect(getPatientCoverageChecks).toHaveBeenCalledWith('patient-1', oystehr);
    }
  );

  it('saves the PDF exactly as createVisitDetailsPdf returned it, linked to the encounter', async () => {
    const pdfInfo = { uploadURL: 'https://z3/visit.pdf', title: 'Visit Details: 11-20-2026' };
    vi.mocked(createVisitDetailsPdf).mockResolvedValue({ pdfInfo });
    await generate({});
    expect(makeVisitDetailsPdfDocumentReference).toHaveBeenCalledWith(
      oystehr,
      pdfInfo,
      'patient-1',
      'appt-1',
      'enc-1',
      [],
      undefined
    );
    expect(vi.mocked(makeVisitDetailsPdfDocumentReference).mock.calls[0][1]).toBe(pdfInfo);
    expect(pdfInfo).toEqual({ uploadURL: 'https://z3/visit.pdf', title: 'Visit Details: 11-20-2026' });
  });

  it('still creates the PDF and reports the error when the checks cannot be loaded', async () => {
    const error = new Error('FHIR unavailable');
    vi.mocked(getPatientCoverageChecks).mockRejectedValue(error);
    expect(await generate({ primary: COVERAGE })).toBeUndefined();
    expect(captureException).toHaveBeenCalledWith(error);
  });
});
