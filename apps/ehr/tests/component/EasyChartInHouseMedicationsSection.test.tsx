import { render, screen } from '@testing-library/react';
import { NOTE_TYPE, NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ExtendedMedicationDataForResponse } from 'utils/lib/types/api/medication-administration.types';
import { describe, expect, it } from 'vitest';
import { InHouseMedicationsSection } from '../../src/features/easy-charting/InHouseMedicationsSection';

// The easy-chart note's In-House Medications block mirrors Review & Sign's
// InHouseMedicationsContainer: one createMedicationString line per MAR order, plus the provider's
// in-house medication notes underneath.
describe('InHouseMedicationsSection', () => {
  // Only the fields createMedicationString reads are populated — the DTO is much wider.
  const ibuprofen = {
    id: 'mar-1',
    medicationName: 'Ibuprofen',
    dose: 400,
    units: 'mg',
    route: '26643006', // oral
    status: 'administered',
  } as unknown as ExtendedMedicationDataForResponse;

  const note: NoteDTO = {
    type: NOTE_TYPE.MEDICATION,
    resourceId: 'note-1',
    patientId: 'p-1',
    encounterId: 'e-1',
    text: 'Tolerated well.',
    authorId: 'u-1',
    authorName: 'Dr. Quinn',
  };

  it('renders the medication string and section title', () => {
    render(<InHouseMedicationsSection medications={[ibuprofen]} notes={[]} />);
    expect(screen.getByText('In-House Medications')).toBeDefined();
    // createMedicationString joins name, dose+units, route display, and status.
    expect(screen.getByText(/Ibuprofen, 400 mg, Oral/)).toBeDefined();
    expect(screen.getByText(/Administered/)).toBeDefined();
  });

  it('renders in-house medication notes under the med lines', () => {
    render(<InHouseMedicationsSection medications={[ibuprofen]} notes={[note]} />);
    expect(screen.getByText('Note: Tolerated well.')).toBeDefined();
  });

  it('renders notes even with no medications (notes alone keep the section visible)', () => {
    render(<InHouseMedicationsSection medications={[]} notes={[note]} />);
    expect(screen.getByText('In-House Medications')).toBeDefined();
    expect(screen.getByText('Note: Tolerated well.')).toBeDefined();
  });
});
