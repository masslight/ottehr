import { enqueueSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import { getOrCreateVisitLabel } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
import { usePrintVisitLabel } from './usePrintVisitLabel';

interface UsePrintEncounterLabelOutput {
  printEncounterLabel: (encounterId: string) => Promise<void>;
  isPrinting: boolean;
  isError: boolean;
}

export const usePrintEncounterLabel = (): UsePrintEncounterLabelOutput => {
  const { oystehrZambda } = useApiClients();
  const { printVisitLabel } = usePrintVisitLabel();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isError, setIsError] = useState(false);

  const printEncounterLabel = useCallback(
    async (encounterId: string): Promise<void> => {
      setIsError(false);
      setIsPrinting(true);
      try {
        const labelPdfs = oystehrZambda
          ? await getOrCreateVisitLabel(oystehrZambda, { encounterId }).catch((error) => {
              safelyCaptureException(error);
              return [];
            })
          : [];
        const pdfPresignedUrl = labelPdfs.length === 1 ? labelPdfs[0]?.presignedURL : undefined;
        if (!pdfPresignedUrl) {
          console.error('Expected 1 label pdf, received unexpected number', JSON.stringify(labelPdfs));
          enqueueSnackbar('Could not create the label. Please try again.', { variant: 'error' });
          setIsError(true);
          return;
        }
        await printVisitLabel({ pdfPresignedUrl, encounterId }).catch((error) => {
          safelyCaptureException(error);
          enqueueSnackbar('Could not print the label. Please try again.', { variant: 'error' });
          setIsError(true);
        });
      } finally {
        setIsPrinting(false);
      }
    },
    [oystehrZambda, printVisitLabel]
  );

  return { printEncounterLabel, isPrinting, isError };
};
