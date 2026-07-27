import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettledPlanCard, SettledPlanStepResult } from '../../src/features/easy-charting/SettledPlanCard';

describe('SettledPlanCard', () => {
  const results: SettledPlanStepResult[] = [
    { status: 'done', label: 'Add diagnosis Sinusitis' },
    { status: 'skipped', label: 'Remove exam finding Soft' },
    { status: 'error', label: 'Apply template Laceration', message: 'Something went wrong.' },
  ];

  it('renders the summary header and one row per step with the right status icon', () => {
    render(<SettledPlanCard summary="Plan complete: 1 applied, 1 skipped, 1 error." results={results} />);

    expect(screen.getByText('Plan complete: 1 applied, 1 skipped, 1 error.')).toBeInTheDocument();
    expect(screen.getByText(/✓ 1\. Add diagnosis Sinusitis/)).toBeInTheDocument();
    expect(screen.getByText(/⏭ 2\. Remove exam finding Soft/)).toBeInTheDocument();
    expect(screen.getByText(/✗ 3\. Apply template Laceration/)).toBeInTheDocument();
  });

  it('renders a step message as a secondary line, and omits it when absent', () => {
    render(<SettledPlanCard summary="Plan complete: 1 applied, 1 skipped, 1 error." results={results} />);

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    // Only the one step with a message gets a secondary line.
    expect(screen.getAllByText(/./, { selector: '.MuiTypography-caption' })).toHaveLength(1);
  });
});
