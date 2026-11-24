import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

let observations: { field: string; value: string }[] = [];

vi.mock('../../src/features/visits/shared/components/plan-tab/ERxContainer', () => ({
  ERxContainer: () => <div>erx-container</div>,
}));

vi.mock('../../src/features/visits/shared/hooks/useChartData', () => ({
  useChartData: () => ({ chartData: { observations } }),
}));

vi.mock('src/features/visits/in-person/components/AiSuggestion', () => ({
  default: ({ title, content }: { title: string; content: unknown[] }) => (
    <div>
      ai-suggestion {title} {content.length}
    </div>
  ),
}));

import { ERXBody } from '../../src/features/visits/in-person/components/erx/ERXBody';

describe('ERXBody AI eRX suggestion card', () => {
  it('shows the AI eRX suggestions under the eRx container', () => {
    observations = [
      { field: 'ai-erx', value: 'Amoxicillin 400 mg/5 mL' },
      { field: 'ai-allergies', value: 'Penicillin' },
    ];
    render(<ERXBody />);
    expect(screen.getByText('erx-container')).toBeInTheDocument();
    expect(screen.getByText('ai-suggestion eRX 1')).toBeInTheDocument();
  });

  it('shows no card when the AI made no eRX suggestions', () => {
    observations = [];
    render(<ERXBody />);
    expect(screen.queryByText(/ai-suggestion/)).not.toBeInTheDocument();
  });
});
