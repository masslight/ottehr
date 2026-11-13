import { defineStory } from '../../harness/story';
import { visitRoute } from './_fixtures';
import { medicationMocks, pendingOrder, renderCard, SOURCE } from './_medication';

const order = pendingOrder;

export default defineStory({
  title: 'Delete Medication (order form)',
  source: SOURCE,
  base: 'DeleteDialog',
  kind: 'destructive-confirm',
  where: 'In-person visit → In-house Medications → open a pending order (dispense form) → Delete Order',
  ...visitRoute,
  mocks: medicationMocks(order),
  render: () => renderCard(order, 'dispense'),
  play: async ({ user, screen, waitFor }) => {
    const button = await waitFor(
      () => {
        const el = screen.getByRole('button', { name: 'Delete Order' });
        if ((el as HTMLButtonElement).disabled) throw new Error('button still disabled');
        return el;
      },
      { timeout: 15000 }
    );
    await user.click(button);
  },
});
