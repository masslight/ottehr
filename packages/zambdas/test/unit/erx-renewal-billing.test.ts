import Oystehr, { ErxGetMedicationHistoryResponse } from '@oystehr/sdk';
import { MedicationRequest } from 'fhir/r4b';
import { FHIR_EXTENSION, MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM, PrescribedMedicationDTO } from 'utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ERX_HISTORY_TIMEOUT_MS,
  formatErxMedicationHistoryForBillingPrompt,
  formatPrescribedMedicationsForBillingPrompt,
  getErxMedicationHistoryContext,
} from '../../src/ehr/recommend-billing-suggestions';
import { makeMedicationDTO, makePrescribedMedicationDTO } from '../../src/shared/chart-data';
import { makeMedicationStatementFromErxMedicationRequest } from '../../src/subscriptions/medication-request/process-erx-resources';

const renewalExtension = { url: FHIR_EXTENSION.MedicationRequest.isRenewal.url, valueBoolean: true };

const makeMedicationRequest = (overrides: Partial<MedicationRequest> = {}): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  id: 'med-request-1',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/patient-1' },
  encounter: { reference: 'Encounter/encounter-1' },
  requester: { reference: 'Practitioner/practitioner-1' },
  identifier: [{ system: 'https://identifiers.fhir.oystehr.com/erx-prescription-id', value: 'rx-1' }],
  medicationCodeableConcept: {
    coding: [
      {
        system: MEDISPAN_DISPENSABLE_DRUG_ID_CODE_SYSTEM,
        code: '12345',
        display: 'Amoxicillin 500 MG Oral Capsule',
      },
    ],
  },
  dosageInstruction: [{ patientInstruction: 'Take one capsule twice daily.' }],
  dispenseRequest: { quantity: { value: 20, unit: 'capsule' } },
  ...overrides,
});

describe('eRx renewal mapping', () => {
  it('copies MedicationRequest renewal status onto the derived MedicationStatement DTO', () => {
    const medicationRequest = makeMedicationRequest({ extension: [renewalExtension] });

    const medicationStatement = makeMedicationStatementFromErxMedicationRequest(
      medicationRequest,
      'encounter-1',
      'patient-1',
      'practitioner-1'
    );

    expect(
      medicationStatement.extension?.find(
        (extension) => extension.url === FHIR_EXTENSION.MedicationRequest.isRenewal.url
      )?.valueBoolean
    ).toBe(true);
    expect(makeMedicationDTO(medicationStatement).isRenewal).toBe(true);
  });

  it('maps MedicationRequest renewal status onto prescribed medication DTOs', () => {
    const medicationRequest = makeMedicationRequest({ extension: [renewalExtension] });

    expect(makePrescribedMedicationDTO(medicationRequest).isRenewal).toBe(true);
  });
});

describe('billing prescription context formatting', () => {
  it('distinguishes new prescriptions from refills and skips cancelled orders', () => {
    const prompt = formatPrescribedMedicationsForBillingPrompt([
      {
        name: 'Amoxicillin',
        status: 'active',
        instructions: 'Take twice daily.',
        isRenewal: false,
      },
      {
        name: 'Lisinopril',
        status: 'active',
        instructions: 'Take daily.',
        isRenewal: true,
      },
      {
        name: 'Cancelled Medication',
        status: 'cancelled',
        isRenewal: false,
      },
    ] as PrescribedMedicationDTO[]);

    expect(prompt).toContain('Medication: Amoxicillin');
    expect(prompt).toContain('Order type: new prescription');
    expect(prompt).toContain('Medication: Lisinopril');
    expect(prompt).toContain('Order type: refill/renewal');
    expect(prompt).not.toContain('Cancelled Medication');
  });

  it('formats unexpired eRx medication history as complexity context', () => {
    const prompt = formatErxMedicationHistoryForBillingPrompt([
      {
        id: 1,
        medicationId: 1001,
        ndc: null,
        rxcui: null,
        name: 'Metformin',
        route: 'Oral',
        doseForm: 'Tablet',
        strength: '500 MG',
        dispenseUnit: 'Tablet',
        isBrandName: false,
        genericName: 'metformin',
        isOtc: false,
        refills: '3',
        daysSupply: 30,
        quantity: 60,
        classification: 'Antidiabetic',
        schedule: null,
        directions: 'Take twice daily.',
        substitutionsAllowed: true,
        writtenDate: '2026-01-01',
        effectiveDate: '2026-01-01',
        lastFillDate: '2026-02-01',
        expirationDate: '2099-01-01',
      },
      {
        id: 2,
        medicationId: 1002,
        ndc: null,
        rxcui: null,
        name: 'Expired Medication',
        route: null,
        doseForm: null,
        strength: null,
        dispenseUnit: null,
        isBrandName: false,
        genericName: null,
        isOtc: false,
        refills: '0',
        daysSupply: null,
        quantity: 1,
        classification: null,
        schedule: null,
        directions: null,
        substitutionsAllowed: true,
        writtenDate: '2020-01-01',
        effectiveDate: '2020-01-01',
        lastFillDate: null,
        expirationDate: '2020-02-01',
      },
    ]);

    expect(prompt).toContain('Available eRx medication history count: 1');
    expect(prompt).toContain('Medication: Metformin 500 MG Tablet');
    expect(prompt).toContain('Refills allowed: 3');
    expect(prompt).not.toContain('Expired Medication');
  });
});

