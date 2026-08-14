import Oystehr from '@oystehr/sdk';
import { getRadiologyOrderPdf } from '../../api/api';

/** Generates the order-form PDF for a radiology order and opens it in a new browser tab. */
export const generateAndOpenRadiologyOrderForm = async (
  oystehrZambda: Oystehr,
  serviceRequestId: string
): Promise<void> => {
  const { presignedURL } = await getRadiologyOrderPdf(oystehrZambda, { serviceRequestId });

  try {
    const response = await fetch(presignedURL, { method: 'GET', headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) {
      throw new Error(`fetching the order form failed with status ${response.status}`);
    }
    const blob = await response.blob();
    window.open(window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })), '_blank');
  } catch (error) {
    console.warn('Opening the radiology order form as a blob failed; opening the URL directly', error);
    window.open(presignedURL, '_blank');
  }
};
