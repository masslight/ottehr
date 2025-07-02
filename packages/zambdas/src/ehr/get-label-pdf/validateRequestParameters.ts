import { GetLabelPdfParameters, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GetLabelPdfParameters & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { contextRelatedReference, searchParams } = JSON.parse(input.body) as GetLabelPdfParameters;

  const missingResources = [];
  if (!contextRelatedReference) missingResources.push('contextRelatedReference');
  if (searchParams === undefined) missingResources.push('searchParams');

  if (missingResources.length) {
    throw MISSING_REQUIRED_PARAMETERS(missingResources);
  }

  // not supporting contained resources for the moment
  if (!contextRelatedReference.reference?.match(/\w+\/[\d\w-]+/)) {
    throw INVALID_INPUT_ERROR(
      `contextRelatedReference reference is an unexpected format or undefined: ${JSON.stringify(
        contextRelatedReference.reference
      )}`
    );
  }

  if (!searchParams.some((param) => param.name === 'type')) {
    throw INVALID_INPUT_ERROR(`searchParams should include a label type in name=type ${JSON.stringify(searchParams)}`);
  }

  return {
    contextRelatedReference,
    searchParams,
    secrets: input.secrets,
  };
}
