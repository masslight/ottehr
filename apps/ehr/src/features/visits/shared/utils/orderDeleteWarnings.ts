import { enqueueSnackbar } from 'notistack';

export interface OrderDeleteWarnings {
  retainedCptCodes?: string[];
  billingReviewRequired?: boolean;
}

export const enqueueOrderDeleteWarnings = (warnings: OrderDeleteWarnings | undefined): void => {
  if (warnings?.retainedCptCodes?.length) {
    enqueueSnackbar(
      `CPT codes matching this order remain on the visit and could not be safely removed: ${warnings.retainedCptCodes.join(
        ', '
      )}. Review them in Assessment.`,
      { variant: 'warning' }
    );
  }
  if (warnings?.billingReviewRequired) {
    enqueueSnackbar('This order may already have been included in billing. Review the billing record for this visit.', {
      variant: 'warning',
    });
  }
};
