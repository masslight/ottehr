import { defineStory } from '../../harness/story';
import { visitRoute } from './_fixtures';
import { medicationMocks, pendingOrder, renderCard, SOURCE } from './_medication';

const order = pendingOrder;

export default defineStory({
  title: 'Medication Not Administered (confirm + reason)',
  source: SOURCE,
  base: 'InPersonModal',
  kind: 'form',
  where: 'In-person visit → In-house Medications → open a pending order (dispense form) → Not Administered',
  ...visitRoute,
  mocks: medicationMocks(order),
  render: () => renderCard(order, 'dispense'),
  play: async ({ user, screen, waitFor }) => {
    const findButton = (): HTMLElement => {
      const el = screen.getByRole('button', { name: 'Not Administered' });
      if ((el as HTMLButtonElement).disabled) throw new Error('button still disabled');
      return el;
    };
    await waitFor(findButton, { timeout: 15000 });
    // The confirm text reads the patient name at click time: give the mocked visit a moment to load,
    // then look the button up again (the footer re-mounts on every render).
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await user.click(await waitFor(findButton, { timeout: 15000 }));
  },
  notes: 'Reason select left empty, so the confirm button is disabled (its initial state).',
});
