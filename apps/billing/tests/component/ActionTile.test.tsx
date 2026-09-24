import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionTile, ActionTileGroup } from '../../src/components/ActionTile';

const Icon = (): JSX.Element => <svg aria-hidden="true" />;

describe('ActionTile', () => {
  it('is a button named by its label', () => {
    const onClick = vi.fn();
    render(<ActionTile label="Export X12" icon={<Icon />} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Export X12' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('opens a link in a new tab', () => {
    render(<ActionTile label="View in EHR" icon={<Icon />} href="https://ehr.example.com/visit/1" />);

    const link = screen.getByRole('link', { name: 'View in EHR' });
    expect(link).toHaveAttribute('href', 'https://ehr.example.com/visit/1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows a spinner and cannot be clicked while loading', () => {
    render(<ActionTile label="Building…" icon={<Icon />} onClick={vi.fn()} loading />);

    expect(screen.getByRole('button', { name: 'Building…' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('ActionTileGroup', () => {
  const tiles = (count: number): JSX.Element[] =>
    Array.from({ length: count }, (_, i) => <ActionTile key={i} label={`Tile ${i}`} icon={<Icon />} />);
  const groupWidth = (): string =>
    getComputedStyle(screen.getByRole('button', { name: 'Tile 0' }).parentElement!).width;

  it('keeps up to four tiles on one row', () => {
    render(<ActionTileGroup>{tiles(4)}</ActionTileGroup>);
    expect(groupWidth()).toBe(`${4 * 96 + 3 * 8}px`);
  });

  it('splits more tiles evenly over two rows, ignoring children that render nothing', () => {
    render(
      <ActionTileGroup>
        {''}
        {false}
        {tiles(6)}
      </ActionTileGroup>
    );
    expect(groupWidth()).toBe(`${3 * 96 + 2 * 8}px`);
  });
});
