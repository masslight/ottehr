import Oystehr from '@oystehr/sdk';
import { generateAndOpenPdf } from 'src/helpers/generatedPdf';
import { getRadiologyOrderPdf } from '../../api/api';

/** Generates the order-form PDF for a radiology order and opens it in a new browser tab. */
export const generateAndOpenRadiologyOrderForm = async (
  oystehrZambda: Oystehr,
  serviceRequestId: string
): Promise<void> => generateAndOpenPdf(() => getRadiologyOrderPdf(oystehrZambda, { serviceRequestId }));
