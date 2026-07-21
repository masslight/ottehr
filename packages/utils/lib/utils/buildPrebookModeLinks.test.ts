import { describe, expect, it } from 'vitest';
import { ServiceMode } from '../types';
import { buildPrebookModeLinks } from './scheduleUtils';

describe('buildPrebookModeLinks', () => {
  it('returns a single virtual link for a virtual-only Location', () => {
    const links = buildPrebookModeLinks({ fhirType: 'Location', slug: 'clinic', isVirtual: true, isInPerson: false });
    expect(links).toHaveLength(1);
    expect(links[0].mode).toBe(ServiceMode.virtual);
    expect(links[0].label).toBe('Prebook');
    expect(links[0].relativeUrl).toBe('/prebook/virtual?bookingOn=clinic&scheduleType=location');
  });

  it('returns a single in-person link for an in-person-only Location', () => {
    const links = buildPrebookModeLinks({ fhirType: 'Location', slug: 'clinic', isVirtual: false, isInPerson: true });
    expect(links).toHaveLength(1);
    expect(links[0].mode).toBe(ServiceMode['in-person']);
    expect(links[0].label).toBe('Prebook');
    expect(links[0].relativeUrl).toBe('/prebook/in-person?bookingOn=clinic&scheduleType=location');
  });

  it('returns both links for a dual-mode Location (the bug fix)', () => {
    const links = buildPrebookModeLinks({ fhirType: 'Location', slug: 'clinic', isVirtual: true, isInPerson: true });
    expect(links.map((l) => l.mode)).toEqual([ServiceMode['in-person'], ServiceMode.virtual]);
    // Labels are disambiguated only when more than one mode is offered.
    expect(links.map((l) => l.label)).toEqual(['Prebook (In person)', 'Prebook (Virtual)']);
    expect(links.map((l) => l.relativeUrl)).toEqual([
      '/prebook/in-person?bookingOn=clinic&scheduleType=location',
      '/prebook/virtual?bookingOn=clinic&scheduleType=location',
    ]);
    // Keys are stable and distinct so copy-button state / React keys don't collide.
    expect(links.map((l) => l.key)).toEqual(['prebook-in-person', 'prebook-virtual']);
  });

  it('falls back to in-person when neither mode flag is set (legacy Location back-compat)', () => {
    const links = buildPrebookModeLinks({ fhirType: 'Location', slug: 'clinic' });
    expect(links).toHaveLength(1);
    expect(links[0].mode).toBe(ServiceMode['in-person']);
  });

  it('maps PractitionerRole owners to the provider schedule type', () => {
    const links = buildPrebookModeLinks({ fhirType: 'PractitionerRole', slug: 'dr-jones', isVirtual: true });
    expect(links[0].relativeUrl).toBe('/prebook/virtual?bookingOn=dr-jones&scheduleType=provider');
  });

  it('returns no links when the owner has no slug', () => {
    expect(buildPrebookModeLinks({ fhirType: 'Location', slug: undefined, isVirtual: true })).toEqual([]);
  });
});
