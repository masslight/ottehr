import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EducationDocumentsData, PdfSection } from '../../types';

export const composeEducationalDocuments: DataComposer<null, EducationDocumentsData> = () => {
  const documents: { title: string }[] = [];
  return { documents };
};

export const createEducationalDocumentsSection = <
  TData extends { educationDocuments?: EducationDocumentsData },
>(): PdfSection<TData, EducationDocumentsData> => {
  return createConfiguredSection(null, () => ({
    title: 'General patient education documents',
    dataSelector: (data) => data.educationDocuments,
    shouldRender: (sectionData) => !!sectionData.documents?.length,
    render: (client, data, styles) => {
      data.documents?.forEach((doc) => {
        client.drawText(doc.title, styles.textStyles.regular);
      });
      client.drawText('Documents attached', styles.textStyles.attachmentTitle);
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
