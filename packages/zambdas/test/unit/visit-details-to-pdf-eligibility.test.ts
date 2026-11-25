import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { Coverage, DocumentReference, Organization, Patient } from 'fhir/r4b';
import { getConsentAndRelatedDocRefsForAppointment } from 'utils/lib/fhir/appointments';
import { OYSTEHR_RCM_PAYER_ID_SYSTEM } from 'utils/lib/fhir/constants';
import { CoverageCheckWithDetails } from 'utils/lib/types/api/patient-account';
import { OrderedCoveragesWithSubscribers } from 'utils/lib/types/data/account';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccountAndCoverageResourcesForPatient } from '../../src/ehr/shared/harvest';
import { searchDocumentReferencesForVisit } from '../../src/ehr/visit-details/get-visit-files';
import { performEffect } from '../../src/ehr/visit-details/visit-details-to-pdf';
import { findLatestCoverageCheck } from '../../src/shared/patient-coverage-checks';
import {
  findSignedVisitDetailsDocument,
  makeVisitDetailsPdfDocumentReference,
} from '../../src/shared/pdf/make-visit-details-document-reference';
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
vi.mock('../../src/shared/patient-coverage-checks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/patient-coverage-checks')>()),
  findLatestCoverageCheck: vi.fn(),
}));
vi.mock('../../src/shared/pdf/visit-details-pdf', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/pdf/visit-details-pdf')>()),
  createVisitDetailsPdf: vi.fn(),
}));
vi.mock('../../src/shared/pdf/make-visit-details-document-reference', () => ({
  findSignedVisitDetailsDocument: vi.fn(),
  makeVisitDetailsPdfDocumentReference: vi.fn(),
}));
vi.mock('../../src/shared/pdf/visit-details-pdf/get-video-resources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/pdf/visit-details-pdf/get-video-resources')>()),
  getAppointmentAndRelatedResources: vi.fn(),
}));

const PATIENT: Patient = { resourceType: 'Patient', id: 'patient-1' };

const payer = (payerId: string): Organization => ({
  resourceType: 'Organization',
  id: `org-${payerId}`,
  name: `Payer ${payerId}`,
  identifier: [{ system: OYSTEHR_RCM_PAYER_ID_SYSTEM, value: payerId }],
});
const INSURANCE_ORGS = [payer('60054'), payer('62308')];

const coverage = (id: string, payerId: string, memberId?: string): Coverage => {
  const payorRef = `https://rcm-api.zapehr.com/v1/payer/${payerId}`;
  return {
    resourceType: 'Coverage',
    id,
    status: 'active',
    beneficiary: { reference: 'Patient/patient-1' },
    subscriberId: memberId,
    payor: [{ reference: payorRef }],
    identifier: memberId
      ? [{ type: { coding: [{ code: 'MB' }] }, value: memberId, assigner: { reference: payorRef } }]
      : [],
    class: [{ type: { coding: [{ code: 'plan' }] }, value: payerId }],
  };
};
const PRIMARY = coverage('cov-primary', '60054', 'A-123');
const SECONDARY = coverage('cov-secondary', '62308', 'C-456');
const CHECK = { subscriberId: 'A-123', payerId: '60054' } as CoverageCheckWithDetails;
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
  vi.mocked(findSignedVisitDetailsDocument).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

const generate = async (
  coverages: OrderedCoveragesWithSubscribers
): Promise<CoverageCheckWithDetails[] | undefined> => {
  vi.mocked(getAccountAndCoverageResourcesForPatient).mockResolvedValue({
    patient: PATIENT,
    coverages,
    insuranceOrgs: INSURANCE_ORGS,
  });
  await performEffect(oystehr, 'appt-1', null, 'token');
  expect(makeVisitDetailsPdfDocumentReference).toHaveBeenCalledOnce();
  return vi.mocked(createVisitDetailsPdf).mock.calls[0][0].coverageChecks;
};

