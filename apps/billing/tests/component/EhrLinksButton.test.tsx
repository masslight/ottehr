import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EhrLinksButton } from '../../src/components/claim/EhrLinksButton';

const EHR_URL = 'https://ehr.example.com';
const APPOINTMENT_ID = 'appt-1';
const ENCOUNTER_ID = 'enc-1';

const renderButton = (): void => {
  render(<EhrLinksButton ehrUrl={EHR_URL} appointmentId={APPOINTMENT_ID} encounterId={ENCOUNTER_ID} />);
};

describe('EhrLinksButton', () => {
  it('links Visit Details to the EHR visit page in a new tab', () => {
    renderButton();

    const visitLink = screen.getByRole('link', { name: 'Visit Details' });
    expect(visitLink).toHaveAttribute('href', `${EHR_URL}/visit/${APPOINTMENT_ID}`);
    expect(visitLink).toHaveAttribute('target', '_blank');
    expect(visitLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('opens the arrow menu with an encounter-scoped Progress Note deep link', async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'More EHR links' }));

    const progressNote = screen.getByRole('menuitem', { name: 'Progress Note' });
    expect(progressNote).toHaveAttribute(
      'href',
      `${EHR_URL}/in-person/${APPOINTMENT_ID}/review-and-sign?encounterId=${ENCOUNTER_ID}`
    );
    expect(progressNote).toHaveAttribute('target', '_blank');
    expect(progressNote).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('closes the menu when a link is clicked', async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'More EHR links' }));
    await user.click(screen.getByRole('menuitem', { name: 'Progress Note' }));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});
