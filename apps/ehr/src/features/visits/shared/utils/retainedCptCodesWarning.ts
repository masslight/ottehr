import { enqueueSnackbar } from 'notistack';

export const enqueueRetainedCptCodesWarning = (retainedCptCodes: string[] | undefined): void => {
  if (!retainedCptCodes?.length) return;
  enqueueSnackbar(
    `CPT codes matching this order remain on the visit and could not be safely removed: ${retainedCptCodes.join(
      ', '
    )}. Review them in Assessment.`,
    { variant: 'warning' }
  );
};
