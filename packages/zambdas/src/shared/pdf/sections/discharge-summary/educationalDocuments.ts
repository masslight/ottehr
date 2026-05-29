import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EducationDocumentsData, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeEducationalDocuments: DataComposer<{ allChartData: AllChartData }, EducationDocumentsData> = ({
  allChartData,
}) => {
  const { chartData } = allChartData;
  const documents: { title: string }[] = [];
  chartData?.instructions?.forEach((item) => {
    if (item.educationDocRefId && item.title) {
      documents.push({ title: item.title });
    }
  });
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
