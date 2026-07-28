import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProcedureMultiSelect } from '../../src/features/visits/in-person/components/procedures/ProcedureFormFields';

describe('ProcedureMultiSelect', () => {
  it('matches selected values to options by their stable value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ProcedureMultiSelect
        label="Technique"
        options={['Curette']}
        values={['Curette']}
        onChange={onChange}
        disabled={false}
        dataTestId="technique"
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Technique' }));
    await user.click(await screen.findByRole('option', { name: 'Curette' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
