import {
  followUpInOptions,
  getDefaultNote,
  mapDispositionTypeToLabel,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  NOTHING_TO_EAT_OR_DRINK_LABEL,
  REFUSAL_OF_EMS_TRANSPORT_FIELD,
  REFUSAL_OF_EMS_TRANSPORT_LABEL,
} from 'utils';
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
  if (disposition?.type) {
    label = mapDispositionTypeToLabel[disposition.type];
    instruction = disposition.note || getDefaultNote(disposition.type);
    reason = disposition.reason;

    followUpIn = followUpInOptions.find((opt) => opt.value === disposition.followUpIn)?.label;
  }
  const labService = disposition?.labService?.join(', ') || undefined;
  const virusTest = disposition?.virusTest?.join(', ') || undefined;
  return {
    label,
    instruction,
    reason,
    followUpIn,
    [NOTHING_TO_EAT_OR_DRINK_FIELD]: disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD],
    [REFUSAL_OF_EMS_TRANSPORT_FIELD]: disposition?.[REFUSAL_OF_EMS_TRANSPORT_FIELD],
    labService,
    virusTest,
  };
};

const hasDisposition = (data: DispositionData): boolean =>
  !!(
    data.instruction ||
    data[NOTHING_TO_EAT_OR_DRINK_FIELD] ||
    data[REFUSAL_OF_EMS_TRANSPORT_FIELD] ||
    data.labService ||
    data.virusTest ||
    data.followUpIn ||
    data.reason
  );

export const createDispositionSection = <TData extends { disposition?: DispositionData }>(): PdfSection<
  TData,
  DispositionData
> => {
  return createConfiguredSection(null, () => ({
    title: (data) => (data.label ? `Disposition - ${data.label}` : 'Disposition'),
    dataSelector: (data) => data.disposition,
    shouldRender: hasDisposition,
    render: (client, data, styles) => {
      if (data.instruction) {
        client.drawText(data.instruction, styles.textStyles.regular);
      }
      if (data[NOTHING_TO_EAT_OR_DRINK_FIELD]) {
        client.drawText(NOTHING_TO_EAT_OR_DRINK_LABEL, styles.textStyles.regular);
      }
      if (data[REFUSAL_OF_EMS_TRANSPORT_FIELD]) {
        client.drawText(REFUSAL_OF_EMS_TRANSPORT_LABEL, styles.textStyles.regular);
      }
      if (data.labService) {
        client.drawText(`Lab Services: ${data.labService}`, styles.textStyles.regular);
      }
      if (data.virusTest) {
        client.drawText(`Virus Tests: ${data.virusTest}`, styles.textStyles.regular);
      }
      if (data.followUpIn) {
        client.drawText(`Follow-up visit in ${data.followUpIn}`, styles.textStyles.regular);
      }
      if (data.reason) {
        client.drawText(`Reason for transfer: ${data.reason}`, styles.textStyles.regular);
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
