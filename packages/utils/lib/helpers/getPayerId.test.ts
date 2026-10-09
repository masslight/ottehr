import { Identifier } from 'fhir/r4b';
import { expect, it } from 'vitest';
import { FHIR_IDENTIFIER_SYSTEM, OYSTEHR_RCM_PAYER_ID_SYSTEM } from '../fhir/constants';
import { getPayerId } from './helpers';

it.each<[string, Identifier]>([
  ['RCM', { system: OYSTEHR_RCM_PAYER_ID_SYSTEM }],
  ['PAYERID', { type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: 'PAYERID' }] } }],
  ['XX', { type: { coding: [{ system: FHIR_IDENTIFIER_SYSTEM, code: 'XX' }] } }],
])('getPayerId ignores old %s identifiers', (_name, identifier) => {
  const old: Identifier = { ...identifier, value: 'FORMER', use: 'old' };
  const current: Identifier = { ...identifier, value: 'CURRENT' };

  expect(getPayerId({ resourceType: 'Organization', identifier: [old, current] })).toBe('CURRENT');
  expect(getPayerId({ resourceType: 'Organization', identifier: [old] })).toBeUndefined();
});
