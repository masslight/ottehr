import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RemitCodeAutocomplete } from '../../src/components/era/RemitCodeAutocomplete';

describe('RemitCodeAutocomplete', () => {
  it('offers a deactivated CARC, marked, first when its code is typed', async () => {
    const onChange = vi.fn();
    render(<RemitCodeAutocomplete kind="carc" value="" onChange={onChange} />);

    const input = screen.getByRole('combobox', { name: 'CARC' });
    input.focus();
    fireEvent.change(input, { target: { value: '15' } });
    const options = await screen.findAllByRole('option');
    // the code typed, ahead of 150, 151, ... and marked as no longer current
    expect(options[0]).toHaveTextContent(/^15Deactivated/);
    expect(within(options[0]).getByText('Deactivated')).toBeInTheDocument();
    expect(options[1]).toHaveTextContent(/^150/);
    expect(within(options[1]).queryByText('Deactivated')).not.toBeInTheDocument();

    fireEvent.click(options[0]);
    expect(onChange).toHaveBeenCalledWith('15');
  });
});
