vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCPTHCPCSSearch: ({ search }: { search: string }) => ({
    isFetching: false,
    data: {
      codes: search
        ? [
            { code: '10060', display: 'Incision and drainage of abscess' },
            { code: '12042', display: 'Intermediate repair' },
          ]
        : [],
    },
  }),
}));

vi.mock('../../src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({ debounce: (callback: () => void) => callback(), clear: vi.fn() }),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProcedureCptCodesField } from '../../src/features/visits/in-person/components/procedures/ProcedureCptCodesField';

const repair = { code: '12042', display: 'Intermediate repair' };

describe('ProcedureCptCodesField', () => {
  it('adds the picked code and closes the search', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProcedureCptCodesField codes={[repair]} onChange={onChange} readOnly={false} />);

    await user.click(screen.getByTestId('add-cpt-code'));
    await user.type(screen.getByRole('combobox', { name: 'Search CPT codes' }), 'drain');
    await user.click(await screen.findByRole('option', { name: '10060 Incision and drainage of abscess' }));

    expect(onChange).toHaveBeenCalledWith([repair, { code: '10060', display: 'Incision and drainage of abscess' }]);
    expect(screen.queryByRole('combobox', { name: 'Search CPT codes' })).not.toBeInTheDocument();
  });

  it('does not offer a code that is already added', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProcedureCptCodesField codes={[repair]} onChange={onChange} readOnly={false} />);

    await user.click(screen.getByTestId('add-cpt-code'));
    await user.type(screen.getByRole('combobox', { name: 'Search CPT codes' }), 'repair');

    expect(await screen.findByRole('option', { name: '12042 Intermediate repair' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('starts an empty search each time it opens', async () => {
    const user = userEvent.setup();
    render(<ProcedureCptCodesField codes={[]} onChange={vi.fn()} readOnly={false} />);

    await user.click(screen.getByTestId('add-cpt-code'));
    await user.type(screen.getByRole('combobox', { name: 'Search CPT codes' }), 'drain');
    expect(await screen.findByRole('option', { name: '10060 Incision and drainage of abscess' })).toBeVisible();
    await user.keyboard('{Escape}');

    await user.click(screen.getByTestId('add-cpt-code'));
    const search = screen.getByRole('combobox', { name: 'Search CPT codes' });
    search.focus();
    await user.keyboard('{ArrowDown}');

    expect(search).toHaveValue('');
    expect(await screen.findByText('Start typing to load results')).toBeVisible();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('drops the results when the search field clears itself on blur', async () => {
    const user = userEvent.setup();
    render(<ProcedureCptCodesField codes={[]} onChange={vi.fn()} readOnly={false} />);

    await user.click(screen.getByTestId('add-cpt-code'));
    const search = screen.getByRole('combobox', { name: 'Search CPT codes' });
    await user.type(search, 'drain');
    expect(await screen.findByRole('option', { name: '10060 Incision and drainage of abscess' })).toBeVisible();
    await user.click(screen.getByRole('dialog', { name: 'CPT code' }));
    await user.click(search);

    expect(search).toHaveValue('');
    expect(await screen.findByText('Start typing to load results')).toBeVisible();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('removes only the clicked line when a code is billed twice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const first = {
      code: '10060',
      display: 'Incision and drainage of abscess',
      modifier: [{ code: '59', display: 'Distinct procedural service' }],
    };
    const second = { code: '10060', display: 'Incision and drainage of abscess' };
    render(<ProcedureCptCodesField codes={[first, second]} onChange={onChange} readOnly={false} />);

    await user.click(screen.getAllByRole('button', { name: 'Remove 10060' })[1]);

    expect(onChange).toHaveBeenCalledWith([first]);
  });

  it('shows codes without search or remove controls when read-only', () => {
    render(<ProcedureCptCodesField codes={[repair]} onChange={vi.fn()} readOnly />);

    expect(screen.getByTestId('cpt-code')).toHaveTextContent('12042');
    expect(screen.queryByTestId('add-cpt-code')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove 12042' })).not.toBeInTheDocument();
  });
});
