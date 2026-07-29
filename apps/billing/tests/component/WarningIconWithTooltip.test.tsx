import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WarningIconWithTooltip } from '../../src/components/WarningIconWithTooltip';
import { PROVISIONAL_BALANCE_HINT } from '../../src/constants/claimStatus';

describe('WarningIconWithTooltip', () => {
  it('exposes the hint as its accessible name', () => {
    render(<WarningIconWithTooltip tooltipText={PROVISIONAL_BALANCE_HINT} />);

    const hint = screen.getByRole('img', { name: PROVISIONAL_BALANCE_HINT });
    expect(hint).toBeInTheDocument();
  });

  it('is reachable by keyboard, so the hint is not mouse only', () => {
    render(<WarningIconWithTooltip tooltipText={PROVISIONAL_BALANCE_HINT} />);

    const hint = screen.getByRole('img', { name: PROVISIONAL_BALANCE_HINT });
    hint.focus();
    expect(hint).toHaveFocus();
  });
});
