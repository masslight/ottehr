import { createConfiguredSection } from '../../pdf-common';
import { AllergiesData, PdfSection } from '../../types';

export const createAllergiesSectionForDischargeSummary = <TData extends { allergies?: AllergiesData }>(): PdfSection<
  TData,
  AllergiesData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Known Allergies',
    dataSelector: (data) => data.allergies,
    shouldRender: (sectionData) => !!sectionData.allergies?.length || !!sectionData.allergiesNotes?.length,
    render: (client, data, styles) => {
      const allergies = data.allergies?.join('; ');
      const notes = data.allergiesNotes?.length ? '; ' + data.allergiesNotes.join('; ') : '';
      const fullLine = allergies + notes;
      client.drawText(fullLine, styles.textStyles.regular);

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