describe('visit-details-to-pdf eligibility loading', () => {
  it('does not search for eligibility checks for a visit without insurance', async () => {
    expect(await generate({})).toEqual([]);
    expect(findLatestCoverageCheck).not.toHaveBeenCalled();
  });

  it('does not search when the printed insurance shows no member ID', async () => {
    expect(await generate({ primary: coverage('cov-no-member', '60054') })).toEqual([]);
    expect(findLatestCoverageCheck).not.toHaveBeenCalled();
  });

  it.each([
    ['primary', { primary: PRIMARY }, { payerId: '60054', memberId: 'A-123' }],
    ['secondary', { secondary: SECONDARY }, { payerId: '62308', memberId: 'C-456' }],
    [
      'primary, with a secondary also printed,',
      { primary: PRIMARY, secondary: SECONDARY },
      { payerId: '60054', memberId: 'A-123' },
    ],
  ])(
    'searches once, within a 5 second budget, for the payer and member ID of the %s insurance',
    async (_, coverages, pair) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(1_000_000);
      vi.mocked(findLatestCoverageCheck).mockResolvedValue(CHECK);
      expect(await generate(coverages)).toEqual([CHECK]);
      expect(findLatestCoverageCheck).toHaveBeenCalledOnce();
      expect(findLatestCoverageCheck).toHaveBeenCalledWith('patient-1', pair, oystehr, 1_005_000);
    }
  );

  it('passes no check when the search finds none for the printed pair', async () => {
    vi.mocked(findLatestCoverageCheck).mockResolvedValue(undefined);
    expect(await generate({ primary: PRIMARY })).toEqual([]);
  });

  it('saves the PDF exactly as createVisitDetailsPdf returned it, linked to the encounter, as an unmarked copy', async () => {
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
      undefined,
      false
    );
    expect(vi.mocked(makeVisitDetailsPdfDocumentReference).mock.calls[0][1]).toBe(pdfInfo);
    expect(pdfInfo).toEqual({ uploadURL: 'https://z3/visit.pdf', title: 'Visit Details: 11-20-2026' });
  });

  it('still creates the PDF and reports the error when the search could not be completed', async () => {
    const error = new Error('Could not establish the latest eligibility check: no readable response matched');
    vi.mocked(findLatestCoverageCheck).mockRejectedValue(error);
    expect(await generate({ primary: PRIMARY })).toBeUndefined();
    expect(captureException).toHaveBeenCalledWith(error);
  });
});

describe('visit-details-to-pdf signing-time copy', () => {
  const SIGNED_COPY = {
    resourceType: 'DocumentReference',
    id: 'signing-copy',
    status: 'current',
    docStatus: 'final',
    content: [],
  } as DocumentReference;

  beforeEach(() => {
    vi.mocked(getAccountAndCoverageResourcesForPatient).mockResolvedValue({
      patient: PATIENT,
      coverages: { primary: PRIMARY },
      insuranceOrgs: INSURANCE_ORGS,
    });
    vi.mocked(findLatestCoverageCheck).mockResolvedValue(CHECK);
  });

  it('returns the signing-time copy on a later download without regenerating, searching or saving', async () => {
    vi.mocked(findSignedVisitDetailsDocument).mockResolvedValue(SIGNED_COPY);
    expect(await performEffect(oystehr, 'appt-1', null, 'token')).toEqual({
      documentReference: 'DocumentReference/signing-copy',
    });
    expect(findSignedVisitDetailsDocument).toHaveBeenCalledWith(oystehr, 'enc-1');
    expect(getAccountAndCoverageResourcesForPatient).not.toHaveBeenCalled();
    expect(findLatestCoverageCheck).not.toHaveBeenCalled();
    expect(createVisitDetailsPdf).not.toHaveBeenCalled();
    expect(makeVisitDetailsPdfDocumentReference).not.toHaveBeenCalled();
  });

  it('returns a signing-time copy saved while the download was generated, instead of superseding it', async () => {
    vi.mocked(findSignedVisitDetailsDocument).mockResolvedValueOnce(undefined).mockResolvedValueOnce(SIGNED_COPY);
    expect(await performEffect(oystehr, 'appt-1', null, 'token')).toEqual({
      documentReference: 'DocumentReference/signing-copy',
    });
    expect(createVisitDetailsPdf).toHaveBeenCalledOnce();
    expect(findSignedVisitDetailsDocument).toHaveBeenCalledTimes(2);
    expect(makeVisitDetailsPdfDocumentReference).not.toHaveBeenCalled();
  });

  it('saves a final copy when signing, without looking for an earlier signing-time copy', async () => {
    vi.mocked(findSignedVisitDetailsDocument).mockResolvedValue(SIGNED_COPY);
    expect(await performEffect(oystehr, 'appt-1', null, 'token', undefined, { signing: true })).toEqual({
      documentReference: 'DocumentReference/doc-1',
    });
    expect(findSignedVisitDetailsDocument).not.toHaveBeenCalled();
    expect(vi.mocked(createVisitDetailsPdf).mock.calls[0][0].coverageChecks).toEqual([CHECK]);
    expect(vi.mocked(makeVisitDetailsPdfDocumentReference).mock.calls[0][7]).toBe(true);
  });
});
