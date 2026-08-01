import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BillingRule, RuleConditional, RulesEngineType } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConditionalEditor } from '../../src/components/rules/RuleBuilder';
import Rules from '../../src/pages/Rules';

const { getBillingRulesMock, saveBillingRulesMock, searchBillingProvidersMock, searchBillingTagsMock, stableClients } =
  vi.hoisted(() => ({
    getBillingRulesMock: vi.fn(),
    saveBillingRulesMock: vi.fn(),
    searchBillingProvidersMock: vi.fn(),
    searchBillingTagsMock: vi.fn(),
    stableClients: { oystehrZambda: {} },
  }));

vi.mock('../../src/api/api', () => ({
  getBillingRules: getBillingRulesMock,
  saveBillingRules: saveBillingRulesMock,
  // PayerSelect (rendered for the payerId condition) searches payers on open/input, not on mount;
  // same for TagSelect (apply-tag action), ProcedureCodeAutocomplete (CPT inputs), and the
  // provider/facility reference pickers.
  searchBillingPayers: () => Promise.resolve({ payers: [] }),
  searchBillingProcedureCodes: () => Promise.resolve({ codes: [] }),
  searchBillingProviders: searchBillingProvidersMock,
  searchBillingServiceFacilities: () => Promise.resolve({ facilities: [], total: 0, offset: 0, pageSize: 50 }),
  searchBillingTags: searchBillingTagsMock,
}));

// The real hook returns a stable client (zustand store, set once); the mock must too, or effects
// keyed on the client identity refetch every render.
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => stableClients,
}));

