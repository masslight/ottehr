import { defineStory } from '../../harness/story';
import { visitRoute } from './_fixtures';
import { medicationMocks, pendingOrder, renderCard, SOURCE } from './_medication';

const order = { ...pendingOrder, lotNumber: undefined, expDate: undefined };

export default defineStory({
  title: 'Missing Required Fields',
  source: SOURCE,
  base: 'InPersonModal',
  kind: 'info',
  where:
    'In-person visit → In-house Medications → open a pending order (dispense form) → Administered with required fields empty',
  ...visitRoute,
  mocks: medicationMocks(order),
  render: () => renderCard(order, 'dispense'),
  play: async ({ user, screen, waitFor }) => {
    const button = await waitFor(
      () => {
        const el = screen.getByRole('button', { name: 'Administered' });
        if ((el as HTMLButtonElement).disabled) throw new Error('button still disabled');
        return el;
      },
      { timeout: 15000 }
    );
    await user.click(button);
  },
  notes:
    'This dialog only exists as a validation result: the order is mocked without lot number / expiration date and Administered is clicked.',
});
