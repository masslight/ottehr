import { createConfiguredSection, DataComposer } from '../pdf-common';
import { OccupationalMedicineEmployerDataInput, OccupationalMedicineEmployerInfo, PdfSection } from '../types';

export const composeOccupationalMedicineEmployerData: DataComposer<
  OccupationalMedicineEmployerDataInput,
  OccupationalMedicineEmployerInfo
> = ({ employer }) => {
  const employerName = employer?.name ?? '';
  return { employerName };
};

export const createOccupationalMedicineEmployerSection = <
  TData extends { omEmployer?: OccupationalMedicineEmployerInfo },
>(): PdfSection<TData, OccupationalMedicineEmployerInfo> => {
  return createConfiguredSection('occupationalMedicineEmployerInformation', (shouldShow) => ({
    title: 'Employer - Occupational Medicine',
    dataSelector: (data) => data.omEmployer,
    shouldRender: (omEmployer) => !!omEmployer.employerName,
    render: (client, omEmployer, styles) => {
      if (shouldShow('occupational-medicine-employer')) {
        client.drawLabelValueRow(
          // Sentence case matches PATIENT_RECORD_CONFIG label
          // (`occupationalMedicineEmployerInformation.items.employerName.label`).
          'Employer name',
          omEmployer.employerName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            spacing: 16,
          }
        );
      }
    },
  }));
};
