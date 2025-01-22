export const getNewOrderUrl = (encounterId: string): string => {
  return `/in-person/${encounterId}/in-house-medication/order/new`;
};

export const getEditOrderUrl = (encounterId: string, orderId: string): string => {
  return `/in-person/${encounterId}/in-house-medication/order/edit/${orderId}`;
};

export const getInHouseMedicationMARUrl = (encounterId: string): string => {
  return `/in-person/${encounterId}/in-house-medication/mar`;
};

export const getInHouseMedicationDetailsUrl = (encounterId: string): string => {
  return `/in-person/${encounterId}/in-house-medication/medication-details`;
};

export const getAssessmentUrl = (encounterId: string): string => {
  return `/in-person/${encounterId}/assessment`;
};
