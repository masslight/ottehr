import { Claim, ClaimResponse, Patient } from 'fhir/r4b';
import { FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { ManualEraClaim, ManualEraHeader } from 'utils/lib/types/data/billing/billing.schemas';
import { describe, expect, it } from 'vitest';
import { countEraClaims, extractClaimResponseAmounts } from '../../../src/billing/claim-amounts';
import {
  buildEraClaimRemit,
  eraContainedMemberId,
  eraPatientAccountNumber,
  resolveEraPayee,
} from '../../../src/billing/era-remits';
import {
  assignItemSequences,
  buildManualClaimResponse,
  buildManualEraProvenance,
  buildManualPaymentReconciliation,
  entryClaimToInput,
  ManualEraContext,
  manualEraEntryFromFhir,
  parsePatientName,
} from '../../../src/billing/manual-era';
import {
  ERA_CHECK_SYSTEM,
  ERA_ITEM_REMARK_CODE_EXTENSION,
  ERA_KEYED_CLAIM_EXTENSION,
  ERA_SOURCE_EXTENSION,
  fhirName,
  getEraCheckNumber,
  getEraSource,
  PROVENANCE_ACTIVITY_TYPE_SYSTEM,
} from '../../../src/billing/shared';

const PAYER_URL = 'https://rcm-api.zapehr.com/v1/payer/payer-uhc';

const header: ManualEraHeader = {
  payerId: 'payer-uhc',
  billingProviderRef: 'Organization/org-1',
  checkNumber: '557801',
  checkAmountCents: 5_100_045,
  paymentMethod: 'ACH',
  remitDate: '2026-09-13',
  checkDate: '2026-09-12',
  depositDate: '2026-09-14',
  notes: 'Mailed remit',
};

const context: ManualEraContext = {
  payer: { reference: PAYER_URL, display: 'United Health Care (87726)' },
  billingProvider: { reference: 'Organization/org-1', name: 'some org', npi: '8675309123', taxId: '121234567' },
};

// The remit from the mockups: billed 150, allowed 100, paid 50, deductible 25, co-pay 25.
const keyedClaim: ManualEraClaim = {
  statusCode: '1',
  patientName: 'Joe Schmoe',
  memberId: '888999000',
  patientAccountNumber: '123',
  payerClaimControlNumber: '789xyzklm',
  serviceDate: '2026-08-15',
  serviceLines: [
    {
      serviceDate: '2026-08-15',
      procedureCode: '99212',
      billedCents: 15_000,
      allowedCents: 10_000,
      paidCents: 5_000,
      adjustments: [
        { groupCode: 'CO', reasonCode: '45', amountCents: 5_000 },
        { groupCode: 'PR', reasonCode: '3', amountCents: 2_500 },
        { groupCode: 'PR', reasonCode: '1', amountCents: 2_500 },
      ],
      remarkCodes: ['N130'],
    },
  ],
};

const containedOf = <T extends { resourceType: string }>(cr: ClaimResponse, resourceType: T['resourceType']): T =>
  cr.contained?.find((resource) => resource.resourceType === resourceType) as unknown as T;

describe('buildManualPaymentReconciliation', () => {
  it('writes the remit the way the ERA readers expect it', () => {
    const pr = buildManualPaymentReconciliation({
      header,
      context,
      created: '2026-09-23T15:00:00.000Z',
      editedAt: '2026-09-23T15:00:00.000Z',
      idempotencyKey: 'key-1',
    });

    expect(getEraSource(pr)).toBe('manual');
    expect(getEraCheckNumber(pr)).toBe('557801');
    expect(pr.identifier).toContainEqual({ system: ERA_CHECK_SYSTEM, value: '557801' });
    expect(pr.paymentIdentifier?.type?.coding?.[0]).toMatchObject({ code: 'ACH', display: 'EFT' });
    expect(pr).toMatchObject({
      status: 'active',
      outcome: 'complete',
      created: '2026-09-23T15:00:00.000Z',
      paymentDate: '2026-09-12',
      paymentAmount: { value: 51000.45, currency: 'USD' },
      paymentIssuer: { reference: PAYER_URL, display: 'United Health Care (87726)' },
      requestor: { reference: 'Organization/org-1', display: 'some org' },
      processNote: [{ type: 'display', text: 'Mailed remit' }],
    });
  });

  it('keeps the first save time and idempotency key on later saves', () => {
    const first = buildManualPaymentReconciliation({
      header,
      context,
      created: '2026-09-23T15:00:00.000Z',
      editedAt: '2026-09-23T15:00:00.000Z',
      idempotencyKey: 'key-1',
    });
    const later = buildManualPaymentReconciliation({
      header: { ...header, paymentMethod: undefined, notes: undefined },
      context,
      created: first.created,
      editedAt: '2026-09-24T09:00:00.000Z',
      existing: { ...first, id: 'era-1' },
    });
    expect(later.id).toBe('era-1');
    expect(later.created).toBe('2026-09-23T15:00:00.000Z');
    expect(later.identifier).toEqual(first.identifier);
    expect(later.paymentIdentifier?.type).toBeUndefined();
    expect(later.processNote).toBeUndefined();
  });
});

describe('buildManualClaimResponse', () => {
  const cr = buildManualClaimResponse({ claim: keyedClaim, header, context });

  it('adds a keyed claim unmatched, with the contained resources unmatch restores from', () => {
    expect(cr.request).toEqual({ reference: '#request' });
    expect(cr.patient).toEqual({ reference: '#patient' });
    // unmatch-claim-response takes the first contained Patient and the contained Claim's insurer
    expect(cr.contained?.map((resource) => `${resource.resourceType}#${resource.id}`)).toEqual([
      'Claim#request',
      'Patient#patient',
      'Organization#billing-provider',
      'Coverage#coverage',
    ]);
    expect(containedOf<Claim>(cr, 'Claim').insurer).toEqual(context.payer);
    // the keyed claim stays referenced from the response whatever it is matched to
    expect(cr.extension).toContainEqual({ url: ERA_KEYED_CLAIM_EXTENSION, valueReference: { reference: '#request' } });
    expect(cr).toMatchObject({ outcome: 'complete', created: '2026-09-13', insurer: context.payer });
  });

  it('reads back through the existing ERA readers', () => {
    expect(extractClaimResponseAmounts(cr)).toEqual({ paid: 50, allowed: 100, patientResp: 50 });
    expect(countEraClaims([cr])).toMatchObject({ total: 1, matched: 0, unmatched: 1 });
    expect(eraContainedMemberId(cr)).toBe('888999000');
    expect(eraPatientAccountNumber([cr], undefined, false)).toBe('123');
    expect(fhirName(containedOf<Patient>(cr, 'Patient'))).toBe('Schmoe, Joe');
    expect(resolveEraPayee([cr])).toEqual({ name: 'some org', npi: '8675309123', taxId: '121234567' });

    // the detail screen passes the contained claim for unmatched rows
    const remit = buildEraClaimRemit(cr, containedOf<Claim>(cr, 'Claim'));
    expect(remit).toMatchObject({ eraStatusCode: '1', payerClaimControlNumber: '789xyzklm', paid: 50 });
    expect(remit.serviceLines).toEqual([
      expect.objectContaining({
        cptCode: '99212',
        serviceDate: '2026-08-15',
        billed: 150,
        allowed: 100,
        paid: 50,
        deductible: 25,
        copay: 25,
        coinsurance: 0,
        remarkCodes: ['N130'],
      }),
    ]);
  });

  it('writes the billing provider NPI where the payee reader looks', () => {
    const org = cr.contained?.find((resource) => resource.resourceType === 'Organization');
    expect(org && 'identifier' in org ? org.identifier : []).toContainEqual({
      system: FHIR_IDENTIFIER_NPI,
      value: '8675309123',
    });
  });

  it('adds a claim associated with an existing Claim matched, paid by the remit payer', () => {
    const matched = buildManualClaimResponse({
      claim: keyedClaim,
      header,
      context,
      matchedClaim: {
        id: 'claim-9',
        patient: { reference: 'Patient/p9' },
        type: { coding: [{ code: 'professional' }] },
      },
    });
    expect(matched.request).toEqual({ reference: 'Claim/claim-9' });
    expect(matched.patient).toEqual({ reference: 'Patient/p9' });
    expect(matched.type).toEqual({ coding: [{ code: 'professional' }] });
    expect(matched.insurer).toEqual(context.payer);
    expect(matched.extension).toContainEqual({
      url: ERA_KEYED_CLAIM_EXTENSION,
      valueReference: { reference: '#request' },
    });
    expect(countEraClaims([matched])).toMatchObject({ matched: 1, unmatched: 0 });
  });

  it('keeps the stored match state when an existing claim is rebuilt', () => {
    const stored: ClaimResponse = {
      ...cr,
      id: 'cr-1',
      request: { reference: 'Claim/claim-2' },
      patient: { reference: 'Patient/p2' },
    };
    const rebuilt = buildManualClaimResponse({ claim: keyedClaim, header, context, existing: stored });
    expect(rebuilt).toMatchObject({
      id: 'cr-1',
      request: { reference: 'Claim/claim-2' },
      patient: { reference: 'Patient/p2' },
    });
  });

  it('stamps one remark-code extension per RARC', () => {
    const remarkExtensions = cr.item?.[0].extension?.filter((ext) => ext.url === ERA_ITEM_REMARK_CODE_EXTENSION);
    expect(remarkExtensions).toEqual([{ url: ERA_ITEM_REMARK_CODE_EXTENSION, valueString: 'N130' }]);
  });
});

describe('manualEraEntryFromFhir', () => {
  it('round-trips what the editor saved', () => {
    const pr = buildManualPaymentReconciliation({ header, context, created: 'now', editedAt: 'now' });
    const cr = { ...buildManualClaimResponse({ claim: keyedClaim, header, context }), id: 'cr-1' };
    const entry = manualEraEntryFromFhir(pr, [cr]);

    expect(entry.header).toEqual(header);
    const { serviceLines, ...claimFields } = keyedClaim;
    expect(entry.claims[0]).toEqual({
      ...claimFields,
      claimResponseId: 'cr-1',
      matchedClaimId: null,
      serviceLines: serviceLines.map((line) => ({ ...line, itemSequence: 1 })),
    });
    expect(entryClaimToInput(entry.claims[0])).toEqual({
      ...keyedClaim,
      claimResponseId: 'cr-1',
      serviceLines: serviceLines.map((line) => ({ ...line, itemSequence: 1 })),
    });
  });

  it('reports the claim a response was matched to', () => {
    const pr = buildManualPaymentReconciliation({ header, context, created: 'now', editedAt: 'now' });
    const cr = {
      ...buildManualClaimResponse({ claim: keyedClaim, header, context }),
      id: 'cr-1',
      request: { reference: 'Claim/c7' },
    };
    expect(manualEraEntryFromFhir(pr, [cr]).claims[0].matchedClaimId).toBe('c7');
  });
});

describe('buildManualEraProvenance', () => {
  it('links the remit and its claims as an era-processing record by the person who keyed it', () => {
    const provenance = buildManualEraProvenance({
      targets: ['PaymentReconciliation/era-1', 'ClaimResponse/cr-1'],
      agent: { reference: 'Practitioner/pr-1', display: 'biller@example.com' },
      recorded: '2026-09-23T15:00:00.000Z',
    });
    expect(provenance).toEqual({
      resourceType: 'Provenance',
      target: [{ reference: 'PaymentReconciliation/era-1' }, { reference: 'ClaimResponse/cr-1' }],
      recorded: '2026-09-23T15:00:00.000Z',
      activity: { coding: [{ system: PROVENANCE_ACTIVITY_TYPE_SYSTEM, code: 'era-processing' }] },
      agent: [{ who: { reference: 'Practitioner/pr-1', display: 'biller@example.com' } }],
    });
  });

  it('keeps the original author and time when the target list is replaced', () => {
    const provenance = buildManualEraProvenance({
      targets: ['PaymentReconciliation/era-1'],
      agent: { reference: 'Practitioner/someone-else' },
      recorded: '2026-09-24T00:00:00.000Z',
      existing: {
        resourceType: 'Provenance',
        target: [],
        recorded: '2026-09-23T15:00:00.000Z',
        agent: [{ who: { reference: 'Practitioner/pr-1', display: 'biller@example.com' } }],
      },
    });
    expect(provenance.recorded).toBe('2026-09-23T15:00:00.000Z');
    expect(provenance.agent).toEqual([{ who: { reference: 'Practitioner/pr-1', display: 'biller@example.com' } }]);
  });
});

describe('helpers', () => {
  it.each([
    ['Joe Schmoe', { text: 'Joe Schmoe', family: 'Schmoe', given: ['Joe'] }],
    ['Schmoe, Joe  Q', { text: 'Schmoe, Joe Q', family: 'Schmoe', given: ['Joe', 'Q'] }],
    ['Mary Ann Van', { text: 'Mary Ann Van', family: 'Van', given: ['Mary', 'Ann'] }],
    ['Cher', { text: 'Cher', family: 'Cher' }],
  ])('parses the patient name %j', (text, expected) => {
    expect(parsePatientName(text)).toEqual(expected);
  });

  it('keeps line sequences it was given and numbers the rest after them', () => {
    const line = keyedClaim.serviceLines[0];
    expect(
      assignItemSequences([{ ...line, itemSequence: 2 }, { ...line }, { ...line, itemSequence: 2 }, { ...line }])
    ).toEqual([2, 1, 3, 4]);
  });

  it('tells manual, imported and clearing-house ERAs apart', () => {
    expect(getEraSource({ extension: [{ url: ERA_SOURCE_EXTENSION, valueCode: 'manual' }] })).toBe('manual');
    expect(getEraSource({ extension: [{ url: ERA_SOURCE_EXTENSION, valueCode: 'x12-import' }] })).toBe('x12-import');
    // Claim.MD stamps the searchable check identifier; process-era imports never do
    expect(getEraSource({ identifier: [{ system: ERA_CHECK_SYSTEM, value: 'CHK1' }] })).toBe('clearing-house');
    expect(getEraSource({})).toBe('x12-import');
  });
});
