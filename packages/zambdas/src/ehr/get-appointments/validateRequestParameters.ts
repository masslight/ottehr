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

  // Safely extract and validate locationID (optional string)
  let locationID: string | undefined;
  if (body.locationID !== undefined) {
    if (typeof body.locationID !== 'string') {
      throw new Error('locationID must be a string if provided');
    }
    locationID = body.locationID;
  }

  // Safely extract and validate providerIDs (optional string array)
  let providerIDs: string[] | undefined;
  if (body.providerIDs !== undefined) {
    if (!Array.isArray(body.providerIDs)) {
      throw new Error('providerIDs must be an array if provided');
    }
    if (!body.providerIDs.every((id): id is string => typeof id === 'string')) {
      throw new Error('All providerIDs must be strings');
    }
    providerIDs = body.providerIDs;
  }

  // Safely extract and validate groupIDs (optional string array)
  let groupIDs: string[] | undefined;
  if (body.groupIDs !== undefined) {
    if (!Array.isArray(body.groupIDs)) {
      throw new Error('groupIDs must be an array if provided');
    }
    if (!body.groupIDs.every((id): id is string => typeof id === 'string')) {
      throw new Error('All groupIDs must be strings');
    }
    groupIDs = body.groupIDs;
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
  if (locationID === undefined && providerIDs === undefined && groupIDs === undefined) {
    throw new Error('Either "locationID" or "providerIDs" or "groupIDs" is required');
  }

  const supervisorApprovalEnabled =
    typeof body.supervisorApprovalEnabled === 'boolean' ? body.supervisorApprovalEnabled : false;

  return {
    searchDate,
    locationID,
    providerIDs,
    groupIDs,
    visitType,
    supervisorApprovalEnabled,
    secrets: input.secrets,
  };
}
