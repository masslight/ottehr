import Oystehr from '@oystehr/sdk';
import { Location } from 'fhir/r4b';
import { chooseJson } from 'utils';

const GET_PAYMENT_LOCATIONS_ZAMBDA_ID = 'get-payment-locations';
const GET_STRIPE_ACCOUNT_INFO_ZAMBDA_ID = 'get-stripe-account-info';
const GET_TERMINAL_READERS_ZAMBDA_ID = 'get-terminal-readers';
const SAVE_TERMINAL_LOCATION_ZAMBDA_ID = 'save-terminal-location';

export interface PaymentLocation {
  location: Location;
  supportsVirtualVisits: boolean;
}

export interface GetPaymentLocationsResponse {
  locations: PaymentLocation[];
}

export interface StripeAccountInfo {
  businessName: string | null;
  dbaName: string | null;
  taxId: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
}

export interface StripeTerminalLocationInfo {
  id: string;
  displayName: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
}

export interface GetStripeAccountInfoResponse {
  accountInfo: StripeAccountInfo | null;
  terminalLocations: StripeTerminalLocationInfo[];
  error: string | null;
}

export interface TerminalReaderInfo {
  id: string;
  label: string | null;
  deviceType: string;
  status: string | null;
  serialNumber: string | null;
  ipAddress: string | null;
  deviceSwVersion: string | null;
}

export interface GetTerminalReadersResponse {
  readers: TerminalReaderInfo[];
  error: string | null;
}

export const getPaymentLocations = async (oystehr: Oystehr): Promise<GetPaymentLocationsResponse> => {
  try {
    if (GET_PAYMENT_LOCATIONS_ZAMBDA_ID == null) {
      throw new Error('get-payment-locations zambda ID could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_PAYMENT_LOCATIONS_ZAMBDA_ID,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getStripeAccountInfo = async (
  oystehr: Oystehr,
  stripeAccountId: string
): Promise<GetStripeAccountInfoResponse> => {
  try {
    if (GET_STRIPE_ACCOUNT_INFO_ZAMBDA_ID == null) {
      throw new Error('get-stripe-account-info zambda ID could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_STRIPE_ACCOUNT_INFO_ZAMBDA_ID,
      stripeAccountId,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const saveTerminalLocation = async (
  oystehr: Oystehr,
  locationId: string,
  terminalLocationId: string | null
): Promise<{ success: boolean }> => {
  try {
    if (SAVE_TERMINAL_LOCATION_ZAMBDA_ID == null) {
      throw new Error('save-terminal-location zambda ID could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: SAVE_TERMINAL_LOCATION_ZAMBDA_ID,
      locationId,
      terminalLocationId,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const getTerminalReaders = async (
  oystehr: Oystehr,
  stripeAccountId: string,
  terminalLocationId: string
): Promise<GetTerminalReadersResponse> => {
  try {
    if (GET_TERMINAL_READERS_ZAMBDA_ID == null) {
      throw new Error('get-terminal-readers zambda ID could not be loaded');
    }

    const response = await oystehr.zambda.execute({
      id: GET_TERMINAL_READERS_ZAMBDA_ID,
      stripeAccountId,
      terminalLocationId,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};
