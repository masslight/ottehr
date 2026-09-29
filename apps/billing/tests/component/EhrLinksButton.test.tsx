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

  it('opens the arrow menu with encounter-scoped Assessment and HPI&MOI deep links', async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'More EHR links' }));

    const assessment = screen.getByRole('menuitem', { name: 'Assessment' });
    expect(assessment).toHaveAttribute(
      'href',
      `${EHR_URL}/in-person/${APPOINTMENT_ID}/assessment?encounterId=${ENCOUNTER_ID}`
    );
    const hpiMoi = screen.getByRole('menuitem', { name: 'HPI&MOI' });
    expect(hpiMoi).toHaveAttribute(
      'href',
      `${EHR_URL}/in-person/${APPOINTMENT_ID}/history-of-present-illness-and-templates?encounterId=${ENCOUNTER_ID}`
    );
    for (const item of [assessment, hpiMoi]) {
      expect(item).toHaveAttribute('target', '_blank');
      expect(item).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('closes the menu when a link is clicked', async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'More EHR links' }));
    await user.click(screen.getByRole('menuitem', { name: 'Assessment' }));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});
