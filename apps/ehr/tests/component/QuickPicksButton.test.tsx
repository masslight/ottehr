import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuickPicksButton } from '../../src/features/visits/shared/components/QuickPicksButton';

interface TestItem {
  id: string;
  label: string;
}

const mockItems: TestItem[] = [
  { id: '1', label: 'Acetaminophen 650 mg, Oral' },
  { id: '2', label: 'Ibuprofen 400 mg, Oral' },
];

const defaultProps = {
  quickPicks: mockItems,
  getLabel: (item: TestItem) => item.label,
  onSelect: vi.fn(),
};

describe('QuickPicksButton', () => {
  describe('rendering', () => {
    it('renders null when quickPicks is empty', () => {
      const { container } = render(
        <QuickPicksButton quickPicks={[]} getLabel={(item: TestItem) => item.label} onSelect={vi.fn()} />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders the button when quickPicks has items', () => {
      render(<QuickPicksButton {...defaultProps} />);

      expect(screen.getByRole('button', { name: /quick picks/i })).toBeInTheDocument();
    });

    it('disables the button when disabled prop is true', () => {
      render(<QuickPicksButton {...defaultProps} disabled />);

      expect(screen.getByRole('button', { name: /quick picks/i })).toBeDisabled();
    });
  });

  describe('menu items', () => {
    it('shows quick pick options after clicking the button', async () => {
      const user = userEvent.setup();
      render(<QuickPicksButton {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /quick picks/i }));

      expect(screen.getByText('Acetaminophen 650 mg, Oral')).toBeInTheDocument();
      expect(screen.getByText('Ibuprofen 400 mg, Oral')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onSelect with the correct item when a quick pick is clicked', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(<QuickPicksButton {...defaultProps} onSelect={onSelect} />);

      await user.click(screen.getByRole('button', { name: /quick picks/i }));
      await user.click(screen.getByText('Acetaminophen 650 mg, Oral'));

      expect(onSelect).toHaveBeenCalledWith(mockItems[0]);
    });

    it('closes the menu after selecting a quick pick', async () => {
      const user = userEvent.setup();
      render(<QuickPicksButton {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /quick picks/i }));
      await user.click(screen.getByText('Acetaminophen 650 mg, Oral'));

      expect(screen.queryByText('Ibuprofen 400 mg, Oral')).not.toBeInTheDocument();
    });
  });
});