const metforminHistoryItem: ErxGetMedicationHistoryResponse[number] = {
  id: 1,
  medicationId: 1001,
  ndc: null,
  rxcui: null,
  name: 'Metformin',
  route: 'Oral',
  doseForm: 'Tablet',
  strength: '500 MG',
  dispenseUnit: 'Tablet',
  isBrandName: false,
  genericName: 'metformin',
  isOtc: false,
  refills: '3',
  daysSupply: 30,
  quantity: 60,
  classification: 'Antidiabetic',
  schedule: null,
  directions: 'Take twice daily.',
  substitutionsAllowed: true,
  writtenDate: '2026-01-01',
  effectiveDate: '2026-01-01',
  lastFillDate: '2026-02-01',
  expirationDate: '2099-01-01',
};

const makeOystehrWithMedicationHistory = (
  getMedicationHistory: () => Promise<ErxGetMedicationHistoryResponse>
): Oystehr => ({ erx: { getMedicationHistory } }) as unknown as Oystehr;

describe('eRx medication history fallback for billing suggestions', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('includes the history when the eRx service responds within the budget', async () => {
    const oystehr = makeOystehrWithMedicationHistory(async () => [metforminHistoryItem]);

    await expect(getErxMedicationHistoryContext(oystehr, 'patient-1')).resolves.toContain('Medication: Metformin');
  });

  it('leaves no pending timer once the eRx call resolves', async () => {
    vi.useFakeTimers();
    const oystehr = makeOystehrWithMedicationHistory(async () => [metforminHistoryItem]);

    await getErxMedicationHistoryContext(oystehr, 'patient-1');

    // A leftover timer would keep the lambda's event loop alive after we've returned the response.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives up and builds the prompt without history when the eRx service is slow', async () => {
    vi.useFakeTimers();
    // DoseSpot populates history asynchronously, so this call can hang for tens of seconds on a
    // patient whose history has not been pulled yet. The endpoint must not hang with it.
    const oystehr = makeOystehrWithMedicationHistory(() => new Promise<ErxGetMedicationHistoryResponse>(() => {}));

    const contextPromise = getErxMedicationHistoryContext(oystehr, 'patient-1');
    await vi.advanceTimersByTimeAsync(ERX_HISTORY_TIMEOUT_MS);

    await expect(contextPromise).resolves.toBe('');
  });

  it('handles an eRx failure that arrives after the budget has already elapsed', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let failErxCall: (error: Error) => void = () => {};
    const oystehr = makeOystehrWithMedicationHistory(
      () =>
        new Promise<ErxGetMedicationHistoryResponse>((_resolve, reject) => {
          failErxCall = reject;
        })
    );

    const contextPromise = getErxMedicationHistoryContext(oystehr, 'patient-1');
    await vi.advanceTimersByTimeAsync(ERX_HISTORY_TIMEOUT_MS);
    await expect(contextPromise).resolves.toBe('');

    // The abandoned call keeps running in the lambda container; its rejection must stay handled or
    // it takes down the next invocation. vitest fails the file on a genuine unhandled rejection, and
    // this warn proves the catch attached up front is what consumed it.
    failErxCall(new Error('eRx unavailable'));
    await vi.advanceTimersByTimeAsync(0);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('unable to fetch eRx medication history for patient patient-1'),
      expect.any(Error)
    );
  });

  it('builds the prompt without history when the eRx call fails', async () => {
    const oystehr = makeOystehrWithMedicationHistory(() => Promise.reject(new Error('eRx unavailable')));

    await expect(getErxMedicationHistoryContext(oystehr, 'patient-1')).resolves.toBe('');
  });

  it('builds the prompt without history when the eRx payload cannot be formatted', async () => {
    const oystehr = makeOystehrWithMedicationHistory(
      async () => ({ notAnArray: true }) as unknown as ErxGetMedicationHistoryResponse
    );

    await expect(getErxMedicationHistoryContext(oystehr, 'patient-1')).resolves.toBe('');
  });

  it('skips the eRx call entirely when there is no patient id', async () => {
    const getMedicationHistory = vi.fn(async () => [metforminHistoryItem]);

    await expect(getErxMedicationHistoryContext(makeOystehrWithMedicationHistory(getMedicationHistory))).resolves.toBe(
      ''
    );
    expect(getMedicationHistory).not.toHaveBeenCalled();
  });
});
