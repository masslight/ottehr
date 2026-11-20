import { CVX_VACCINES } from './cvx-vaccines.generated';
import { MVX_MANUFACTURERS } from './mvx-manufacturers.generated';
import { NDC_VACCINE_PRODUCTS } from './ndc-vaccines.generated';
import { CvxVaccine, MvxManufacturer, ndc11Candidates, NdcVaccineProduct } from './vaccine-codes';

export const getCvxVaccine = (cvx: string | undefined): CvxVaccine | undefined =>
  cvx ? CVX_VACCINES.find((vaccine) => vaccine.cvx === cvx) : undefined;

export const getMvxManufacturer = (mvx: string | undefined): MvxManufacturer | undefined =>
  mvx ? MVX_MANUFACTURERS.find((manufacturer) => manufacturer.mvx === mvx) : undefined;

/** The CDC crosswalk row for a box's NDC (sale or unit-of-use, in any of the usual spellings). */
export const findNdcVaccineProduct = (ndc: string): NdcVaccineProduct | undefined => {
  const candidates = ndc11Candidates(ndc);
  return NDC_VACCINE_PRODUCTS.find(
    (product) => candidates.includes(product.saleNdc) || (product.useNdc ? candidates.includes(product.useNdc) : false)
  );
};
