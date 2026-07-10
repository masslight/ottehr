import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import { PreSubmissionRule, RuleConditional } from 'utils';
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

// The editor reads and writes through react-hook-form, so tests mount it inside a real form. The
// submit button drives handleSubmit, mirroring RuleDetail's save.
function ConditionalForm({
  conditional,
  onValid,
}: {
  conditional: RuleConditional;
  onValid?: () => void;
}): ReactElement {
  const methods = useForm<{ conditional: RuleConditional }>({ defaultValues: { conditional } });
  return (
    <FormProvider {...methods}>
      <ConditionalEditor name="conditional" />
      <button onClick={() => void methods.handleSubmit(() => onValid?.())()}>Save</button>
    </FormProvider>
  );
}

describe('ConditionalEditor', () => {
  it('renders IF / THEN for a single-branch conditional', () => {
    render(<ConditionalForm conditional={ruleA.conditional} />);
    expect(screen.getByText('IF')).toBeInTheDocument();
    expect(screen.getByText('THEN')).toBeInTheDocument();
  });

  it('uses the searchable payer picker (not a text field) for payerId in both the condition and the action', () => {
    render(<ConditionalForm conditional={ruleA.conditional} />);
    // ruleA has a payerId condition and a setField-payerId action — both should be payer pickers.
    expect(screen.getAllByPlaceholderText(/Search payers/)).toHaveLength(2);
  });

  it('blocks submit, highlights, and focuses an empty tag name instead of round-tripping to the server', async () => {
    const conditional: RuleConditional = {
      branches: [
        { condition: { type: 'all' }, outcome: { type: 'actions', actions: [{ type: 'applyTag', tag: '' }] } },
      ],
    };
    const onValid = vi.fn();
    render(<ConditionalForm conditional={conditional} onValid={onValid} />);

    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Tag name is required')).toBeInTheDocument();
    const tagInput = screen.getByLabelText(/Tag name/);
    await waitFor(() => expect(tagInput).toHaveFocus());
    expect(onValid).not.toHaveBeenCalled();
  });
});
