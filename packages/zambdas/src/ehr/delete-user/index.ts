import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  APIError,
  APIErrorCode,
  DeleteUserZambdaInput,
  DeleteUserZambdaInputSchema,
  DeleteUserZambdaOutput,
  RoleType,
  Secrets,
  userMe,
} from 'utils';
import { checkOrCreateM2MClientToken, safeJsonParse, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';

const ALLOWED_CALLER_ROLES: string[] = [RoleType.Administrator, RoleType.CustomerSupport];

const ZAMBDA_NAME = 'delete-user';
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success', JSON.stringify({ userId: validatedParameters.userId }));
  const { userId, userToken, secrets } = validatedParameters;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  console.group('complexValidation');
  await complexValidation(oystehr, userToken, secrets, userId);
  console.groupEnd();
  console.debug('complexValidation success');

  console.group('performEffect');
  await performEffect(oystehr, userId);
  console.groupEnd();
  console.debug('performEffect success');

  const response: DeleteUserZambdaOutput = {
    message: `Successfully deleted user ${userId}`,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

function validateRequestParameters(
  input: ZambdaInput
): DeleteUserZambdaInput & { secrets: Secrets; userToken: string } {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  if (input.secrets == null) {
    throw new Error('No secrets provided');
  }
  if (!input.headers.Authorization) {
    throw new Error('Authorization header is required');
  }

  const { userId } = DeleteUserZambdaInputSchema.parse(safeJsonParse(input.body));

  return {
    userId,
    userToken: input.headers.Authorization.replace('Bearer ', ''),
    secrets: input.secrets,
  };
}

async function complexValidation(
  oystehr: Oystehr,
  token: string,
  secrets: Secrets | null,
  userId: string
): Promise<void> {
  const [user, caller] = await Promise.all([oystehr.user.get({ id: userId }), userMe(token, secrets)]);
  if (!user) {
    throw {
      code: APIErrorCode.INVALID_INPUT,
      message: `User with ID ${userId} not found`,
      statusCode: 404,
    } satisfies APIError;
  }

  if (caller.id === userId) {
    throw {
      code: APIErrorCode.INVALID_INPUT,
      message: 'You cannot delete your own user.',
      statusCode: 400,
    } satisfies APIError;
  }
  const callerRoles = caller.roles?.map((role) => role.name) ?? [];
  if (!callerRoles.some((role) => ALLOWED_CALLER_ROLES.includes(role))) {
    throw {
      code: APIErrorCode.NOT_AUTHORIZED,
      message: 'Caller is not permitted to delete users.',
      statusCode: 403,
    } satisfies APIError;
  }
}

async function performEffect(oystehr: Oystehr, userId: string): Promise<void> {
  const user = await oystehr.user.get({ id: userId });

  // this endpoint is for removing self-registered ehr users that never got
  // promoted to a practitioner profile. block deleting a real employee.
  if (user.profile?.startsWith('Practitioner/')) {
    throw {
      code: APIErrorCode.INVALID_INPUT,
      message: 'Cannot delete a user that is linked to a Practitioner. Deactivate them instead.',
      statusCode: 400,
    } satisfies APIError;
  }

  if (user.profile?.startsWith('Patient/')) {
    const patientId = user.profile.split('/')[1];
    try {
      await oystehr.fhir.delete({ resourceType: 'Patient', id: patientId });
    } catch (error: unknown) {
      console.error(`Failed to delete Patient ${patientId}:`, JSON.stringify(error));
    }
  }

  try {
    await oystehr.user.delete({ id: userId });
  } catch (error: any) {
    console.error(`Failed to delete user ${userId}:`, JSON.stringify(error));
    throw {
      code: APIErrorCode.INVALID_INPUT,
      message: `Failed to delete user: ${error?.message ?? 'Unknown error'}`,
      statusCode:
        error?.code && typeof error.code === 'number' && error.code >= 400 && error.code < 600 ? error.code : 500,
    } satisfies APIError;
  }
}
