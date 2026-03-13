import { createMedicationString, isDeletedMedicationOrder, NOTE_TYPE } from 'utils';
import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { InHouseMedicationsData, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeInHouseMedications: DataComposer<{ allChartData: AllChartData }, InHouseMedicationsData> = ({
  allChartData,
}) => {
  const { additionalChartData, medicationOrders } = allChartData;
  const inHouseMedications =
    medicationOrders
      ?.filter((order) => !isDeletedMedicationOrder(order))
      .map((order) => createMedicationString(order)) ?? [];
  const inHouseMedicationsNotes =
    additionalChartData?.notes?.filter((note) => note.type === NOTE_TYPE.MEDICATION)?.map((note) => note.text) ?? [];

  return {
    inHouseMedications,
    inHouseMedicationsNotes,
  };
};

export const createInHouseMedicationsSection = <
  TData extends { inHouseMedications?: InHouseMedicationsData },
>(): PdfSection<TData, InHouseMedicationsData> => {
  return createConfiguredSection(null, () => ({
    title: 'In-House Medications',
    dataSelector: (data) => data.inHouseMedications,
    shouldRender: (sectionData) =>
      !!sectionData.inHouseMedications?.length || !!sectionData.inHouseMedicationsNotes?.length,
    render: (client, data, styles) => {
      if (data.inHouseMedications?.length) {
        data.inHouseMedications.forEach((record) => {
          drawRegularText(client, styles, record);
        });
      } else {
        drawRegularText(client, styles, 'No in-house medications');
      }

      if (data.inHouseMedicationsNotes && data.inHouseMedicationsNotes.length > 0) {
        drawBlockHeader(client, styles, 'In-House Medications notes', styles.textStyles.blockSubHeader);
        data.inHouseMedicationsNotes.forEach((record) => {
          drawRegularText(client, styles, record);
        });
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