const ruleA: BillingRule = {
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

// The page resolves its engine from the /rules/:engine route param, so mount it behind a real route.
function renderRules(engine: RulesEngineType = 'claim-submission'): ReactElement {
  return render(
    <MemoryRouter initialEntries={[`/rules/${engine}`]}>
      <Routes>
        <Route path="/rules/:engine" element={<Rules />} />
      </Routes>
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
    expect(screen.getByText('Claim Submission Rules')).toBeInTheDocument();
    expect(screen.getByText('When all rules pass, the claim is submitted to the payer.')).toBeInTheDocument();
    expect(getBillingRulesMock).toHaveBeenCalledWith(expect.anything(), { engine: 'claim-submission' });
  });

  it("loads the routed engine's rules and describes its outcome", async () => {
    getBillingRulesMock.mockResolvedValue({ rules: [], versionId: 'v1' });
    renderRules('non-insurance-payer-pre-invoice');

    expect(await screen.findByText('Non-Insurance Payer Pre-Invoice Rules')).toBeInTheDocument();
    expect(
      screen.getByText('When all rules pass, the Non-insurance AR Status moves to Ready to invoice.')
    ).toBeInTheDocument();
    expect(getBillingRulesMock).toHaveBeenCalledWith(expect.anything(), { engine: 'non-insurance-payer-pre-invoice' });
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
  onValid?: (data?: { conditional: RuleConditional }) => void;
}): ReactElement {
  const methods = useForm<{ conditional: RuleConditional }>({ defaultValues: { conditional } });
  return (
    <FormProvider {...methods}>
      <ConditionalEditor name="conditional" />
      <button onClick={() => void methods.handleSubmit((data) => onValid?.(data))()}>Save</button>
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

  it('renders line match and set controls for an update-service-lines action', () => {
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'all' },
          outcome: {
            type: 'actions',
            actions: [
              {
                type: 'updateServiceLines',
                match: { type: 'field', property: 'cptCode', operator: 'eq', value: '99213' },
                set: { property: 'cptCode', value: '99214' },
              },
            ],
          },
        },
      ],
    };
    render(<ConditionalForm conditional={conditional} />);
    expect(screen.getAllByText('Lines to match').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Line property').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Set line property').length).toBeGreaterThan(0);
    expect(screen.getAllByText('New value').length).toBeGreaterThan(0);
    // Both the match and the set pickers display the selected line property's label.
    expect(screen.getAllByText('CPT code').length).toBeGreaterThan(0);
  });

  it('renders the line match and the selection note for an apply-charge-master-prices action', () => {
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'all' },
          outcome: {
            type: 'actions',
            actions: [{ type: 'applyChargeMasterPrices', match: { type: 'all' } }],
          },
        },
      ],
    };
    render(<ConditionalForm conditional={conditional} />);
    // The action picker shows the action, the reusable line-match editor renders, and the helper
    // text explains how the charge master is chosen.
    expect(screen.getByText('Apply charge master prices')).toBeInTheDocument();
    expect(screen.getAllByText('Lines to match').length).toBeGreaterThan(0);
    expect(screen.getByText(/best charge master/)).toBeInTheDocument();
  });

  it('renders the add-service-line form and blocks submit on missing required fields', async () => {
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'all' },
          outcome: {
            type: 'actions',
            actions: [{ type: 'addServiceLine', line: { cptCode: '', charges: '' } }],
          },
        },
      ],
    };
    const onValid = vi.fn();
    render(<ConditionalForm conditional={conditional} onValid={onValid} />);

    expect(screen.getByLabelText(/CPT code/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Service date/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('CPT code is required')).toBeInTheDocument();
    expect(screen.getByText('Charges are required')).toBeInTheDocument();
    expect(onValid).not.toHaveBeenCalled();
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

  it('offers only existing tags (plus the built-in Hold) in the apply-tag picker', async () => {
    searchBillingTagsMock.mockReset();
    searchBillingTagsMock.mockResolvedValue({ tags: [{ name: 'VIP', description: 'White-glove payers' }] });
    const conditional: RuleConditional = {
      branches: [
        { condition: { type: 'all' }, outcome: { type: 'actions', actions: [{ type: 'applyTag', tag: '' }] } },
      ],
    };
    render(<ConditionalForm conditional={conditional} />);

    // Opening the picker triggers the one-time tag fetch.
    fireEvent.mouseDown(screen.getByLabelText(/Tag name/));

    expect(await screen.findByRole('option', { name: /VIP/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Hold/ })).toBeInTheDocument();
    expect(searchBillingTagsMock).toHaveBeenCalledTimes(1);
  });

  it('renders a state dropdown (not free text) for state conditions', async () => {
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'field', field: 'patient.state', operator: 'eq', value: 'CA' },
          outcome: { type: 'noop' },
        },
      ],
    };
    render(<ConditionalForm conditional={conditional} />);

    // The stored code renders with its full-name label, and the menu offers the other states.
    const display = screen.getByText('CA - California');
    fireEvent.mouseDown(display);
    expect(await screen.findByRole('option', { name: 'TX - Texas' })).toBeInTheDocument();
  });

  it('blocks submit on a checksum-invalid NPI and passes once corrected', async () => {
    const conditional: RuleConditional = {
      branches: [
        {
          // 1234567890 is 10 digits but fails the Luhn check digit.
          condition: { type: 'field', field: 'renderingProvider.npi', operator: 'eq', value: '1234567890' },
          outcome: { type: 'noop' },
        },
      ],
    };
    const onValid = vi.fn();
    render(<ConditionalForm conditional={conditional} onValid={onValid} />);

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByLabelText('Value *')).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('NPI must be a valid 10-digit number with a correct check digit')).toBeInTheDocument();
    expect(onValid).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Value *'), { target: { value: '1234567893' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onValid).toHaveBeenCalled());
  });

  it('offers reference providers in the set-provider picker and stores the encoded reference', async () => {
    searchBillingProvidersMock.mockReset();
    searchBillingProvidersMock.mockResolvedValue({
      providers: [
        {
          id: 'org-1',
          kind: 'organization',
          name: 'New Billing Group',
          npi: '8888888888',
          renders: false,
          bills: true,
          isWorkingCopy: false,
        },
      ],
      total: 1,
      offset: 0,
      pageSize: 50,
    });
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'all' },
          outcome: { type: 'actions', actions: [{ type: 'setField', field: 'billingProvider.ref', value: '' }] },
        },
      ],
    };
    const onValid = vi.fn();
    render(<ConditionalForm conditional={conditional} onValid={onValid} />);

    const input = screen.getByPlaceholderText('Search providers…');
    fireEvent.mouseDown(input);
    fireEvent.click(await screen.findByRole('option', { name: /New Billing Group/ }));
    expect(searchBillingProvidersMock).toHaveBeenCalledWith(expect.anything(), { providerType: 'billing' });

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onValid).toHaveBeenCalled());
    const action = onValid.mock.calls[0][0].conditional.branches[0].outcome.actions[0];
    expect(action).toEqual({ type: 'setField', field: 'billingProvider.ref', value: 'Organization/org-1' });
  });

  it('blocks submit when a set-provider action has no provider picked', async () => {
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'all' },
          outcome: { type: 'actions', actions: [{ type: 'setField', field: 'renderingProvider.ref', value: '' }] },
        },
      ],
    };
    const onValid = vi.fn();
    render(<ConditionalForm conditional={conditional} onValid={onValid} />);

    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Value is required')).toBeInTheDocument();
    expect(onValid).not.toHaveBeenCalled();
  });

  it('marks required value labels with an asterisk and leaves blank-on-purpose values unmarked', () => {
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'field', field: 'insurance.memberId', operator: 'eq', value: 'A1' },
          outcome: {
            type: 'actions',
            actions: [
              { type: 'setField', field: 'serviceDate', value: '' },
              { type: 'setField', field: 'insurance.memberId', value: '' },
              { type: 'applyTag', tag: '' },
            ],
          },
        },
      ],
    };
    render(<ConditionalForm conditional={conditional} />);

    expect(screen.getByLabelText('Value *')).toBeInTheDocument();
    expect(screen.getByLabelText('Tag name *')).toBeInTheDocument();
    expect(screen.getByLabelText('New value *')).toBeInTheDocument();
    expect(screen.getByLabelText('New value')).toBeInTheDocument();
  });

  it('marks service-line value labels required except where blank means "clear"', () => {
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'all' },
          outcome: {
            type: 'actions',
            actions: [
              {
                type: 'updateServiceLines',
                match: { type: 'field', property: 'charges', operator: 'gt', value: '0' },
                set: { property: 'modifiers', value: '', operation: 'set' },
              },
              {
                type: 'updateServiceLines',
                match: { type: 'all' },
                set: { property: 'modifiers', value: '25', operation: 'add' },
              },
              { type: 'addServiceLine', line: { cptCode: '', charges: '' } },
            ],
          },
        },
      ],
    };
    render(<ConditionalForm conditional={conditional} />);

    expect(screen.getByLabelText('Value *')).toBeInTheDocument();
    expect(screen.getByLabelText('Modifiers (comma-separated)')).toBeInTheDocument();
    expect(screen.getByLabelText('Modifier to add *')).toBeInTheDocument();
    expect(screen.getByLabelText('CPT code *')).toBeInTheDocument();
    expect(screen.getByLabelText('Charges *')).toBeInTheDocument();
    expect(screen.getByLabelText('Units (optional)')).toBeInTheDocument();
  });

  it('resets the value when the operator arity changes (is one of -> equals)', async () => {
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'field', field: 'insurance.memberId', operator: 'in', value: ['A1', 'B2'] },
          outcome: { type: 'noop' },
        },
      ],
    };
    render(<ConditionalForm conditional={conditional} />);

    expect(screen.getByLabelText('Values (comma-separated) *')).toHaveValue('A1, B2');

    fireEvent.mouseDown(screen.getByText('is one of'));
    fireEvent.click(await screen.findByRole('option', { name: 'equals' }));

    // The stale list must not survive to be silently compared as its first entry.
    expect(screen.getByLabelText('Value *')).toHaveValue('');

    // Same-arity switches keep the value. (The closed menu stays mounted, so scope the reopen
    // to the combobox display rather than any text match.)
    fireEvent.change(screen.getByLabelText('Value *'), { target: { value: 'A1' } });
    const operatorDisplay = screen
      .getAllByText('equals')
      .find((element) => element.getAttribute('role') === 'combobox');
    fireEvent.mouseDown(operatorDisplay!);
    fireEvent.click(await screen.findByRole('option', { name: 'does not equal' }));
    expect(screen.getByLabelText('Value *')).toHaveValue('A1');
  });

  it('renders a free-text pattern input (not the option dropdown) for a regex operator on an enumerated field', () => {
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'field', field: 'serviceFacility.posCode', operator: 'matches', value: '^2[0-3]$' },
          outcome: { type: 'noop' },
        },
      ],
    };
    render(<ConditionalForm conditional={conditional} />);

    // The POS field normally renders a select of CMS codes; in regex mode it's a plain pattern box.
    const pattern = screen.getByLabelText('Pattern *');
    expect(pattern).toHaveValue('^2[0-3]$');
    expect(screen.queryByText('20 - Urgent Care Facility')).not.toBeInTheDocument();
    expect(screen.getByText(/anchor with \^ and \$/)).toBeInTheDocument();
  });

  it('blocks submit on an uncompilable pattern and resets the value when regex-ness changes', async () => {
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'field', field: 'insurance.memberId', operator: 'matches', value: 'XKD[0-9' },
          outcome: { type: 'noop' },
        },
      ],
    };
    const onValid = vi.fn();
    render(<ConditionalForm conditional={conditional} onValid={onValid} />);

    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Must be a valid regular expression')).toBeInTheDocument();
    expect(onValid).not.toHaveBeenCalled();

    // Switching from a regex operator to a literal one drops the pattern — it is not a value.
    fireEvent.mouseDown(screen.getByText('matches pattern'));
    fireEvent.click(await screen.findByRole('option', { name: 'equals' }));
    expect(screen.getByLabelText('Value *')).toHaveValue('');
  });

  it('clears a stale value error when the condition property changes', async () => {
    const conditional: RuleConditional = {
      branches: [
        {
          condition: { type: 'field', field: 'renderingProvider.npi', operator: 'eq', value: 'abc' },
          outcome: { type: 'noop' },
        },
      ],
    };
    render(<ConditionalForm conditional={conditional} />);

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.getByLabelText('Value *')).toHaveAttribute('aria-invalid', 'true'));

    // Switch the condition to a different property; the NPI error no longer applies to its value.
    fireEvent.mouseDown(screen.getByText('NPI'));
    fireEvent.click((await screen.findAllByRole('option', { name: 'Member ID' }))[0]);

    await waitFor(() => expect(screen.getByLabelText('Value *')).not.toHaveAttribute('aria-invalid', 'true'));
  });
});
