import { render, screen } from '@testing-library/react';
import { DispositionDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, it } from 'vitest';
import { DispositionSection } from '../../src/features/easy-charting/DispositionSection';

// The easy-chart note's disposition block mirrors Review & Sign's PatientInstructionsContainer:
// type label in the header, note body, follow-up-in timing, subspecialty follow-ups, and the
// lab-service / virus-test fields.
describe('DispositionSection', () => {
  it('renders the header with the mapped disposition type label and the note', () => {
    const disposition: DispositionDTO = { type: 'pcp', note: 'Follow up with your PCP.' };
    render(<DispositionSection disposition={disposition} />);
    expect(screen.getByText('Disposition — Primary Care Physician')).toBeDefined();
    expect(screen.getByText('Follow up with your PCP.')).toBeDefined();
  });

  it('renders follow-up timing like Review & Sign ("in 2 days"; value 0 → "as needed")', () => {
    const { unmount } = render(<DispositionSection disposition={{ type: 'pcp', note: '', followUpIn: 2 }} />);
    expect(screen.getByText('Follow-up visit in 2 days')).toBeDefined();
    unmount();
    render(<DispositionSection disposition={{ type: 'pcp', note: '', followUpIn: 0 }} />);
    expect(screen.getByText('Follow-up visit as needed')).toBeDefined();
  });

  it('renders subspecialty follow-ups with the option label, appending the note for "other"', () => {
    const disposition: DispositionDTO = {
      type: 'ip',
      note: '',
      followUp: [{ type: 'ent' }, { type: 'other', note: 'See cardiology within a week' }],
    };
    render(<DispositionSection disposition={disposition} />);
    expect(screen.getByText('Subspecialty follow-up')).toBeDefined();
    expect(screen.getByText(/• ENT/)).toBeDefined();
    expect(screen.getByText(/• Other: See cardiology within a week/)).toBeDefined();
  });

  it('renders lab services, virus tests, and the specialty transfer display', () => {
    const disposition: DispositionDTO = {
      type: 'specialty',
      note: '',
      specialty: 'Other',
      specialtyOther: 'Sports Medicine',
      labService: ['CBC', 'CMP'],
      virusTest: ['COVID-19'],
    };
    render(<DispositionSection disposition={disposition} />);
    expect(screen.getByText('Disposition — Specialty Transfer')).toBeDefined();
    expect(screen.getByText('Sports Medicine')).toBeDefined();
    expect(screen.getByText('Lab Services: CBC, CMP')).toBeDefined();
    expect(screen.getByText('Virus Tests: COVID-19')).toBeDefined();
  });
});
