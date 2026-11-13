import Oystehr from '@oystehr/sdk';
import { MedicationAdministration, Practitioner, RelatedPerson } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  administerImmunizationOrder,
  validateRequestParameters as validateAdministerRequest,
} from '../../src/ehr/immunization/administer-order';
import {
  CONTAINED_EMERGENCY_CONTACT_ID,
  CONTAINED_MEDICATION_ID,
  IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL,
} from '../../src/ehr/immunization/common';
import { mapMedicationAdministrationToImmunizationOrder } from '../../src/ehr/immunization/get-orders';
import { createMockZambdaInput } from './validate-request-parameters/helpers';

const practitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'pr-1',
  name: [{ given: ['Ann'], family: 'Lee' }],
};

const order = (
  status: MedicationAdministration['status'] = 'in-progress',
  contained: MedicationAdministration['contained'] = []
): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: 'order-1',
  status,
  subject: { reference: 'Patient/p1' },
  context: { reference: 'Encounter/e1' },
  effectiveDateTime: '2026-10-27T10:00:00Z',
  medicationReference: { reference: '#' + CONTAINED_MEDICATION_ID },
  contained: [
    {
      resourceType: 'Medication',
      id: CONTAINED_MEDICATION_ID,
      extension: [{ url: IMMUNIZATION_ORDER_MEDICATION_ID_EXTENSION_URL, valueString: 'med-1' }],
    },
    ...contained,
  ],
});

const paperworkContact = (relationship: string): RelatedPerson => ({
  resourceType: 'RelatedPerson',
  id: 'rp-emergency',
  patient: { reference: 'Patient/p1' },
  relationship: [
    { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'EP', display: relationship }] },
  ],
  name: [{ given: ['Martin'], family: 'Black' }],
  telecom: [{ system: 'phone', value: '+12025550178' }],
});

