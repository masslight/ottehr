import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SideDrawer } from '../../src/components/SideDrawer';

const BODY_TEXT = 'Panel body';

function renderDrawer(props: { open: boolean; onClose?: () => void }): void {
  render(
    <SideDrawer open={props.open} onClose={props.onClose ?? ((): void => {})} title="Notes">
      <p>{BODY_TEXT}</p>
    </SideDrawer>
  );
}

describe('SideDrawer', () => {
  it('renders the title and its children when open', () => {
    renderDrawer({ open: true });

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText(BODY_TEXT)).toBeInTheDocument();
  });

  it('renders no content when closed', () => {
    renderDrawer({ open: false });

    expect(screen.queryByText(BODY_TEXT)).not.toBeInTheDocument();
  });

  it('closes from the header close button', () => {
    const onClose = vi.fn();
    renderDrawer({
      open: true,
      onClose,
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderDrawer({
      open: true,
      onClose,
    });

    const drawerRoot = screen.getByRole('presentation');
    fireEvent.keyDown(drawerRoot, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
