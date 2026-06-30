import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { PreSubmissionRule, RuleConditional } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { RuleEditorVariantPicker, useRuleEditorVariant } from '../../src/components/rules/editorVariants';
import { FlowEditor } from '../../src/components/rules/RuleFlow';
import { OutlineEditor } from '../../src/components/rules/RuleOutline';

// The variants render PayerSelect for payerId fields, which searches payers on open/input.
vi.mock('../../src/api/api', () => ({
  searchBillingPayers: () => Promise.resolve({ payers: [] }),
}));
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {} }),
}));

const sampleConditional: PreSubmissionRule['conditional'] = {
  branches: [
    {
      condition: { type: 'field', field: 'payerId', operator: 'eq', value: '123456' },
      outcome: { type: 'actions', actions: [{ type: 'setField', field: 'payerId', value: '999999' }] },
    },
  ],
  otherwise: { type: 'actions', actions: [{ type: 'applyTag', tag: 'Hold' }] },
};

// Wrap the editors so onChange actually updates state (lets us assert edits round-trip).
function Harness({ Editor }: { Editor: typeof OutlineEditor }): ReturnType<typeof Editor> {
  const [value, setValue] = useState<RuleConditional>(sampleConditional);
  return <Editor value={value} onChange={setValue} />;
}

describe('OutlineEditor', () => {
  it('renders the branch as readable, sentence-like text', () => {
    render(<Harness Editor={OutlineEditor} />);
    expect(screen.getByText('IF')).toBeInTheDocument();
    expect(screen.getByText('OTHERWISE')).toBeInTheDocument();
    // The condition reads as a plain-English chip.
    expect(screen.getByText(/Payer ID equals/)).toBeInTheDocument();
    expect(screen.getByText(/Set Payer ID to/)).toBeInTheDocument();
    expect(screen.getByText(/Hold the claim/)).toBeInTheDocument();
  });

  it('opens an edit popover when a condition chip is clicked', () => {
    render(<Harness Editor={OutlineEditor} />);
    fireEvent.click(screen.getByText(/Payer ID equals/));
    // The popover surfaces the field editor — for payerId that's the searchable payer picker.
    expect(screen.getByPlaceholderText(/Search payers/)).toBeInTheDocument();
  });
});

describe('FlowEditor', () => {
  it('renders the yes / no decision flow with a terminal node', () => {
    render(<Harness Editor={FlowEditor} />);
    expect(screen.getByText('IF')).toBeInTheDocument();
    expect(screen.getByText('YES')).toBeInTheDocument();
    expect(screen.getByText('OTHERWISE')).toBeInTheDocument();
    expect(screen.getByText(/Claim continues through the rest of the engine/)).toBeInTheDocument();
  });
});

describe('RuleEditorVariantPicker + useRuleEditorVariant', () => {
  function PickerHarness(): ReturnType<typeof RuleEditorVariantPicker> {
    const [variant, setVariant] = useRuleEditorVariant();
    return (
      <div>
        <RuleEditorVariantPicker value={variant} onChange={setVariant} />
        <span data-testid="selected">{variant}</span>
      </div>
    );
  }

  it('switches the active variant and persists the choice', () => {
    render(<PickerHarness />);
    const group = screen.getByRole('group');
    fireEvent.click(within(group).getByText('Outline'));
    expect(screen.getByTestId('selected')).toHaveTextContent('outline');
    expect(localStorage.getItem('billing.ruleEditorVariant')).toBe('outline');
  });
});
