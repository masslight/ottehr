import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VitalsUnitInputRow } from '../../src/features/visits/shared/components/vitals/components/VitalsUnitInputRow';

const metricInput = <input data-testid="metric" aria-label="metric" />;
const imperialInput = <input data-testid="imperial" aria-label="imperial" />;

const renderRow = (order: 'metric-imperial' | 'imperial-metric'): void => {
  render(<VitalsUnitInputRow order={order} metricInput={metricInput} imperialInput={imperialInput} />);
};

// Document order (and therefore keyboard tab order, since neither input sets a positive tabIndex).
const inputOrderInDom = (): string[] =>
  Array.from(document.querySelectorAll('input')).map((el) => el.getAttribute('data-testid') ?? '');

describe('VitalsUnitInputRow', () => {
  it('renders metric before imperial when order is metric-imperial', () => {
    renderRow('metric-imperial');
    expect(inputOrderInDom()).toEqual(['metric', 'imperial']);
  });

  it('renders imperial before metric when order is imperial-metric', () => {
    renderRow('imperial-metric');
    expect(inputOrderInDom()).toEqual(['imperial', 'metric']);
  });

  it('keyboard tab order follows the configured order (DOM order, not row-reverse)', () => {
    renderRow('imperial-metric');
    const [first, second] = Array.from(document.querySelectorAll('input'));
    // No positive tabIndex anywhere, so DOM order is the tab order.
    expect(document.querySelector('[tabindex]')).toBeNull();
    expect(first.getAttribute('data-testid')).toBe('imperial');
    expect(second.getAttribute('data-testid')).toBe('metric');
  });

  it('renders the ≈ separator between the two inputs', () => {
    renderRow('metric-imperial');
    expect(screen.getByText('≈')).toBeInTheDocument();
  });
});
