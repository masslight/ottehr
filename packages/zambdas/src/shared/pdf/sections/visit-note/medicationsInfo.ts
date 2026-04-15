import { NOTE_TYPE } from 'utils';
import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { MedicationsData, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeMedications: DataComposer<{ allChartData: AllChartData }, MedicationsData> = ({ allChartData }) => {
  const { chartData, additionalChartData } = allChartData;
  const medications = chartData.medications
    ? chartData.medications
        .map((medication) => {
          const additionalInfo = [
            medication.intakeInfo.dose,
            medication.intakeInfo.patientCouldNotConfirmDosage ? 'Patient could not confirm dosage' : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return medication.name ? `${medication.name}${additionalInfo ? ` (${additionalInfo})` : ''}` : '';
        })
        .filter(Boolean)
    : [];
  const medicationsNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.INTAKE_MEDICATION)
    ?.map((note) => note.text);
  return {
    medications,
    medicationsNotes,
  };
};

export const createMedicationsSection = <TData extends { medications?: MedicationsData }>(): PdfSection<
  TData,
  MedicationsData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Medications',
    dataSelector: (data) => data.medications,
    shouldRender: (sectionData) => !!sectionData.medications?.length || !!sectionData.medicationsNotes?.length,
    render: (client, data, styles) => {
      if (data.medications?.length) {
        data.medications.forEach((medication) => {
          client.drawText(medication, styles.textStyles.regularText);
        });
      } else {
        client.drawText('No current medications', styles.textStyles.regularText);
      }

      if (data.medicationsNotes && data.medicationsNotes.length > 0) {
        drawBlockHeader(client, styles, 'Medications notes', styles.textStyles.blockSubHeader);
        data.medicationsNotes.forEach((record) => {
          drawRegularText(client, styles, record);
        });
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
