import { CVX_VACCINES } from './cvx-vaccines.generated';
import type { CvxVaccine } from './vaccine-codes';

export const findCvxVaccine = (cvx: string | undefined): CvxVaccine | undefined =>
  cvx ? CVX_VACCINES.find((vaccine) => vaccine.cvx === cvx) : undefined;
