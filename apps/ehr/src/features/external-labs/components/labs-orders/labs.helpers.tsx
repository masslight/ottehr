import { DateTime } from 'luxon';
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

// todo: move to LabOrderDTO
export const getResultsReceivedDate = (labOrderData: LabOrderDTO): string => {
  if (labOrderData.status === 'received' || labOrderData.status === 'reviewed') {
    return formatDate(labOrderData.orderAdded);
  }
  return '';
};
