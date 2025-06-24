import Oystehr from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, CoverageEligibilityRequest } from 'fhir/r4b';
import {
  createOystehrClient,
  ELIGIBILITY_FAILED_REASON_META_TAG,
  ELIGIBILITY_FAILED_REASONS,
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  InsuranceCheckStatusWithDate,
  InsuranceEligibilityCheckStatus,
  PRIVATE_EXTENSION_BASE_URL,
  SecretsKeys,
} from 'utils';
import { getAuth0Token, lambdaResponse, topLevelCatch, ZambdaInput } from '../../shared';
import { getPayorRef, makeCoverageEligibilityRequest, parseEligibilityCheckResponsePromiseResult } from './helpers';
import { prevalidationHandler } from './prevalidation-handler';
import { complexInsuranceValidation, validateRequestParameters } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let primary: InsuranceCheckStatusWithDate | undefined;
  let secondary: InsuranceCheckStatusWithDate | undefined;
  try {
    console.group('validateRequestParameters');
    let validatedParameters: ReturnType<typeof validateRequestParameters>;
    try {
      validatedParameters = validateRequestParameters(input);
    } catch (error: any) {
      console.error(error);
      return lambdaResponse(400, { message: error.message });
    }
    const validatedParams = validatedParameters;
    const { secrets } = validatedParams;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    console.log('validatedParameters', JSON.stringify(validatedParameters));

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    console.group('createOystehrClient');
    const apiUrl = getSecret(SecretsKeys.PROJECT_API, secrets);
    const oystehr = createOystehrClient(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );
    console.groupEnd();
    console.debug('createOystehrClient success');

    const complexInput = await complexInsuranceValidation(validatedParams, oystehr);

    if (complexInput.type === 'prevalidation') {
      console.log('prevalidation path...');
      const result = await prevalidationHandler(
        { ...complexInput, apiUrl, accessToken: oystehrToken, secrets: secrets },
        oystehr
      );
      console.log('prevalidation primary', result.primary);
      console.log('prevalidation secondary', result.primary);
      primary = result.primary;
      secondary = result.secondary;
    } else {
      const { appointmentId, appointment, patientId, billingProvider, coverageResources, coverageToCheck } =
        complexInput;
      const { coverages, insuranceOrgs } = coverageResources;

      // coverages is an object with keys "primary" and "secondary", which are the same values coverageToCheck can take on
      const coverageToUse = coverages[coverageToCheck];

      if (!coverageToUse) {
        throw FHIR_RESOURCE_NOT_FOUND('Coverage');
      }

      const payorReference = getPayorRef(coverageToUse, insuranceOrgs);

      if (!payorReference) {
        throw new Error('Payor reference not found');
      }

      // create a CER resource
      const CER = makeCoverageEligibilityRequest({
        coverageReference: `Coverage/${coverageToUse.id}`,
        payorReference: payorReference,
        providerReference: billingProvider,
        patientReference: `Patient/${patientId}`,
      });

      const coverageEligibilityRequest = await oystehr.fhir.create<CoverageEligibilityRequest>(CER);

      const projectApiURL = getSecret(SecretsKeys.PROJECT_API, secrets);

      let tagProps: Omit<TagAppointmentWithEligibilityFailureReasonParameters, 'reason'> | undefined;
      if (appointment && appointmentId) {
        tagProps = {
          appointment,
          appointmentId,
          oystehr,
        };
      }

      console.log('coverageToCheck', coverageToCheck);

      const eligibilityCheckResult = await performEligibilityCheckAndReturnStatus(
        coverageEligibilityRequest.id,
        projectApiURL,
        tagProps
      );

      if (coverageToCheck === 'primary') {
        primary = eligibilityCheckResult;
        secondary = undefined;
      } else {
        secondary = eligibilityCheckResult;
        primary = undefined;
      }
    }
    return lambdaResponse(200, { primary, secondary });
  } catch (error: any) {
    console.error(error, error.issue);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-eligibility', error, ENVIRONMENT);
  }
});

const performEligibilityCheckAndReturnStatus = async (
  coverageEligibilityRequestId: string | undefined,
  projectApiURL: string,
  tagProps?: Omit<TagAppointmentWithEligibilityFailureReasonParameters, 'reason'>
): Promise<InsuranceCheckStatusWithDate> => {
  console.log('coverageEligibilityRequestId', coverageEligibilityRequestId);
  console.log('projectApiURL', projectApiURL, coverageEligibilityRequestId);
  const response = await fetch(`${projectApiURL}/rcm/eligibility-check`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${oystehrToken}`,
    },
    body: JSON.stringify({
      eligibilityRequestId: coverageEligibilityRequestId,
    }),
  });

  const now = new Date().toISOString();

  if (!response.ok) {
    console.error('eligibility check service failure reason: ', JSON.stringify(await response.json(), null, 2));
    return { status: InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO: now };
  }
  return checkEligibility({ eligibilityCheckResponse: response, tagProps });
};

const checkEligibility = async ({
  eligibilityCheckResponse,
  tagProps,
}: {
  eligibilityCheckResponse: Response;
  tagProps?: Omit<TagAppointmentWithEligibilityFailureReasonParameters, 'reason'>;
}): Promise<InsuranceCheckStatusWithDate> => {
  const res = await parseEligibilityCheckResponsePromiseResult(
    await Promise.resolve({ status: 'fulfilled', value: eligibilityCheckResponse } as PromiseFulfilledResult<Response>)
  );
  if (res.status === InsuranceEligibilityCheckStatus.eligibilityConfirmed) {
    return res;
  }
  if (res.status === InsuranceEligibilityCheckStatus.eligibilityCheckNotSupported) {
    console.log('Payer does not support real-time eligibility. Bypassing.');
    if (tagProps?.appointment && tagProps?.appointmentId) {
      await tagAppointmentWithEligibilityFailureReason({
        ...tagProps,
        reason: ELIGIBILITY_FAILED_REASONS.realTimeEligibilityUnsupported,
      });
    }
    return res;
  }
  if (res.status === InsuranceEligibilityCheckStatus.eligibilityNotChecked) {
    if (tagProps?.appointment && tagProps?.appointmentId) {
      await tagAppointmentWithEligibilityFailureReason({
        ...tagProps,
        reason: ELIGIBILITY_FAILED_REASONS.apiFailure,
      });
    }
  }

  return res;
};

interface TagAppointmentWithEligibilityFailureReasonParameters {
  appointment: Appointment;
  appointmentId: string;
  oystehr: Oystehr;
  reason: string;
}
// todo: not sure putting a meta tag on the appointment is the best thing to do here. probably better
// to return information about the outcome and let the handler decide what to do with that information
const tagAppointmentWithEligibilityFailureReason = async ({
  appointment,
  appointmentId,
  oystehr,
  reason,
}: TagAppointmentWithEligibilityFailureReasonParameters): Promise<void> => {
  const system = `${PRIVATE_EXTENSION_BASE_URL}/${ELIGIBILITY_FAILED_REASON_META_TAG}`;
  const index = appointment.meta?.tag?.findIndex((tag) => tag.system === system);

  await oystehr.fhir.patch<Appointment>({
    resourceType: 'Appointment',
    id: appointmentId,
    operations: [
      {
        op: 'add',
        path: `/meta/tag/${index === -1 ? 0 : index}`,
        value: {
          system,
          code: reason,
          display: reason,
        },
      },
    ],
  });
};
