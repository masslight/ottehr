import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';
import { describe, expect, it } from 'vitest';
import { ImmunizationSection } from '../../src/features/easy-charting/ImmunizationSection';

// The easy-chart note's Immunization block mirrors Review & Sign's ImmunizationContainer:
// "vaccine - dose units / route - location" plus the administered date/time, rendered in the
// browser's LOCAL timezone.
describe('ImmunizationSection', () => {
  const administeredIso = '2026-07-01T14:30:00.000Z';
  const order: ImmunizationOrder = {
    id: 'imm-1',
    status: 'administered',
    encounterId: 'e-1',
    details: {
      medication: { id: 'med-1', name: 'Influenza vaccine' },
      dose: '0.5',
      units: 'mL',
      orderedProvider: { id: 'prov-1', name: 'Dr. Quinn' },
      orderedDateTime: '2026-07-01T14:00:00.000Z',
      route: '78421000', // intramuscular
      location: { name: 'Left deltoid', code: 'LD' },
    },
    administrationDetails: {
      lot: 'A123',
      expDate: '2027-01-01',
      mvx: 'SKB',
      cvx: '140',
      ndc: '58160-883-52',
      administeredProvider: { id: 'prov-1', name: 'Dr. Quinn' },
      administeredDateTime: administeredIso,
    },
  };

  it('renders name, dose, units, route display, and location', () => {
    render(<ImmunizationSection orders={[order]} />);
    expect(screen.getByText('Immunization')).toBeDefined();
    expect(screen.getByText(/Influenza vaccine - 0\.5 mL \/ Intramuscular route - Left deltoid/)).toBeDefined();
  });

  it('renders the administered date/time in the local timezone', () => {
    render(<ImmunizationSection orders={[order]} />);
    // Computed with the same local-zone conversion the component uses, so the test passes in any TZ.
    const expected = DateTime.fromISO(administeredIso).toFormat('MM/dd/yyyy h:mm a');
    expect(screen.getByText(expected)).toBeDefined();
  });

  it('omits the date line when the order has no administration details', () => {
    const pending: ImmunizationOrder = { ...order, id: 'imm-2', administrationDetails: undefined };
    render(<ImmunizationSection orders={[pending]} />);
    expect(screen.getByText(/Influenza vaccine/)).toBeDefined();
    expect(screen.queryByText(/\d{2}\/\d{2}\/\d{4}/)).toBeNull();
  });
});
