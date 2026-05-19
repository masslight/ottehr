import { ZambdaInput } from '../../shared';
import { GetAppointmentsZambdaInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): GetAppointmentsZambdaInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  // Parse and validate the JSON body
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(input.body);
  } catch {
    throw new Error('Invalid JSON in request body');
  }

  // Validate that the parsed body is an object
  if (!parsedBody || typeof parsedBody !== 'object') {
    throw new Error('Request body must be a valid JSON object');
  }

  const body = parsedBody as Record<string, unknown>;

  // Safely extract and validate searchDate (required string)
  if (typeof body.searchDate !== 'string') {
    throw new Error('searchDate is required and must be a string');
  }
  const searchDate = body.searchDate;

  // Safely extract and validate locationIds (optional string)
  let locationIds: string[] | undefined;
  if (body.locationIds !== undefined) {
    if (!Array.isArray(body.locationIds)) {
      throw new Error('locationIds must be an array if provided');
    }
    if (!body.locationIds.every((id): id is string => typeof id === 'string')) {
      throw new Error('All locationIds must be strings');
    }
    locationIds = body.locationIds;
  }

  // Safely extract and validate providerIds (optional string array)
  let providerIds: string[] | undefined;
  if (body.providerIds !== undefined) {
    if (!Array.isArray(body.providerIds)) {
      throw new Error('providerIds must be an array if provided');
    }
    if (!body.providerIds.every((id): id is string => typeof id === 'string')) {
      throw new Error('All providerIds must be strings');
    }
    providerIds = body.providerIds;
  }

  // Safely extract and validate serviceCategories (optional string array)
  let serviceCategories: string[] | undefined;
  if (body.serviceCategories !== undefined) {
    if (!Array.isArray(body.serviceCategories)) {
      throw new Error('serviceCategories must be an array if provided');
    }
    if (!body.serviceCategories.every((val): val is string => typeof val === 'string')) {
      throw new Error('All serviceCategories must be strings');
    }
    serviceCategories = body.serviceCategories;
  }

  // Safely extract and validate visitType (required string array)
  if (!Array.isArray(body.visitType)) {
    throw new Error('visitType is required and must be an array');
  }
  if (!body.visitType.every((type): type is string => typeof type === 'string')) {
    throw new Error('All visitType values must be strings');
  }
  const visitType = body.visitType;

  // Validate business logic constraints
  if (locationIds === undefined && providerIds === undefined && serviceCategories === undefined) {
    throw new Error('Either "locationIds" or "providerIds" or "serviceCategories" is required');
  }

  const supervisorApprovalEnabled =
    typeof body.supervisorApprovalEnabled === 'boolean' ? body.supervisorApprovalEnabled : false;

  return {
    searchDate,
    locationIds,
    providerIds,
    serviceCategories,
    visitType,
    supervisorApprovalEnabled,
    secrets: input.secrets,
  };
}
