import { NOTE_TYPE } from 'utils';
import { mapResourceByNameField } from '../../helpers/mappers';
import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { AllergiesData, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeAllergies: DataComposer<{ allChartData: AllChartData }, AllergiesData> = ({ allChartData }) => {
  const { chartData, additionalChartData } = allChartData;
  const allergies = chartData.allergies
    ? mapResourceByNameField(chartData?.allergies?.filter((allergy) => allergy.current === true))
    : [];
  const allergiesNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.ALLERGY)
    ?.map((note) => note.text);
  return {
    allergies,
    allergiesNotes,
  };
};

export const createAllergiesSection = <TData extends { allergies?: AllergiesData }>(): PdfSection<
  TData,
  AllergiesData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Allergies',
    dataSelector: (data) => data.allergies,
    shouldRender: (sectionData) => !!sectionData.allergies?.length || !!sectionData.allergiesNotes?.length,
    render: (client, data, styles) => {
      if (data.allergies?.length) {
        data.allergies.forEach((allergy) => {
          client.drawText(allergy, styles.textStyles.regularText);
        });
      } else {
        client.drawText('No known allergies', styles.textStyles.regularText);
      }
      if (data.allergiesNotes && data.allergiesNotes.length > 0) {
        drawBlockHeader(client, styles, 'Allergies notes', styles.textStyles.blockSubHeader);
        data.allergiesNotes.forEach((record) => {
          drawRegularText(client, styles, record);
        });
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
