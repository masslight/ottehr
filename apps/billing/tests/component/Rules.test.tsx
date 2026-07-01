import { render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PreSubmissionRule } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConditionalEditor } from '../../src/components/rules/RuleBuilder';
import Rules from '../../src/pages/Rules';

const { getBillingRulesMock, saveBillingRulesMock, stableClients } = vi.hoisted(() => ({
  getBillingRulesMock: vi.fn(),
  saveBillingRulesMock: vi.fn(),
  stableClients: { oystehrZambda: {} },
}));

vi.mock('../../src/api/api', () => ({
  getBillingRules: getBillingRulesMock,
  saveBillingRules: saveBillingRulesMock,
  // PayerSelect (rendered for the payerId condition) searches payers on open/input, not on mount.
  searchBillingPayers: () => Promise.resolve({ payers: [] }),
}));

// The real hook returns a stable client (zustand store, set once); the mock must too, or effects
// keyed on the client identity refetch every render.
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => stableClients,
}));

const ruleA: PreSubmissionRule = {
  id: 'rule-a',
  name: 'Remap legacy payer',
  description: 'If payer 123456 then set payer to 999999',
  enabled: true,
  conditional: {
    branches: [
      {
        condition: { type: 'field', field: 'payerId', operator: 'eq', value: '123456' },
        outcome: { type: 'actions', actions: [{ type: 'setField', field: 'payerId', value: '999999' }] },
      },
    ],
  },
};

function renderRules(): ReactElement {
  return render(
    <MemoryRouter>
      <Rules />
    </MemoryRouter>
  ) as unknown as ReactElement;
}

describe('Rules list', () => {
  beforeEach(() => {
    getBillingRulesMock.mockReset();
    saveBillingRulesMock.mockReset();
  });

  it('renders the loaded rules and the terminal submission card', async () => {
    getBillingRulesMock.mockResolvedValue({ rules: [ruleA], versionId: 'v1' });
    renderRules();

    expect(await screen.findByText('Remap legacy payer')).toBeInTheDocument();
    expect(screen.getByText('When all rules pass, the claim is submitted.')).toBeInTheDocument();
  });

  it('shows the empty state when there are no rules', async () => {
    getBillingRulesMock.mockResolvedValue({ rules: [] });
    renderRules();

    expect(await screen.findByText('No rules yet')).toBeInTheDocument();
  });
});

describe('ConditionalEditor', () => {
  it('renders IF / THEN for a single-branch conditional', () => {
    render(<ConditionalEditor value={ruleA.conditional} onChange={() => undefined} />);
    expect(screen.getByText('IF')).toBeInTheDocument();
    expect(screen.getByText('THEN')).toBeInTheDocument();
  });

  it('uses the searchable payer picker (not a text field) for payerId in both the condition and the action', () => {
    render(<ConditionalEditor value={ruleA.conditional} onChange={() => undefined} />);
    // ruleA has a payerId condition and a setField-payerId action — both should be payer pickers.
    expect(screen.getAllByPlaceholderText(/Search payers/)).toHaveLength(2);
  });
});
