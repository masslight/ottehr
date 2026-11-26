import { enqueueSnackbar } from 'notistack';
import { useCallback } from 'react';
import { generateAndOpenPdf, reserveTab } from 'src/helpers/generatedPdf';
import { useApiClients } from 'src/hooks/useAppClients';
import { getReferralPdf } from './referrals.api';

const PRINT_ERROR = 'Failed to open the referral form. Please try again.';
const POPUP_BLOCKED = 'Your browser blocked the referral form. Allow pop-ups for this site and try again.';

export type PrintReferralForm = (referral: string | (() => Promise<string | undefined>)) => Promise<void>;

export const usePrintReferralForm = (): PrintReferralForm => {
  const { oystehrZambda } = useApiClients();

  return useCallback(
    async (referral) => {
      const tab = reserveTab();
      try {
        const referralId = typeof referral === 'string' ? referral : await referral();
        if (!referralId || !oystehrZambda) {
          tab?.close();
          return;
        }
        if (!tab) {
          enqueueSnackbar(POPUP_BLOCKED, { variant: 'error' });
          return;
        }
        await generateAndOpenPdf(() => getReferralPdf(oystehrZambda, { referralId }), tab);
      } catch (error) {
        tab?.close();
        console.error(error);
        enqueueSnackbar(PRINT_ERROR, { variant: 'error' });
      }
    },
    [oystehrZambda]
  );
};
