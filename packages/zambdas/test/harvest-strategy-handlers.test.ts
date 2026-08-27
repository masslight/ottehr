import Oystehr from '@oystehr/sdk';
import { Appointment, DocumentReference, Encounter, List, Patient, RelatedPerson } from 'fhir/r4b';
import { getRelatedPersonsForPatient } from 'utils/lib/auth/user-auth.helper';
import { getEncounterPaymentVariantExtension, PaymentVariant } from 'utils/lib/fhir/encounter';
import {
  INSURANCE_PAY_OPTION,
  OCC_MED_EMPLOYER_PAY_OPTION,
  OCC_MED_SELF_PAY_OPTION,
  SELF_PAY_OPTION,
} from 'utils/lib/ottehr-config/value-sets';
import { Secrets } from 'utils/lib/secrets';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createConsentResources,
  createDocumentResources,
  createMasterRecordPatchOperations,
  createUpdatePharmacyPatchOps,
  getAccountAndCoverageResourcesForPatient,
  makeEncounterAccountPatchOp,
  updatePatientAccountFromQuestionnaire,
} from '../src/ehr/shared/harvest';
import { getAuth0Token } from '../src/shared/getAuth0Token';
import { HarvestContext, strategyHandlers } from '../src/subscriptions/task/sub-harvest-paperwork/page-handlers';

/**
 * Behavior tests for the harvest strategy HANDLERS — the glue between a per-page harvest
 * Task and the heavy harvest functions. The existing dispatch suite mocks the entire
 * harvest module and only proves routing; this one runs each handler body for real and
 * pins what it owns: page scoping, option derivation (preserveOmittedCoverages, payment
 * variants), encounter patch branch selection, dedup plumbing for documents, the token and
 * list plumbing for consent, and the skip ladder for erx-contact. The heavy harvest
 * functions themselves are mocked at the module seam — each has its own dedicated suite.
 */

vi.mock('../src/ehr/shared/harvest', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/ehr/shared/harvest')>();
  return {
    ...original,
    createConsentResources: vi.fn(),
    createDocumentResources: vi.fn(),
    createMasterRecordPatchOperations: vi.fn(),
    createUpdatePharmacyPatchOps: vi.fn(),
    updatePatientAccountFromQuestionnaire: vi.fn(),
    getAccountAndCoverageResourcesForPatient: vi.fn(),
    makeEncounterAccountPatchOp: vi.fn(),
    // createErxContactOperation stays real: the erx handler's happy path is its consumer.
  };
});

vi.mock('../src/shared/getAuth0Token', () => ({ getAuth0Token: vi.fn() }));

vi.mock('utils/lib/auth/user-auth.helper', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/auth/user-auth.helper')>();
  return { ...original, getRelatedPersonsForPatient: vi.fn() };
});

vi.mock('../src/shared/invariants', () => ({ reportMissingUserRelatedPerson: vi.fn() }));

const mockCreateConsentResources = vi.mocked(createConsentResources);
const mockCreateDocumentResources = vi.mocked(createDocumentResources);
const mockCreateMasterRecordPatchOps = vi.mocked(createMasterRecordPatchOperations);
const mockCreatePharmacyPatchOps = vi.mocked(createUpdatePharmacyPatchOps);
const mockUpdatePatientAccount = vi.mocked(updatePatientAccountFromQuestionnaire);
const mockGetAccountResources = vi.mocked(getAccountAndCoverageResourcesForPatient);
const mockMakeEncounterAccountPatchOp = vi.mocked(makeEncounterAccountPatchOp);
const mockGetAuth0Token = vi.mocked(getAuth0Token);
const mockGetRelatedPersons = vi.mocked(getRelatedPersonsForPatient);

interface OystehrMock {
  fhir: {
    patch: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
  };
}

const makeOystehr = (): OystehrMock => ({
  fhir: {
    patch: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue({ unbundle: () => [] }),
  },
});

const PATIENT: Patient & { id: string } = { resourceType: 'Patient', id: 'pat-1' };
const ENCOUNTER = { resourceType: 'Encounter', id: 'enc-1', status: 'in-progress' } as Encounter & { id: string };
const APPOINTMENT = { resourceType: 'Appointment', id: 'appt-1', status: 'booked' } as Appointment & { id: string };

const makeContext = (overrides: Partial<HarvestContext> & { oystehr?: OystehrMock } = {}): HarvestContext => ({
  qr: { resourceType: 'QuestionnaireResponse', status: 'in-progress', item: [] },
  pageLinkId: 'contact-information-page',
  patchIndex: 0,
  taskId: 'task-1',
  patient: PATIENT,
  encounter: ENCOUNTER,
  appointment: APPOINTMENT,
  location: undefined,
  questionnaire: undefined,
  secrets: {} as Secrets,
  ...overrides,
  oystehr: (overrides.oystehr ?? makeOystehr()) as unknown as Oystehr,
});

