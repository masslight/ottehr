import { ApprovedPatientEducationDialog } from 'src/features/admin/patient-education/ApprovedPatientEducationDialog';
import { defineStory } from '../../harness/story';
import { icdMocks } from './_icd';

const content = `# Sore throat (pharyngitis)

## What it is
A sore throat is pain or irritation in the throat that often gets worse when you swallow. Most sore throats are caused by a virus and get better on their own within a week.

## What you can do at home
- Drink plenty of fluids and rest
- Gargle with warm salt water
- Use acetaminophen or ibuprofen for pain or fever

## When to get help
- Trouble breathing or swallowing
- Fever above 101°F (38.3°C) lasting more than two days
- Symptoms that do not improve after one week`;

export default defineStory({
  title: 'New approved patient education (step 2: review generated content)',
  source: 'apps/ehr/src/features/admin/patient-education/ApprovedPatientEducationDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Patient Education → "New" → pick diagnosis → "Generate"',
  mocks: [
    {
      url: 'generate-patient-education',
      response: {
        status: 200,
        output: {
          content,
          patientTitle: 'Sore throat',
          icdCode: 'J02.9',
          icdDescription: 'Acute pharyngitis, unspecified',
          language: 'en',
        },
      },
    },
    ...icdMocks,
  ],
  render: () => <ApprovedPatientEducationDialog open onClose={() => undefined} />,
  play: async ({ user, screen }) => {
    await user.type(await screen.findByLabelText(/Diagnosis/), 'pharyng');
    await user.click(await screen.findByText(/J02\.9/, undefined, { timeout: 8000 }));
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    await screen.findByText('Review Patient Education', undefined, { timeout: 8000 });
  },
  notes: 'Same dialog as step 1 after "Generate"; ICD search and the AI generation zambda are mocked.',
});
