import { Patient } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { consolidateOperations } from './resourcePatch';

describe('consolidateOperations', () => {
  describe('scalar fields', () => {
    it('should not wrap scalar value in array when adding gender to patient without gender', () => {
      const patientWithoutGender: Patient = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['Test'], family: 'Patient' }],
      };

      const operations = [{ op: 'add' as const, path: '/gender', value: 'male' }];

      const result = consolidateOperations(operations, patientWithoutGender);

      expect(result).toEqual([{ op: 'add', path: '/gender', value: 'male' }]);
    });

    it('should not wrap scalar value in array when adding birthDate to patient without birthDate', () => {
      const patientWithoutBirthDate: Patient = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['Test'], family: 'Patient' }],
      };

      const operations = [{ op: 'add' as const, path: '/birthDate', value: '1990-01-15' }];

      const result = consolidateOperations(operations, patientWithoutBirthDate);

      expect(result).toEqual([{ op: 'add', path: '/birthDate', value: '1990-01-15' }]);
    });

    it('should handle multiple scalar fields added simultaneously', () => {
      const minimalPatient: Patient = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['Test'], family: 'Patient' }],
      };

      const operations = [
        { op: 'add' as const, path: '/gender', value: 'female' },
        { op: 'add' as const, path: '/birthDate', value: '1985-03-20' },
      ];

      const result = consolidateOperations(operations, minimalPatient);

      expect(result).toContainEqual({ op: 'add', path: '/gender', value: 'female' });
      expect(result).toContainEqual({ op: 'add', path: '/birthDate', value: '1985-03-20' });
    });
  });

  describe('array fields', () => {
    it('should correctly consolidate nested address operations into array', () => {
      const patientWithoutAddress: Patient = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['Test'], family: 'Patient' }],
      };

      const operations = [
        { op: 'add' as const, path: '/address/0/city', value: 'New York' },
        { op: 'add' as const, path: '/address/0/state', value: 'NY' },
      ];

      const result = consolidateOperations(operations, patientWithoutAddress);

      expect(result).toContainEqual({
        op: 'add',
        path: '/address',
        value: [{ city: 'New York', state: 'NY' }],
      });
    });

    it('should wrap single object value in array when adding to array field at root path', () => {
      const patientWithoutIdentifier: Patient = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['Test'], family: 'Patient' }],
      };

      const operations = [
        {
          op: 'add' as const,
          path: '/identifier',
          value: { system: 'http://example.org', value: '12345' },
        },
      ];

      const result = consolidateOperations(operations, patientWithoutIdentifier);

      expect(result).toContainEqual({
        op: 'add',
        path: '/identifier',
        value: [{ system: 'http://example.org', value: '12345' }],
      });
    });
  });

  describe('mixed operations', () => {
    it('should handle scalar and array fields in the same batch', () => {
      const minimalPatient: Patient = {
        resourceType: 'Patient',
        id: 'test-patient',
        name: [{ given: ['Test'], family: 'Patient' }],
      };

      const operations = [
        { op: 'add' as const, path: '/gender', value: 'male' },
        { op: 'add' as const, path: '/address/0/city', value: 'Boston' },
        { op: 'add' as const, path: '/address/0/state', value: 'MA' },
      ];

      const result = consolidateOperations(operations, minimalPatient);

      expect(result).toContainEqual({ op: 'add', path: '/gender', value: 'male' });
      expect(result).toContainEqual({
        op: 'add',
        path: '/address',
        value: [{ city: 'Boston', state: 'MA' }],
      });
    });
  });
});
