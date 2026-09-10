import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import GoToButton from '../../src/components/GoToButton';

describe('GoToButton', () => {
  it('renders a real anchor when given a destination, so the browser can offer open-in-new-tab', () => {
    render(
      <MemoryRouter>
        <GoToButton text="Visit Details" to="/visit/appt-1" dataTestId="visit-details-button">
          <span />
        </GoToButton>
      </MemoryRouter>
    );

    const button = screen.getByTestId('visit-details-button');
    expect(button.tagName).toBe('A');
    expect(button).toHaveAttribute('href', '/visit/appt-1');
    // A link must not be re-labelled as a button, or assistive tech loses the navigation semantics.
    expect(button).not.toHaveAttribute('role', 'button');
  });

  it('renders a button that runs its handler when given onClick', async () => {
    const onClick = vi.fn();
    render(
      <GoToButton text="Account Settings" onClick={onClick} dataTestId="account-settings-button">
        <span />
      </GoToButton>
    );

    const button = screen.getByTestId('account-settings-button');
    expect(button.tagName).toBe('BUTTON');

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a spinner instead of the control while loading', () => {
    render(
      <GoToButton text="Medical Record" onClick={vi.fn()} loading dataTestId="medical-record-button">
        <span />
      </GoToButton>
    );

    expect(screen.queryByTestId('medical-record-button')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
