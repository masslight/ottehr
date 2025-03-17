import { DateTime } from 'luxon';
import { DiagnosisDTO } from 'utils';
import { LabOrderDTO } from 'utils/lib/types/data/labs/labs.types';

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';

  try {
    const date = DateTime.fromISO(dateString);
    if (!date.isValid) {
      console.error('Invalid date:', dateString);
      return '';
    }
    return date.toFormat('MM/dd/yyyy hh:mm a');
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

export const getFullDiagnosesText = (diagnoses: DiagnosisDTO[]): string => {
  if (!diagnoses || !Array.isArray(diagnoses) || diagnoses.length <= 1) return '';

  return diagnoses
    .map((dx) => {
      const display = dx.display || '';
      const code = dx.code || '';
      return `${code} ${display}`;
    })
    .join('\n');
};

export const getFormattedDiagnoses = (diagnoses: DiagnosisDTO[]): React.ReactNode => {
  if (!diagnoses || diagnoses.length === 0) {
    return '';
  }

  if (diagnoses.length === 1) {
    return `${diagnoses[0].code} ${diagnoses[0].display || ''}`;
  }

  return (
    <>
      {diagnoses[0].code} <span style={{ color: 'gray' }}>{diagnoses.length - 1} more</span>
    </>
  );
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return '#E0E0E0';
    case 'received':
      return '#90CAF9';
    case 'prelim':
      return '#A5D6A7';
    case 'sent':
      return '#CE93D8';
    case 'reviewed':
      return '#81C784';
    default:
      return '#E0E0E0';
  }
};

export const getVisitDate = (labOrderData: LabOrderDTO): string => {
  return formatDate(labOrderData.orderAdded);
};

export const getResultsReceivedDate = (labOrderData: LabOrderDTO): string => {
  if (labOrderData.status === 'received' || labOrderData.status === 'reviewed') {
    return formatDate(labOrderData.orderAdded);
  }
  return '';
};

export const getAccessionNumber = (labOrderData: LabOrderDTO): string => {
  // todo: implement logic for getting accession number
  return labOrderData.id ? `mock: DL4523H${labOrderData.id.slice(0, 3)}` : '';
};
