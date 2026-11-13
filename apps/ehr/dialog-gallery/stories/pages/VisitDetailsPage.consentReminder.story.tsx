import VisitDetailsPage from 'src/pages/VisitDetailsPage';
import { defineStory } from '../../harness/story';
import { VISIT_NOTES, VISIT_ROUTE, VISIT_ROUTE_PATH, visitDetailsMocks } from './_visitDetails';

export default defineStory({
  title: 'Consent not signed — reminder before saving patient record',
  source: 'apps/ehr/src/pages/VisitDetailsPage.tsx',
  base: 'CustomDialog',
  kind: 'confirm',
  where: 'Visit details page → "About this patient" → any Save / Save All while consent is neither signed nor attested',
  route: VISIT_ROUTE,
  routePath: VISIT_ROUTE_PATH,
  mocks: visitDetailsMocks,
  render: () => <VisitDetailsPage />,
  play: async ({ user, screen, waitFor }) => {
    const middleName = await waitFor(
      () => {
        const el = document.querySelector<HTMLInputElement>('input[name="patient-middle-name"]');
        if (!el) throw new Error('patient record form not rendered yet');
        return el;
      },
      { timeout: 20000 }
    );
    // Let the consent-files query settle so the page knows consent is unsigned.
    await new Promise((r) => setTimeout(r, 1500));
    // Edit one field so the section has something to save, then use that section's own Save button.
    await user.type(middleName, 'A');
    const section = middleName.closest('.MuiPaper-root') as HTMLElement;
    const save = Array.from(section.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Save');
    if (!save) throw new Error('section Save button not found');
    await user.click(save);
    await screen.findByTestId('consent-reminder-dialog', {}, { timeout: 5000 });
  },
  notes: `${VISIT_NOTES} A middle name is typed into "Patient summary" and that section's Save is clicked to raise the reminder.`,
});
