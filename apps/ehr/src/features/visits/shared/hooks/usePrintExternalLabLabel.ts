import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { OnDemandLabelXmlRequestOutput } from 'utils';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
import { useGetLabelXmlAndPrintingConfig } from './useGetLabelXmlAndPrintingConfig';
import { usePrintLabel } from './usePrintLabel';

interface PrintExternalLabLabelInput {
  pdfPresignedUrl: string;
  serviceRequestId: string;
  userTimezone: string;
}

interface UseExternalLabLabelOutput {
  printExternalLabLabel: (input: PrintExternalLabLabelInput) => Promise<void>;
}

/**
 * For use printing external lab labels. Takes the service id, and the presignedPdfUrl which is used to print via pdf if necessary (or elected).
 * Determine the printingConfig. If manual mode, opens the pdf
 * XML label content is made on demand to account for changes to the printingConfig
 * @param
 * @returns
 */
export const usePrintExternalLabLabel = (): UseExternalLabLabelOutput => {
  const getLabelXmlAndPrintingConfig = useGetLabelXmlAndPrintingConfig();

  const { printLabelByConfig } = usePrintLabel();

  const printExternalLabLabel = useCallback(
    async (input: PrintExternalLabLabelInput): Promise<void> => {
      const { pdfPresignedUrl, serviceRequestId, userTimezone } = input;
      let data: OnDemandLabelXmlRequestOutput;
      try {
        data = await getLabelXmlAndPrintingConfig({ type: 'external-lab', serviceRequestId, userTimezone });
      } catch (error) {
        enqueueSnackbar('Failed to fetch label config', { variant: 'error' });
        safelyCaptureException(error);
        return;
      }

      const { labelXmlString, printingConfig } = data;

      await printLabelByConfig({ printingConfig, pdfPresignedUrl, labelXmlString });
    },
    [printLabelByConfig, getLabelXmlAndPrintingConfig]
  );

  return { printExternalLabLabel };
};
