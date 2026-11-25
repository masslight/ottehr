import { defineStory } from '../../harness/story';
import { visitRoute } from './_fixtures';
import { medicationMocks, pendingOrder, quickPicks, renderCard, SOURCE } from './_medication';

export default defineStory({
  title: 'Save medication as Quick Pick (overwrite an existing one)',
  source: SOURCE,
  base: 'AppDialog',
  kind: 'form',
  where:
    'In-person visit → In-house Medications → order form → Quick Picks → "+ Add or Update Quick Pick" → pick an existing quick pick',
  ...visitRoute,
  mocks: medicationMocks(pendingOrder, ['Administrator', 'Provider']),
  render: () => renderCard(pendingOrder, 'order-edit'),
  play: async ({ user, screen, waitFor }) => {
    await user.click(await waitFor(() => screen.getByLabelText('Quick Picks'), { timeout: 15000 }));
    await user.click(await waitFor(() => screen.getByRole('menuitem', { name: /Add or Update Quick Pick/ })));
    await waitFor(() => screen.getByText('Or overwrite an existing quick pick:'), { timeout: 10000 });
    const dialog = document.querySelector('.MuiDialog-root') as HTMLElement;
    const target = Array.from(dialog.querySelectorAll<HTMLElement>('.MuiListItemButton-root')).find(
      (el) => el.textContent === quickPicks[0].name
    );
    if (!target) throw new Error('existing quick pick not listed');
    await user.click(target);
    await waitFor(() => screen.getByRole('button', { name: 'Overwrite' }));
  },
  notes:
    'Variant of EditableMedicationCard.quickPick: an existing quick pick is selected, so the primary button reads "Overwrite" and the name field takes its name.',
});
