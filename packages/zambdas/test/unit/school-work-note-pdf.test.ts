import { Encounter, Location, Resource } from 'fhir/r4b';
import { PDFDocument } from 'pdf-lib';
import { LOCATION_FORM_EXTENSION_URL, LOCATION_VIRTUAL_CODE } from 'utils/lib/fhir/location';
import { SchoolWorkNoteExcuseDocDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, test } from 'vitest';
import { getEncounterClinicAddress } from '../../src/ehr/save-chart-data/helpers';
import { createSchoolWorkNotePdfBytes } from '../../src/shared/pdf/school-work-note-pdf';

const clinicLocation: Location = {
  resourceType: 'Location',
  id: 'clinic-location',
  name: 'Downtown Branch',
  address: {
    line: ['456 Location Rd', 'Suite 3'],
    city: 'LocCity',
    state: 'LC',
    postalCode: '20002',
  },
};

const virtualLocation: Location = {
  resourceType: 'Location',
  id: 'virtual-location',
  name: 'Virtual LC',
  extension: [
    {
      url: LOCATION_FORM_EXTENSION_URL,
      valueCoding: { code: LOCATION_VIRTUAL_CODE },
    },
  ],
  address: { line: ['123 Virtual Way'], city: 'Virtual City', state: 'LC', postalCode: '20003' },
};

const makeEncounter = (locationId?: string): Encounter => ({
  resourceType: 'Encounter',
  id: 'encounter-1',
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  ...(locationId ? { location: [{ location: { reference: `Location/${locationId}` } }] } : {}),
});

const noteData: SchoolWorkNoteExcuseDocDTO = {
  type: 'school',
  documentHeader: 'School note for Oliver Black',
  parentGuardianName: 'Jane Black',
  headerNote: 'To whom it may concern: Oliver Black was treated on 07/14/2026. They are:',
  bulletItems: [{ text: 'excused from school on 07/14/2026' }],
  footerNote: 'Sincerely,\nDr. John Smith',
  providerDetails: { name: 'Dr. John Smith, MD', credentials: 'MD' },
};

describe('getEncounterClinicAddress', () => {
  test('returns the address of the location the encounter took place at', () => {
    const resources: Resource[] = [makeEncounter('clinic-location'), clinicLocation];

    expect(getEncounterClinicAddress(makeEncounter('clinic-location'), resources)).toBe(
      '456 Location Rd, Suite 3, LocCity, LC 20002'
    );
  });

  test('ignores locations that the encounter does not reference', () => {
    const otherLocation: Location = { ...clinicLocation, id: 'other-location', address: { line: ['1 Other St'] } };
    const resources: Resource[] = [virtualLocation, otherLocation, clinicLocation];

    expect(getEncounterClinicAddress(makeEncounter('clinic-location'), resources)).toBe(
      '456 Location Rd, Suite 3, LocCity, LC 20002'
    );
  });

  test('returns undefined when the encounter has no location', () => {
    expect(getEncounterClinicAddress(makeEncounter(), [clinicLocation])).toBeUndefined();
  });

  test('returns undefined when the referenced location was not included in the search results', () => {
    expect(getEncounterClinicAddress(makeEncounter('clinic-location'), [virtualLocation])).toBeUndefined();
  });

  test('returns undefined for a virtual location even when it has a street address', () => {
    expect(getEncounterClinicAddress(makeEncounter('virtual-location'), [virtualLocation])).toBeUndefined();
  });
});

describe('createSchoolWorkNotePdfBytes', () => {
  test('renders a single page note with the clinic address', async () => {
    const bytes = await createSchoolWorkNotePdfBytes(noteData, '456 Location Rd, LocCity, LC 20002');

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  test('renders a single page note when no clinic address is available', async () => {
    const bytes = await createSchoolWorkNotePdfBytes(noteData);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
