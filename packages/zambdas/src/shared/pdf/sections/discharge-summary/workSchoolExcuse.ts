import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, WorkSchoolExcuseData } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeWorkSchoolExcuseSection: DataComposer<{ allChartData: AllChartData }, WorkSchoolExcuseData> = ({
  allChartData,
}) => {
  const { chartData } = allChartData;
  const workSchoolExcuse: { note: string }[] = [];
  const attachmentDocRefs: string[] = [];
  chartData.schoolWorkNotes?.forEach((ws) => {
    if (ws.id) attachmentDocRefs.push(ws.id);

    if (ws.type === 'school') workSchoolExcuse.push({ note: 'There was a school note generated' });
    else workSchoolExcuse.push({ note: 'There was a work note generated' });
  });
  return { workSchoolExcuse, attachmentDocRefs };
};

export const createWorkSchoolExcuseSection = <TData extends { workSchoolExcuse?: WorkSchoolExcuseData }>(): PdfSection<
  TData,
  WorkSchoolExcuseData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Work / School Excuse',
    dataSelector: (data) => data.workSchoolExcuse,
    shouldRender: (sectionData) => !!sectionData.workSchoolExcuse?.length,
    render: (client, data, styles) => {
      data.workSchoolExcuse?.forEach((doc) => {
        client.drawText(doc.note, styles.textStyles.regular);
      });

      client.drawText('Documents attached', styles.textStyles.attachmentTitle);
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
