import type { FetchMock } from '../../harness/story';

const content: Record<string, string> = {
  'J02.0':
    '## What is strep throat?\nStrep throat is an infection of the throat and tonsils caused by bacteria. It is common in school-age children and spreads easily.\n\n## Care at home\n- Take the antibiotic exactly as prescribed and finish every dose.\n- Drink plenty of fluids and rest.\n- Warm salt-water gargles or cold drinks can ease throat pain.\n\n## When to call\nCall us if the fever lasts more than 48 hours after starting antibiotics, or if swallowing becomes very difficult.',
  'R50.9':
    '## About fever\nA fever is the body’s normal response to infection. Most fevers are not harmful and go away in a few days.\n\n## Care at home\n- Offer fluids often.\n- Dress in light clothing.\n- Use acetaminophen or ibuprofen as directed for comfort.',
};

const sections = [
  { icdCode: 'J02.0', icdDescription: 'Streptococcal pharyngitis', patientTitle: 'Strep Throat' },
  { icdCode: 'R50.9', icdDescription: 'Fever, unspecified', patientTitle: 'Fever' },
];

/**
 * The SDK sends zambda calls as a Request object, so the harness mock cannot read the body to see
 * which diagnosis is being asked for. The card requests them in chart order (J02.0, then R50.9), so
 * the answers are handed out in that order instead.
 */
export const educationMocks = (): FetchMock[] => {
  let call = 0;
  return [
    { url: 'list-approved-patient-education', response: { status: 200, output: { items: [] } } },
    {
      url: 'generate-patient-education',
      response: () => {
        const section = sections[call++ % sections.length];
        return { status: 200, output: { ...section, content: content[section.icdCode], language: 'en' } };
      },
    },
  ];
};
