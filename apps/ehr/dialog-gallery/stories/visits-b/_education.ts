import type { FetchMock } from '../../harness/story';

const content: Record<string, string> = {
  'J02.0':
    '## What is strep throat?\nStrep throat is an infection of the throat and tonsils caused by bacteria. It is common in school-age children and spreads easily.\n\n## Care at home\n- Take the antibiotic exactly as prescribed and finish every dose.\n- Drink plenty of fluids and rest.\n- Warm salt-water gargles or cold drinks can ease throat pain.\n\n## When to call\nCall us if the fever lasts more than 48 hours after starting antibiotics, or if swallowing becomes very difficult.',
  'R50.9':
    '## About fever\nA fever is the body’s normal response to infection. Most fevers are not harmful and go away in a few days.\n\n## Care at home\n- Offer fluids often.\n- Dress in light clothing.\n- Use acetaminophen or ibuprofen as directed for comfort.',
};

export const educationMocks: FetchMock[] = [
  { url: 'list-approved-patient-education', response: { status: 200, output: { items: [] } } },
  {
    url: 'generate-patient-education',
    response: ({ body }: { body: any }) => ({
      status: 200,
      output: {
        content: content[body?.icdCode] ?? 'General care information.',
        patientTitle: body?.icdCode === 'J02.0' ? 'Strep Throat' : 'Fever',
        icdCode: body?.icdCode,
        icdDescription: body?.icdDescription,
        language: body?.language ?? 'en',
      },
    }),
  },
];
