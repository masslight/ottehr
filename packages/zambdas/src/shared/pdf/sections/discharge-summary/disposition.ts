import { followUpInOptions, getDefaultNote, mapDispositionTypeToLabel } from 'utils';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { DispositionData, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeDisposition: DataComposer<{ allChartData: AllChartData }, DispositionData> = ({ allChartData }) => {
  const { additionalChartData } = allChartData;
  const disposition = additionalChartData?.disposition;
  let label = '';
  let instruction = '';
  let followUpIn: string | undefined;
  let reason: string | undefined;
  let specialty: string | undefined;
  if (disposition?.type) {
    label = mapDispositionTypeToLabel[disposition.type];
    instruction = disposition.note || getDefaultNote(disposition.type);
    reason = disposition.reason;
    specialty = disposition.specialty;

    followUpIn = followUpInOptions.find((opt) => opt.value === disposition.followUpIn)?.label;
  }
  return { label, instruction, reason, followUpIn, specialty };
};

export const createDispositionSection = <TData extends { disposition?: DispositionData }>(): PdfSection<
  TData,
  DispositionData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Disposition',
    dataSelector: (data) => data.disposition,
    shouldRender: (sectionData) => !!(sectionData.instruction || sectionData.specialty),
    render: (client, data, styles) => {
      if (data.specialty) client.drawText(data.specialty, styles.textStyles.regular);
      if (data.instruction) client.drawText(data.instruction, styles.textStyles.regular);
      if (data.reason) client.drawText(`Reason for transfer: ${data.reason}`, styles.textStyles.regular);
      if (data.followUpIn) client.drawText(`Follow-up visit in ${data.followUpIn}`, styles.textStyles.regular);
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
