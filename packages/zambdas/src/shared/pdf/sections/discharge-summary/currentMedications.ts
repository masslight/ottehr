import { createConfiguredSection } from '../../pdf-common';
import { MedicationsData, PdfSection } from '../../types';

export const createMedicationsSectionForDischargeSummary = <
  TData extends { medications?: MedicationsData },
>(): PdfSection<TData, MedicationsData> => {
  return createConfiguredSection(null, () => ({
    title: 'Current Medications',
    dataSelector: (data) => data.medications,
    shouldRender: (sectionData) => !!sectionData.medications?.length || !!sectionData.medicationsNotes?.length,
    render: (client, data, styles) => {
      const medications = data.medications?.join('; ');
      const notes = data.medicationsNotes?.length ? '; ' + data.medicationsNotes.join('; ') : '';
      const fullLine = medications + notes;
      client.drawText(fullLine, styles.textStyles.regular);

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
