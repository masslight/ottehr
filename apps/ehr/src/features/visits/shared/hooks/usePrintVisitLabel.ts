import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { OnDemandLabelXmlRequestOutput } from 'utils';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
import { useGetLabelXmlAndPrintingConfig } from './useGetLabelXmlAndPrintingConfig';
import { usePrintLabel } from './usePrintLabel';

interface PrintVisitLabelInput {
  pdfPresignedUrl: string;
  encounterId: string;
}

interface UsePrintVisitLabelOutput {
  printVisitLabel: (input: PrintVisitLabelInput) => Promise<void>;
}

/**
 * For use printing visit labels. Takes the encounter id, and the presignedPdfUrl which is used to print via pdf if necessary (or elected).
 * Determine the printingConfig. If manual mode, opens the pdf
 * XML label content is made on demand to account for changes to the printingConfig
 * @param
 * @returns
 */
export const usePrintVisitLabel = (): UsePrintVisitLabelOutput => {
  // const [errorState, setErrorState] = useState<>

  const getLabelXmlAndPrintingConfig = useGetLabelXmlAndPrintingConfig();

  // this now needs to spit out a function that takes the config itself
  const { printLabelByConfig } = usePrintLabel();

  const printVisitLabel = useCallback(
    async (input: PrintVisitLabelInput): Promise<void> => {
      const { pdfPresignedUrl, encounterId } = input;
      let data: OnDemandLabelXmlRequestOutput;
      try {
        data = await getLabelXmlAndPrintingConfig({ type: 'visit', encounterId });
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

  return { printVisitLabel };
};
