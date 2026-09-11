import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GoToButton from '../../src/components/GoToButton';

const CurrentPath = (): React.ReactElement => <div data-testid="current-path">{useLocation().pathname}</div>;

const renderLink = (): void => {
  render(
    <MemoryRouter initialEntries={['/visits']}>
      <GoToButton text="Visit Details" to="/visit/appt-1" dataTestId="visit-details-button">
        <span />
      </GoToButton>
      <CurrentPath />
    </MemoryRouter>
  );
};

// Clicks the router leaves alone reach jsdom's anchor default, which then logs a "navigation not
// implemented" error. Swallowing the default at the document keeps that noise out of the test
// output; defaultPrevented is read first, so what gets recorded is the router's decision, not ours.
const observedClicks: boolean[] = [];
const swallowNavigation = (event: Event): void => {
  observedClicks.push(event.defaultPrevented);
  event.preventDefault();
};
document.addEventListener('click', swallowNavigation);

afterEach(() => {
  observedClicks.length = 0;
});

describe('GoToButton', () => {
  it('renders a real anchor when given a destination, so the browser can offer open-in-new-tab', () => {
    renderLink();

    const button = screen.getByTestId('visit-details-button');
    expect(button.tagName).toBe('A');
    expect(button).toHaveAttribute('href', '/visit/appt-1');
    // A link must not be re-labelled as a button, or assistive tech loses the navigation semantics.
    expect(button).not.toHaveAttribute('role', 'button');
  });

  it('navigates in place on a plain click', async () => {
    renderLink();

    await userEvent.click(screen.getByTestId('visit-details-button'));

    expect(screen.getByTestId('current-path')).toHaveTextContent('/visit/appt-1');
  });

  it.each([
    ['cmd', '{Meta>}', '{/Meta}'],
    ['ctrl', '{Control>}', '{/Control}'],
    ['shift', '{Shift>}', '{/Shift}'],
  ])(
    'leaves %s-click to the browser so it opens a new tab instead of navigating in place',
    async (_modifier, press, release) => {
      renderLink();

      // One session, so the held modifier is still down when the click is dispatched.
      const user = userEvent.setup();
      await user.keyboard(press);
      await user.click(screen.getByTestId('visit-details-button'));
      await user.keyboard(release);

      expect(screen.getByTestId('current-path')).toHaveTextContent('/visits');
      // The router must not preventDefault here, or the browser never gets to open the new tab.
      expect(observedClicks).toEqual([false]);
    }
  );

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