const loginRelatedPerson: RelatedPerson = {
  resourceType: 'RelatedPerson',
  id: 'rp-login',
  patient: { reference: 'Patient/p1' },
  relationship: [
    { coding: [{ system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship', code: 'user' }] },
  ],
  telecom: [{ system: 'phone', value: '+12025550100' }],
};

const administer = async ({
  medicationAdministration = order(),
  relatedPersons = [],
  type = 'administered',
  medicationId = 'med-1',
  emergencyContact,
  searchError,
}: {
  medicationAdministration?: MedicationAdministration;
  relatedPersons?: RelatedPerson[];
  type?: string;
  medicationId?: string;
  emergencyContact?: { relationship: string; fullName: string; mobile: string };
  searchError?: Error;
}): Promise<{ administration: MedicationAdministration; search: ReturnType<typeof vi.fn> }> => {
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const search = searchError
    ? vi.fn().mockRejectedValue(searchError)
    : vi.fn().mockResolvedValue({ unbundle: () => relatedPersons });
  const get = vi.fn(async ({ resourceType, id }: { resourceType: string; id: string }) => {
    if (resourceType === 'MedicationAdministration') return medicationAdministration;
    if (resourceType === 'Medication') return { resourceType: 'Medication', id };
    return practitioner;
  });
  const oystehr = { fhir: { get, search, transaction } } as unknown as Oystehr;
  const validated = validateAdministerRequest(
    createMockZambdaInput({
      orderId: 'order-1',
      type,
      ...(type === 'administered-not' ? { reason: 'patient-refused' } : {}),
      details: {
        medication: { id: medicationId, name: 'Tdap' },
        dose: '0.5',
        units: 'mL',
        orderedProvider: { id: 'pr-1' },
      },
      administrationDetails: {
        lot: 'L1',
        expDate: '2027-01-31',
        mvx: 'SKB',
        cvx: '115',
        ndc: '58160-0842-11',
        administeredDateTime: '2026-10-28T09:30:00.000+01:00',
        visGivenDate: '2026-10-28',
        emergencyContact,
      },
    })
  );
  await administerImmunizationOrder(oystehr, validated, practitioner);
  return { administration: transaction.mock.calls[0][0].requests[0].resource, search };
};

const recordedContacts = (administration: MedicationAdministration): RelatedPerson[] =>
  (administration.contained ?? []).filter(
    (resource): resource is RelatedPerson => resource.resourceType === 'RelatedPerson'
  );

describe('administerImmunizationOrder - emergency contact', () => {
  it("records the patient's paperwork emergency contact on the administration", async () => {
    const { administration, search } = await administer({
      relatedPersons: [loginRelatedPerson, paperworkContact('Parent')],
    });

    expect(search).toHaveBeenCalledWith({
      resourceType: 'RelatedPerson',
      params: [{ name: 'patient', value: 'Patient/p1' }],
    });
    expect(administration.supportingInformation).toEqual([{ reference: '#' + CONTAINED_EMERGENCY_CONTACT_ID }]);
    expect(
      mapMedicationAdministrationToImmunizationOrder(administration).administrationDetails?.emergencyContact
    ).toEqual({ relationship: 'parent', fullName: 'Martin Black', mobile: '+12025550178' });
  });

  it('keeps a paperwork relationship the vaccine list does not have as text', async () => {
    const { administration } = await administer({ relatedPersons: [paperworkContact('Spouse')] });

    expect(recordedContacts(administration)[0].relationship).toEqual([{ text: 'Spouse' }]);
    expect(
      mapMedicationAdministrationToImmunizationOrder(administration).administrationDetails?.emergencyContact
        ?.relationship
    ).toBe('Spouse');
  });

  it('records no emergency contact when the patient has none', async () => {
    const { administration } = await administer({ relatedPersons: [loginRelatedPerson] });

    expect(recordedContacts(administration)).toEqual([]);
    expect(administration.supportingInformation).toBeUndefined();
  });

  it('records no paperwork contact for a vaccine that was not administered', async () => {
    const { administration, search } = await administer({
      type: 'administered-not',
      relatedPersons: [paperworkContact('Parent')],
    });

    expect(search).not.toHaveBeenCalled();
    expect(recordedContacts(administration)).toEqual([]);
  });

  it('records the paperwork contact when an order marked not administered is administered later', async () => {
    const { administration } = await administer({
      medicationAdministration: order('not-done'),
      relatedPersons: [paperworkContact('Parent')],
    });

    expect(recordedContacts(administration)).toHaveLength(1);
  });

  it('records the paperwork contact when the request sends an empty one', async () => {
    const { administration } = await administer({
      relatedPersons: [paperworkContact('Parent')],
      emergencyContact: { relationship: '', fullName: '', mobile: '' },
    });

    expect(
      mapMedicationAdministrationToImmunizationOrder(administration).administrationDetails?.emergencyContact
    ).toEqual({ relationship: 'parent', fullName: 'Martin Black', mobile: '+12025550178' });
  });

  it('keeps the contact recorded at administration when the order is saved again', async () => {
    const recorded: RelatedPerson = { ...paperworkContact('Parent'), id: CONTAINED_EMERGENCY_CONTACT_ID };

    const { administration, search } = await administer({
      medicationAdministration: order('completed', [recorded]),
      relatedPersons: [paperworkContact('Spouse')],
    });

    expect(search).not.toHaveBeenCalled();
    expect(recordedContacts(administration)).toEqual([recorded]);
  });

  it('keeps the recorded contact when the vaccine of an administered order is changed', async () => {
    const recorded: RelatedPerson = { ...paperworkContact('Parent'), id: CONTAINED_EMERGENCY_CONTACT_ID };

    const { administration } = await administer({
      medicationAdministration: order('completed', [recorded]),
      medicationId: 'med-2',
    });

    expect(recordedContacts(administration)).toEqual([recorded]);
    expect(administration.supportingInformation).toEqual([{ reference: '#' + CONTAINED_EMERGENCY_CONTACT_ID }]);
  });

  it('clears the recorded contact when an administered order is saved as not administered', async () => {
    const recorded: RelatedPerson = { ...paperworkContact('Parent'), id: CONTAINED_EMERGENCY_CONTACT_ID };

    const { administration } = await administer({
      medicationAdministration: order('completed', [recorded]),
      type: 'administered-not',
    });

    expect(recordedContacts(administration)).toEqual([]);
    expect(administration.supportingInformation).toBeUndefined();
  });

  it('administers the order when the emergency contact cannot be read', async () => {
    const { administration } = await administer({ searchError: new Error('FHIR unavailable') });

    expect(administration.status).toBe('completed');
    expect(recordedContacts(administration)).toEqual([]);
  });

  it('replaces the recorded contact with one sent in the request', async () => {
    const recorded: RelatedPerson = { ...paperworkContact('Parent'), id: CONTAINED_EMERGENCY_CONTACT_ID };

    const { administration, search } = await administer({
      medicationAdministration: order('completed', [recorded]),
      emergencyContact: { relationship: 'legal-guardian', fullName: 'John Doe', mobile: '2027139680' },
    });

    expect(search).not.toHaveBeenCalled();
    expect(recordedContacts(administration)).toHaveLength(1);
    expect(
      mapMedicationAdministrationToImmunizationOrder(administration).administrationDetails?.emergencyContact
    ).toEqual({ relationship: 'legal-guardian', fullName: 'John Doe', mobile: '2027139680' });
  });
});
