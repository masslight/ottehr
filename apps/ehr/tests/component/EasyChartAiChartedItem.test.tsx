import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChartedItem } from '../../src/features/easy-charting/AiChartedItem';

// First component coverage for the easy-chart feature: the AI-charted row is the provider's
// primary review affordance (confirm ✓ / correct / remove), so its behavior is safety-relevant.
describe('AiChartedItem', () => {
  const onConfirm = vi.fn();
  const onSearch = vi.fn().mockResolvedValue([
    { key: 'k1', label: 'S16.1XXA — Strain of muscle, fascia and tendon at neck level, initial encounter' },
    { key: 'k2', label: 'S13.4XXA — Sprain of ligaments of cervical spine, initial encounter' },
  ]);
  const onReplace = vi.fn();
  const onRemove = vi.fn();
  const onDiscuss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderItem = (extra: Partial<Parameters<typeof AiChartedItem>[0]> = {}): ReturnType<typeof render> =>
    render(
      <AiChartedItem
        needsReview
        initialQuery="Unspecified injury of neck"
        onConfirm={onConfirm}
        onSearch={onSearch}
        onReplace={onReplace}
        onRemove={onRemove}
        onDiscuss={onDiscuss}
        {...extra}
      >
        <span>S19.9XXA — Unspecified injury of neck, initial encounter</span>
      </AiChartedItem>
    );

  it('renders the charted content', () => {
    renderItem();
    expect(screen.getByText(/Unspecified injury of neck/)).toBeDefined();
  });

  it('confirm ✓ accepts the item without opening the editor', async () => {
    const user = userEvent.setup();
    renderItem();
    const confirm = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('clicking the row opens the inline editor and runs the debounced search', async () => {
    const user = userEvent.setup();
    renderItem();
    await user.click(screen.getByText(/Unspecified injury of neck/));
    // The editor autocomplete appears seeded with the initial query…
    const input = await screen.findByDisplayValue('Unspecified injury of neck');
    expect(input).toBeDefined();
    // …and the debounced (250ms) search fires with it.
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('Unspecified injury of neck'), { timeout: 2000 });
  });

  it('picking an alternative calls onReplace with its key', async () => {
    const user = userEvent.setup();
    renderItem();
    await user.click(screen.getByText(/Unspecified injury of neck/));
    const option = await screen.findByText(/S16\.1XXA/, undefined, { timeout: 2000 });
    await user.click(option);
    await waitFor(() => expect(onReplace).toHaveBeenCalled());
    expect(onReplace.mock.calls[0][0]).toBe('k1');
  });

  it('the editor remove button calls onRemove', async () => {
    const user = userEvent.setup();
    renderItem();
    await user.click(screen.getByText(/Unspecified injury of neck/));
    const remove = await screen.findByRole('button', { name: /remove/i });
    await user.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('sourced vs inferred provenance renders distinguishably', () => {
    const { unmount } = renderItem({ sourceText: 'neck pain after the collision' });
    expect(screen.queryByText(/inferred/i)).toBeNull();
    unmount();
    renderItem({ inferred: true });
    expect(screen.getByText(/inferred/i)).toBeDefined();
  });
});
