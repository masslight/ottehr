import { NOTE_TYPE } from 'utils';
import { mapMedicalConditions } from '../../helpers/mappers';
import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { MedicalConditionsData, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeMedicalConditions: DataComposer<{ allChartData: AllChartData }, MedicalConditionsData> = ({
  allChartData,
}) => {
  const { chartData, additionalChartData } = allChartData;
  const medicalConditions = mapMedicalConditions(chartData);
  const medicalConditionsNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.MEDICAL_CONDITION)
    ?.map((note) => note.text);

  return {
    medicalConditions,
    medicalConditionsNotes,
  };
};

export const createMedicalConditionsSection = <
  TData extends { medicalConditions?: MedicalConditionsData },
>(): PdfSection<TData, MedicalConditionsData> => {
  return createConfiguredSection(null, () => ({
    title: 'Medical Conditions',
    dataSelector: (data) => data.medicalConditions,
    shouldRender: (sectionData) =>
      !!sectionData.medicalConditions?.length || !!sectionData.medicalConditionsNotes?.length,
    render: (client, data, styles) => {
      if (data.medicalConditions?.length) {
        data.medicalConditions.forEach((medicalCondition) => {
          client.drawText(medicalCondition, styles.textStyles.regularText);
        });
      } else {
        client.drawText('No known medical conditions', styles.textStyles.regularText);
      }

      if (data.medicalConditionsNotes && data.medicalConditionsNotes.length > 0) {
        drawBlockHeader(client, styles, 'Medical conditions notes', styles.textStyles.blockSubHeader);
        data.medicalConditionsNotes.forEach((record) => {
          drawRegularText(client, styles, record);
        });
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
