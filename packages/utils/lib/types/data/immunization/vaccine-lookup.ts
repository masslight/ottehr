import { CVX_VACCINES } from './cvx-vaccines.generated';
import { CvxVaccine } from './vaccine-codes';

/** The vaccine in the list with this CVX code. */
export const getCvxVaccine = (cvx: string | undefined): CvxVaccine | undefined =>
  cvx ? CVX_VACCINES.find((vaccine) => vaccine.cvx === cvx) : undefined;
