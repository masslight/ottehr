import { ZambdaInput } from 'utils';
import { GetPresignedFileURLInput } from '.';

const fileTypes = ['id-front', 'id-back', 'insurance-card-front', 'insurance-card-back'];
const fileFormats = ['jpg', 'jpeg', 'png'];
export function validateRequestParameters(input: ZambdaInput): GetPresignedFileURLInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentID, fileType, fileFormat } = JSON.parse(input.body);

  if (appointmentID === undefined || appointmentID === '') {
    throw new Error('"appointmentID" is required');
  }

  if (fileType === undefined || fileType === '') {
    throw new Error('"fileType" is required');
  }

  if (!fileTypes.includes(fileType)) {
    throw new Error(`fileType must be one of the following values: ${Object.values(fileTypes).join(', ')}`);
  }

  if (fileFormat === undefined || fileFormat === '') {
    throw new Error('"fileFormat" is required');
  }

  if (!fileFormats.includes(fileFormat)) {
    throw new Error(`fileFormat must be one of the following values: ${Object.values(fileFormats).join(', ')}`);
  }

  return {
    appointmentID,
    fileType,
    fileFormat,
    secrets: input.secrets,
  };
}
