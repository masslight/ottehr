import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProcedureCptCodesField } from '../../src/features/visits/in-person/components/procedures/ProcedureCptCodesField';

describe('ProcedureCptCodesField', () => {
  it('does not add a CPT code that is already selected', async () => {
    const user = userEvent.setup();
    const selectedCode = { code: '12042', display: 'Intermediate repair' };
    const onAdd = vi.fn();
    render(
      <ProcedureCptCodesField
        codes={[selectedCode]}
        searchOptions={[selectedCode]}
        isSearching={false}
        searchTerm="12042"
        onSearchTermChange={vi.fn()}
        onAdd={onAdd}
        onDelete={vi.fn()}
        disabled={false}
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'CPT code' }));
    const option = await screen.findByRole('option', { name: '12042 Intermediate repair' });
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(onAdd).not.toHaveBeenCalled();
  });
});