const paymentAnswer = (page: string, question: string, value?: string): HarvestContext['qr'] => ({
  resourceType: 'QuestionnaireResponse',
  status: 'in-progress',
  item: [{ linkId: page, item: [{ linkId: question, ...(value ? { answer: [{ valueString: value }] } : {}) }] }],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('payment-variant strategy', () => {
  const handler = strategyHandlers['payment-variant'];

  test('skips pages it does not understand and pages without a selection', async () => {
    const oystehr = makeOystehr();
    await expect(handler(makeContext({ pageLinkId: 'contact-information-page', oystehr }))).resolves.toMatch(
      /skipped \(unsupported page/
    );
    await expect(
      handler(
        makeContext({
          pageLinkId: 'payment-option-page',
          qr: paymentAnswer('payment-option-page', 'payment-option', undefined),
          oystehr,
        })
      )
    ).resolves.toBe('payment-variant skipped (no payment option selected)');
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  test.each([
    ['insurance option', 'payment-option-page', 'payment-option', INSURANCE_PAY_OPTION, PaymentVariant.insurance],
    ['self-pay option', 'payment-option-page', 'payment-option', SELF_PAY_OPTION, PaymentVariant.selfPay],
    [
      'occ-med employer option',
      'payment-option-occ-med-page',
      'payment-option-occupational',
      OCC_MED_EMPLOYER_PAY_OPTION,
      PaymentVariant.employer,
    ],
    [
      'occ-med self option',
      'payment-option-occ-med-page',
      'payment-option-occupational',
      OCC_MED_SELF_PAY_OPTION,
      PaymentVariant.selfPay,
    ],
  ])('maps the %s to its payment variant', async (_label, page, question, option, expectedVariant) => {
    const oystehr = makeOystehr();
    const result = await handler(makeContext({ pageLinkId: page, qr: paymentAnswer(page, question, option), oystehr }));
    expect(result).toBe(`payment-variant set to ${expectedVariant}`);
    const ops = oystehr.fhir.patch.mock.calls[0][0].operations;
    expect(ops).toEqual([
      { op: 'add', path: '/extension', value: [getEncounterPaymentVariantExtension(expectedVariant)] },
    ]);
  });

  test('does not patch when the encounter already carries the selected variant', async () => {
    const oystehr = makeOystehr();
    const encounter = {
      ...ENCOUNTER,
      extension: [getEncounterPaymentVariantExtension(PaymentVariant.insurance)],
    } as typeof ENCOUNTER;
    await handler(
      makeContext({
        pageLinkId: 'payment-option-page',
        qr: paymentAnswer('payment-option-page', 'payment-option', INSURANCE_PAY_OPTION),
        encounter,
        oystehr,
      })
    );
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  test('replaces the existing variant extension in place', async () => {
    const oystehr = makeOystehr();
    const encounter = {
      ...ENCOUNTER,
      extension: [
        { url: 'https://example.com/unrelated', valueString: 'x' },
        getEncounterPaymentVariantExtension(PaymentVariant.insurance),
      ],
    } as typeof ENCOUNTER;
    await handler(
      makeContext({
        pageLinkId: 'payment-option-page',
        qr: paymentAnswer('payment-option-page', 'payment-option', SELF_PAY_OPTION),
        encounter,
        oystehr,
      })
    );
    expect(oystehr.fhir.patch.mock.calls[0][0].operations).toEqual([
      { op: 'replace', path: '/extension/1', value: getEncounterPaymentVariantExtension(PaymentVariant.selfPay) },
    ]);
  });

  test('appends to an extension array that lacks the variant extension', async () => {
    const oystehr = makeOystehr();
    const encounter = {
      ...ENCOUNTER,
      extension: [{ url: 'https://example.com/unrelated', valueString: 'x' }],
    } as typeof ENCOUNTER;
    await handler(
      makeContext({
        pageLinkId: 'payment-option-page',
        qr: paymentAnswer('payment-option-page', 'payment-option', SELF_PAY_OPTION),
        encounter,
        oystehr,
      })
    );
    expect(oystehr.fhir.patch.mock.calls[0][0].operations).toEqual([
      { op: 'add', path: '/extension/-', value: getEncounterPaymentVariantExtension(PaymentVariant.selfPay) },
    ]);
  });
});

describe('master-record strategy', () => {
  test('scopes the patch to the harvested page with enableWhen filtering', async () => {
    const oystehr = makeOystehr();
    const sentinelOps = [{ op: 'add' as const, path: '/name', value: [{ family: 'Doe' }] }];
    mockCreateMasterRecordPatchOps.mockReturnValue({
      patient: { patchOpsForDirectUpdate: sentinelOps },
    } as never);

    const qrItems = [{ linkId: 'contact-information-page', item: [] }];
    const questionnaire = { resourceType: 'Questionnaire', status: 'active' } as HarvestContext['questionnaire'];
    const result = await strategyHandlers['master-record'](
      makeContext({
        qr: { resourceType: 'QuestionnaireResponse', status: 'in-progress', item: qrItems },
        questionnaire,
        oystehr,
      })
    );

    expect(result).toBe('master record updated for contact-information-page');
    expect(mockCreateMasterRecordPatchOps).toHaveBeenCalledWith(
      {
        questionnaireResponseItems: qrItems,
        sourceQuestionnaire: questionnaire,
        options: { filterByEnableWhen: true, includeSections: ['contact-information-page'] },
      },
      PATIENT
    );
    expect(oystehr.fhir.patch.mock.calls[0][0]).toMatchObject({
      resourceType: 'Patient',
      id: 'pat-1',
      operations: sentinelOps,
    });
  });
});

describe('pharmacy strategy', () => {
  test("passes only the harvested page's flattened items to the pharmacy patch builder", async () => {
    const oystehr = makeOystehr();
    const sentinelOps = [{ op: 'add' as const, path: '/contained', value: [] }];
    mockCreatePharmacyPatchOps.mockReturnValue(sentinelOps as never);

    const pharmacyItem = { linkId: 'pharmacy-name', answer: [{ valueString: 'Corner Pharmacy' }] };
    await strategyHandlers['pharmacy'](
      makeContext({
        pageLinkId: 'pharmacy-page',
        qr: {
          resourceType: 'QuestionnaireResponse',
          status: 'in-progress',
          item: [
            { linkId: 'pharmacy-page', item: [pharmacyItem] },
            { linkId: 'other-page', item: [{ linkId: 'unrelated', answer: [{ valueString: 'nope' }] }] },
          ],
        },
        oystehr,
      })
    );

    expect(mockCreatePharmacyPatchOps).toHaveBeenCalledWith(PATIENT, [pharmacyItem]);
    expect(oystehr.fhir.patch.mock.calls[0][0]).toMatchObject({ resourceType: 'Patient', operations: sentinelOps });
  });
});

describe('account-coverage strategy', () => {
  const runWith = async (pageLinkId: string, qr: HarvestContext['qr']): Promise<void> => {
    const oystehr = makeOystehr();
    mockGetAccountResources.mockResolvedValue({ account: undefined, workersCompAccount: undefined } as never);
    mockMakeEncounterAccountPatchOp.mockReturnValue([] as never);
    await strategyHandlers['account-coverage'](makeContext({ pageLinkId, qr, oystehr }));
  };

  test('preserves omitted coverages when harvesting a non-payment page', async () => {
    await runWith('responsible-party-page', {
      resourceType: 'QuestionnaireResponse',
      status: 'in-progress',
      item: [{ linkId: 'responsible-party-page', item: [] }],
    });
    expect(mockUpdatePatientAccount).toHaveBeenCalledWith(
      expect.objectContaining({ preserveOmittedCoverages: true }),
      expect.anything()
    );
  });

  test('preserves omitted coverages for a self-pay payment page', async () => {
    await runWith('payment-option-page', paymentAnswer('payment-option-page', 'payment-option', SELF_PAY_OPTION));
    expect(mockUpdatePatientAccount).toHaveBeenCalledWith(
      expect.objectContaining({ preserveOmittedCoverages: true }),
      expect.anything()
    );
  });

  test('does NOT preserve omitted coverages when insurance was selected on the payment page', async () => {
    await runWith('payment-option-page', paymentAnswer('payment-option-page', 'payment-option', INSURANCE_PAY_OPTION));
    expect(mockUpdatePatientAccount).toHaveBeenCalledWith(
      expect.objectContaining({ preserveOmittedCoverages: false }),
      expect.anything()
    );
  });

  test('scopes the account update to the harvested page only', async () => {
    const pageItems = [{ linkId: 'payment-option-page', item: [] }];
    await runWith('payment-option-page', {
      resourceType: 'QuestionnaireResponse',
      status: 'in-progress',
      item: [...pageItems, { linkId: 'contact-information-page', item: [] }],
    });
    expect(mockUpdatePatientAccount).toHaveBeenCalledWith(
      expect.objectContaining({ questionnaireResponseItem: pageItems, patientId: 'pat-1' }),
      expect.anything()
    );
  });
});

describe('documents strategy', () => {
  test('feeds page-scoped QR, existing docrefs, and lists into createDocumentResources', async () => {
    const docRef: DocumentReference = { resourceType: 'DocumentReference', status: 'current', content: [] };
    const list: List = { resourceType: 'List', status: 'current', mode: 'working' };
    const oystehr = makeOystehr();
    oystehr.fhir.search
      .mockResolvedValueOnce({ unbundle: () => [docRef, list] }) // DocumentReference search (Lists filtered out)
      .mockResolvedValueOnce({ unbundle: () => [list] }); // List search

    const photoPage = { linkId: 'photo-id-page', item: [] };
    await strategyHandlers['documents'](
      makeContext({
        pageLinkId: 'photo-id-page',
        qr: {
          resourceType: 'QuestionnaireResponse',
          status: 'in-progress',
          item: [photoPage, { linkId: 'other-page', item: [] }],
        },
        oystehr,
      })
    );

    expect(mockCreateDocumentResources).toHaveBeenCalledTimes(1);
    const [pageQr, patientId, appointmentId, , lists, docRefs] = mockCreateDocumentResources.mock.calls[0];
    expect(pageQr.item).toEqual([photoPage]);
    expect(patientId).toBe('pat-1');
    expect(appointmentId).toBe('appt-1');
    expect(lists).toEqual([list]);
    expect(docRefs).toEqual([docRef]);
  });
});

describe('consent strategy', () => {
  test('passes the page-scoped QR, access token, and lists into createConsentResources', async () => {
    const list: List = { resourceType: 'List', status: 'current', mode: 'working' };
    const oystehr = makeOystehr();
    oystehr.fhir.search.mockResolvedValue({ unbundle: () => [list] });
    mockGetAuth0Token.mockResolvedValue('m2m-token');

    const consentPage = { linkId: 'consent-forms-page', item: [] };
    const location = { resourceType: 'Location' } as HarvestContext['location'];
    await strategyHandlers['consent'](
      makeContext({
        pageLinkId: 'consent-forms-page',
        qr: {
          resourceType: 'QuestionnaireResponse',
          status: 'in-progress',
          item: [{ linkId: 'contact-information-page', item: [] }, consentPage],
        },
        location,
        oystehr,
      })
    );

    expect(mockCreateConsentResources).toHaveBeenCalledWith(
      expect.objectContaining({
        questionnaireResponse: expect.objectContaining({ item: [consentPage] }),
        patientResource: PATIENT,
        locationResource: location,
        appointment: APPOINTMENT,
        oystehrAccessToken: 'm2m-token',
        listResources: [list],
      })
    );
  });
});

describe('erx-contact strategy', () => {
  const handler = strategyHandlers['erx-contact'];
  const relatedPersonWithPhone: RelatedPerson = {
    resourceType: 'RelatedPerson',
    id: 'rp-1',
    patient: { reference: 'Patient/pat-1' },
    telecom: [{ system: 'phone', value: '+15551234567' }],
  };

  test('skips and reports when the patient has no user-relatedperson', async () => {
    const oystehr = makeOystehr();
    mockGetRelatedPersons.mockResolvedValue([]);
    await expect(handler(makeContext({ oystehr }))).resolves.toBe('erx-contact skipped (no user-relatedperson)');
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });

  test('skips when multiple user-relatedpersons make the login phone ambiguous', async () => {
    mockGetRelatedPersons.mockResolvedValue([relatedPersonWithPhone, { ...relatedPersonWithPhone, id: 'rp-2' }]);
    await expect(handler(makeContext())).resolves.toBe('erx-contact skipped (ambiguous login phone)');
  });

  test('skips when the related person has no verified phone', async () => {
    mockGetRelatedPersons.mockResolvedValue([{ ...relatedPersonWithPhone, telecom: [] }]);
    await expect(handler(makeContext())).resolves.toBe('erx-contact skipped (no verified phone)');
  });

  test('patches the patient erx contact from the verified login phone', async () => {
    const oystehr = makeOystehr();
    mockGetRelatedPersons.mockResolvedValue([relatedPersonWithPhone]);
    await expect(handler(makeContext({ oystehr }))).resolves.toBe('erx-contact updated');
    const patchCall = oystehr.fhir.patch.mock.calls[0][0];
    expect(patchCall.resourceType).toBe('Patient');
    expect(patchCall.operations).toHaveLength(1);
    expect(JSON.stringify(patchCall.operations)).toContain('4567');
  });
});
