import { render, screen } from '@testing-library/react';
import { EncounterExternalLabResult, EncounterInHouseLabResult, NonNormalResult } from 'utils/lib/types/api/lab';
import { describe, expect, it } from 'vitest';
import { hasLabResultsToShow, LabResultsList } from '../../src/features/easy-charting/LabResultsList';

// The easy-chart note's lab-results block must mirror Review & Sign's flag rules exactly —
// especially the deliberate "external with no flags shows NOTHING" rule (normalcy can't be
// assumed for external labs).
describe('LabResultsList', () => {
  const inHouseNormal: EncounterInHouseLabResult = {
    resultsPending: undefined,
    reflexTestsPending: undefined,
    labOrderResults: [
      { name: 'Rapid Strep A', url: 'https://example.com/strep.pdf', nonNormalResultContained: undefined },
    ],
  };

  it('renders an in-house result as a PDF link with a Normal Result flag when it has no flags', () => {
    render(<LabResultsList inHouse={inHouseNormal} />);
    const link = screen.getByRole('link', { name: 'Rapid Strep A' });
    expect(link.getAttribute('href')).toBe('https://example.com/strep.pdf');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText('Normal Result')).toBeDefined();
    expect(screen.getByText('In-house')).toBeDefined();
  });

  it('shows Abnormal / Inconclusive flags from nonNormalResultContained', () => {
    render(
      <LabResultsList
        inHouse={{
          resultsPending: undefined,
          reflexTestsPending: undefined,
          labOrderResults: [
            { name: 'Flu A', url: 'https://example.com/flu.pdf', nonNormalResultContained: [NonNormalResult.Abnormal] },
            {
              name: 'Urinalysis',
              url: 'https://example.com/ua.pdf',
              nonNormalResultContained: [NonNormalResult.Inconclusive],
            },
          ],
        }}
      />
    );
    expect(screen.getByText('Abnormal Result')).toBeDefined();
    expect(screen.getByText('Inconclusive Result')).toBeDefined();
    expect(screen.queryByText('Normal Result')).toBeNull();
  });

  it('shows NO flag for an external result without flags (normalcy cannot be assumed)', () => {
    render(
      <LabResultsList
        external={{
          resultsPending: undefined,
          labOrderResults: [{ name: 'CBC', url: 'https://example.com/cbc.pdf', nonNormalResultContained: undefined }],
        }}
      />
    );
    expect(screen.getByRole('link', { name: 'CBC' })).toBeDefined();
    expect(screen.queryByText('Normal Result')).toBeNull();
    expect(screen.queryByText('Abnormal Result')).toBeNull();
  });

  it('renders external reflex results as indented "+" links under their parent', () => {
    const external: EncounterExternalLabResult = {
      resultsPending: undefined,
      labOrderResults: [
        {
          name: 'Throat Culture',
          url: 'https://example.com/culture.pdf',
          nonNormalResultContained: [NonNormalResult.Abnormal],
          reflexResults: [
            { name: 'Susceptibility Panel', url: 'https://example.com/panel.pdf', nonNormalResultContained: undefined },
          ],
        },
      ],
    };
    render(<LabResultsList external={external} />);
    const reflexLink = screen.getByRole('link', { name: '+ Susceptibility Panel' });
    expect(reflexLink.getAttribute('href')).toBe('https://example.com/panel.pdf');
  });

  it('shows "Lab Results Pending" when the DTO reports pending tests', () => {
    render(
      <LabResultsList
        external={{
          resultsPending: ['CMP'],
          labOrderResults: [],
        }}
      />
    );
    expect(screen.getByText('External')).toBeDefined();
    expect(screen.getByText('Lab Results Pending')).toBeDefined();
  });

  it('hasLabResultsToShow gates on results OR pending, per lab kind', () => {
    expect(hasLabResultsToShow(undefined, undefined)).toBe(false);
    expect(
      hasLabResultsToShow({ resultsPending: undefined, reflexTestsPending: undefined, labOrderResults: [] }, undefined)
    ).toBe(false);
    expect(hasLabResultsToShow(inHouseNormal, undefined)).toBe(true);
    expect(hasLabResultsToShow(undefined, { resultsPending: ['CMP'], labOrderResults: [] })).toBe(true);
  });
});
