import Oystehr from '@oystehr/sdk';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  GetReferralPdfInput,
  GetReferralPdfOutput,
  ListReferralsInput,
  ListReferralsOutput,
  SaveReferralInput,
  SaveReferralOutput,
  UpdateReferralStatusInput,
  UpdateReferralStatusOutput,
} from 'utils/lib/types/api/referrals/referrals.types';

const SAVE_REFERRAL_ZAMBDA_ID = 'save-referral';
const LIST_REFERRALS_ZAMBDA_ID = 'list-referrals';
const UPDATE_REFERRAL_STATUS_ZAMBDA_ID = 'update-referral-status';
const GET_REFERRAL_PDF_ZAMBDA_ID = 'get-referral-pdf';

export const saveReferral = async (oystehr: Oystehr, parameters: SaveReferralInput): Promise<SaveReferralOutput> => {
  const response = await oystehr.zambda.execute({ id: SAVE_REFERRAL_ZAMBDA_ID, ...parameters });
  return chooseJson(response);
};

export const listReferrals = async (oystehr: Oystehr, parameters: ListReferralsInput): Promise<ListReferralsOutput> => {
  const response = await oystehr.zambda.execute({ id: LIST_REFERRALS_ZAMBDA_ID, ...parameters });
  return chooseJson(response);
};

export const updateReferralStatus = async (
  oystehr: Oystehr,
  parameters: UpdateReferralStatusInput
): Promise<UpdateReferralStatusOutput> => {
  const response = await oystehr.zambda.execute({ id: UPDATE_REFERRAL_STATUS_ZAMBDA_ID, ...parameters });
  return chooseJson(response);
};

export const getReferralPdf = async (
  oystehr: Oystehr,
  parameters: GetReferralPdfInput
): Promise<GetReferralPdfOutput> => {
  const response = await oystehr.zambda.execute({ id: GET_REFERRAL_PDF_ZAMBDA_ID, ...parameters });
  return chooseJson(response);
};
