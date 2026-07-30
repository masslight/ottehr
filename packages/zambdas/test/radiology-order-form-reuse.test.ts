import { DocumentReference, Observation } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  isPrintableObservation,
  OrderFormSource,
  radiologyOrderFormSourceVersion,
  storedOrderFormSourceVersion,
} from '../src/ehr/radiology/shared/order-form-resources';
import { RADIOLOGY_ORDER_FORM_SOURCE_VERSION_SYSTEM } from '../src/shared/pdf/radiology-order-form-pdf';

const resource = (resourceType: string, id: string | undefined, versionId: string | undefined): OrderFormSource => ({
  resourceType,
  id,
  meta: versionId ? { versionId } : undefined,
});

const serviceRequest = (versionId: string): OrderFormSource => resource('ServiceRequest', 'sr-1', versionId);
const patient = (versionId: string): OrderFormSource => resource('Patient', 'pat-1', versionId);
const weight = (versionId: string): OrderFormSource => resource('Observation', 'obs-1', versionId);

describe('radiologyOrderFormSourceVersion', () => {
  it('is stable regardless of the order the sources were gathered in', () => {
    expect(radiologyOrderFormSourceVersion([serviceRequest('1'), patient('4')])).toBe(
      radiologyOrderFormSourceVersion([patient('4'), serviceRequest('1')])
    );
  });

  it('changes when the order changes', () => {
    expect(radiologyOrderFormSourceVersion([serviceRequest('1'), patient('4')])).not.toBe(
      radiologyOrderFormSourceVersion([serviceRequest('2'), patient('4')])
    );
  });

  it('changes when the patient demographics change', () => {
    expect(radiologyOrderFormSourceVersion([serviceRequest('1'), patient('4')])).not.toBe(
      radiologyOrderFormSourceVersion([serviceRequest('1'), patient('5')])
    );
  });

  it('changes when a recorded weight changes', () => {
    expect(radiologyOrderFormSourceVersion([serviceRequest('1'), weight('1')])).not.toBe(
      radiologyOrderFormSourceVersion([serviceRequest('1'), weight('2')])
    );
  });

  it('changes when a weight is recorded where there was none', () => {
    expect(radiologyOrderFormSourceVersion([serviceRequest('1')])).not.toBe(
      radiologyOrderFormSourceVersion([serviceRequest('1'), weight('1')])
    );
  });

  it('is undefined when a source carries no version', () => {
    expect(radiologyOrderFormSourceVersion([serviceRequest('1'), resource('Patient', 'pat-1', undefined)])).toBe(
      undefined
    );
  });

  it('is undefined when a source carries no id', () => {
    expect(radiologyOrderFormSourceVersion([serviceRequest('1'), resource('Patient', undefined, '4')])).toBe(undefined);
  });
});

describe('isPrintableObservation', () => {
  const withStatus = (status: Observation['status']): Observation => ({
    resourceType: 'Observation',
    status,
    code: {},
  });

  it.each(['registered', 'preliminary', 'final', 'amended', 'corrected'] as Observation['status'][])(
    'prints a %s observation',
    (status) => {
      expect(isPrintableObservation(withStatus(status))).toBe(true);
    }
  );

  it.each(['entered-in-error', 'cancelled', 'unknown'] as Observation['status'][])(
    'does not print a %s observation',
    (status) => {
      expect(isPrintableObservation(withStatus(status))).toBe(false);
    }
  );
});

describe('storedOrderFormSourceVersion', () => {
  it('reads the version stamped on a stored order form, ignoring other identifiers', () => {
    const docRef = {
      resourceType: 'DocumentReference',
      identifier: [
        { system: 'http://example.com/other', value: 'ignore-me' },
        { system: RADIOLOGY_ORDER_FORM_SOURCE_VERSION_SYSTEM, value: 'ServiceRequest/sr-1@1' },
      ],
    } as DocumentReference;
    expect(storedOrderFormSourceVersion(docRef)).toBe('ServiceRequest/sr-1@1');
  });

  it('is undefined for a form stamped before versioning existed', () => {
    expect(storedOrderFormSourceVersion({ resourceType: 'DocumentReference' } as DocumentReference)).toBe(undefined);
  });
});
