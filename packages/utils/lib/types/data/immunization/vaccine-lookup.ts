import { CVX_VACCINES } from './cvx-vaccines.generated';
import { MVX_MANUFACTURERS } from './mvx-manufacturers.generated';
import { CvxVaccine, MvxManufacturer } from './vaccine-codes';

/** The vaccine in the list with this CVX code. */
export const getCvxVaccine = (cvx: string | undefined): CvxVaccine | undefined =>
  cvx ? CVX_VACCINES.find((vaccine) => vaccine.cvx === cvx) : undefined;

/** The manufacturer in the list with this MVX code. */
export const getMvxManufacturer = (mvx: string | undefined): MvxManufacturer | undefined =>
  mvx ? MVX_MANUFACTURERS.find((manufacturer) => manufacturer.mvx === mvx) : undefined;
