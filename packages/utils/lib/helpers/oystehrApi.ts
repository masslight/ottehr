import Oystehr, { ZambdaExecuteResult } from '@oystehr/sdk';
import { APIError, isApiError } from '../types';

export const getOystehrApiHelpers = <T extends Record<string, string>>(
  oystehr: Oystehr,
  ZambdaNames: T,
  zambdasToIdsMap: Record<keyof typeof ZambdaNames, string | undefined>,
  zambdasPublicityMap: Record<keyof typeof ZambdaNames, boolean>,
  isAppLocalProvided: boolean
): {
  verifyZambdaProvidedAndNotLocalThrowErrorOtherwise: (
    zambdaID: string | undefined,
    zambdaName: keyof typeof zambdasToIdsMap
  ) => zambdaID is Exclude<typeof zambdaID, undefined>;
  chooseJson: (json: any) => any;
  makeZapRequest: <TResponse, TPayload>(
    zambdaName: keyof typeof ZambdaNames,
    payload?: TPayload,
    additionalErrorHandler?: (error: unknown) => void
  ) => Promise<TResponse>;
} => {
  const verifyZambdaProvidedAndNotLocalThrowErrorOtherwise = (
    zambdaID: string | undefined,
    zambdaName: keyof typeof zambdasToIdsMap
  ): zambdaID is Exclude<typeof zambdaID, undefined> => {
    if (zambdaID === undefined || !isAppLocalProvided) {
      throw new Error(`${String(zambdaName)} zambda environment variable could not be loaded`);
    }
    return true;
  };

  const makeZapRequest = async <TResponse, TPayload>(
    zambdaName: keyof typeof ZambdaNames,
    payload?: TPayload,
    additionalErrorHandler?: (error: unknown) => void
  ): Promise<TResponse> => {
    const zambdaId = zambdasToIdsMap[zambdaName];

    try {
      if (verifyZambdaProvidedAndNotLocalThrowErrorOtherwise(zambdaId, zambdaName)) {
        let zambdaPromise: Promise<ZambdaExecuteResult>;

        if (zambdasPublicityMap[zambdaName]) {
          zambdaPromise = oystehr.zambda.executePublic({ id: zambdaId, ...payload });
        } else {
          zambdaPromise = oystehr.zambda.execute({ id: zambdaId, ...payload });
        }

        const response = await zambdaPromise;

        const jsonToUse = chooseJson(response);
        return jsonToUse;
      }
      // won't be reached, but for TS to give the right return type
      throw Error();
    } catch (error) {
      additionalErrorHandler && additionalErrorHandler(error);
      throw apiErrorToThrow(error);
    }
  };

  return { verifyZambdaProvidedAndNotLocalThrowErrorOtherwise, chooseJson, makeZapRequest };
};

export const InternalError: APIError = {
  message: 'Internal Service Error',
};

export const apiErrorToThrow = (error: any): APIError => {
  console.error(`Top level catch block:\nError: ${error}\nError stringified: ${JSON.stringify(error)}`);
  if (isApiError(error)) {
    return error;
  } else {
    console.error('An endpoint threw and did not provide a well formed ApiError');
    return InternalError;
  }
};

export function NotFoundAppointmentErrorHandler(error: any): void {
  if (error.message === 'Appointment is not found') {
    throw error;
  }
}

// todo: update types in places that use this and remove the any
export const chooseJson = <T = any>(json: any): T => {
  return json.output;
};
