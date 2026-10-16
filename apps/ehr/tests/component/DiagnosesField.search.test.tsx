import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagnosesField } from '../../src/features/visits/shared/components/assessment-tab/DiagnosesField';

const { response, search } = vi.hoisted(() => ({
  response: { codes: [{ code: 'J06.9', display: 'URI' }], placeholder: false, fetching: false },
  search: vi.fn(),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useICD10SearchNew: (params: { search: string }) => {
    search(params);
    return { data: { codes: response.codes }, isPlaceholderData: response.placeholder, isFetching: response.fetching };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  response.codes = [{ code: 'J06.9', display: 'URI' }];
  response.placeholder = false;
  response.fetching = false;
});

describe('diagnosis search choices', () => {
  it('removes quick picks immediately on typing and prevents selecting an unrelated code during debounce', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DiagnosesField
        onChange={onChange}
        disableForPrimary={false}
        quickPickOptions={[{ code: 'S61.4', display: 'Laceration' }]}
      />
    );
    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(screen.getByRole('option', { name: 'S61.4 Laceration' })).toBeInTheDocument();
    await user.type(input, 'URI{ArrowDown}{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('option', { name: 'S61.4 Laceration' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'J06.9 URI' }));
    expect(onChange).toHaveBeenCalledWith({ code: 'J06.9', display: 'URI' });
  });
  it.each([false, true])(
    'restores visit choices after blurring an abandoned search (query finished: %s)',
    async (queryFinished) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <>
          <DiagnosesField
            onChange={onChange}
            disableForPrimary={false}
            quickPickOptions={[{ code: 'S61.4', display: 'Laceration' }]}
          />
          <button>Outside</button>
        </>
      );
      const input = screen.getByRole('combobox');
      await user.type(input, 'URI');
      if (queryFinished) await screen.findByRole('option', { name: 'J06.9 URI' });
      await user.click(screen.getByRole('button', { name: 'Outside' }));
      expect(input).toHaveValue('');
      await user.click(input);
      expect(screen.getByRole('option', { name: 'S61.4 Laceration' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'J06.9 URI' })).not.toBeInTheDocument();
      await waitFor(() => expect(search).toHaveBeenLastCalledWith({ search: '' }));
      await user.click(screen.getByRole('option', { name: 'S61.4 Laceration' }));
      expect(onChange).toHaveBeenCalledWith({ code: 'S61.4', display: 'Laceration' });
    }
  );

  it('keeps an existing selection visible when an abandoned search resets on blur', async () => {
    const user = userEvent.setup();
    const selected = { code: 'S61.4', display: 'Laceration' };
    const onChange = vi.fn();
    render(
      <>
        <DiagnosesField value={selected} onChange={onChange} disableForPrimary={false} />
        <button>Outside</button>
      </>
    );
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue('S61.4 Laceration');
    await user.clear(input);
    await user.type(input, 'URI');
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(input).toHaveValue('S61.4 Laceration');
    expect(onChange).not.toHaveBeenCalled();
    expect(search).toHaveBeenLastCalledWith({ search: '' });
  });

  it('does not expose previous-query results while the new query is loading', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    response.placeholder = true;
    const { rerender } = render(<DiagnosesField onChange={onChange} disableForPrimary={false} />);
    await user.type(screen.getByRole('combobox'), 'cough');
    await waitFor(() => expect(search).toHaveBeenLastCalledWith({ search: 'cough' }));
    expect(screen.queryByRole('option', { name: 'J06.9 URI' })).not.toBeInTheDocument();
    response.placeholder = false;
    response.codes = [{ code: 'R05.9', display: 'Cough' }];
    rerender(<DiagnosesField onChange={onChange} disableForPrimary={false} />);
    await user.click(screen.getByRole('option', { name: 'R05.9 Cough' }));
    expect(onChange).toHaveBeenCalledWith({ code: 'R05.9', display: 'Cough' });
  });
});
