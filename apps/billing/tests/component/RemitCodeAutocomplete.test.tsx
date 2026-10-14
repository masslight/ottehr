import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RemitCodeAutocomplete } from '../../src/components/era/RemitCodeAutocomplete';

describe('RemitCodeAutocomplete', () => {
  it('offers the code typed first, with its description, ahead of the codes that start with it', async () => {
    const onChange = vi.fn();
    render(<RemitCodeAutocomplete kind="carc" value="" onChange={onChange} />);

    const input = screen.getByRole('combobox', { name: 'CARC' });
    input.focus();
    fireEvent.change(input, { target: { value: '15' } });
    const options = await screen.findAllByRole('option');
    // the code typed, ahead of 150, 151, ...
    expect(options[0]).toHaveTextContent(/^15Denied: prior-approval number absent, wrong, or for something else$/);
    expect(options[1]).toHaveTextContent(/^150/);

    fireEvent.click(options[0]);
    expect(onChange).toHaveBeenCalledWith('15');
  });
});
