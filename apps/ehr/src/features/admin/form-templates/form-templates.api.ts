import Oystehr from '@oystehr/sdk';
import { apiErrorToThrow, chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  CreateFormTemplateUploadUrlInput,
  CreateFormTemplateUploadUrlOutput,
  DeleteFormTemplateInput,
  DeleteFormTemplateOutput,
  ListFormTemplatesInput,
  ListFormTemplatesOutput,
  UpdateFormTemplateInput,
  UpdateFormTemplateOutput,
} from 'utils/lib/types/api/form-template.types';

const CREATE_FORM_TEMPLATE_UPLOAD_URL_ZAMBDA_ID = 'create-form-template-upload-url';
const LIST_FORM_TEMPLATES_ZAMBDA_ID = 'list-form-templates';
const UPDATE_FORM_TEMPLATE_ZAMBDA_ID = 'update-form-template';
const DELETE_FORM_TEMPLATE_ZAMBDA_ID = 'delete-form-template';

export const listFormTemplates = async (
  oystehr: Oystehr,
  parameters: ListFormTemplatesInput = {}
): Promise<ListFormTemplatesOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: LIST_FORM_TEMPLATES_ZAMBDA_ID, ...parameters });
    return chooseJson(response) as ListFormTemplatesOutput;
  } catch (error: unknown) {
    console.error(error);
    throw apiErrorToThrow(error);
  }
};

export const createFormTemplateUploadUrl = async (
  oystehr: Oystehr,
  parameters: CreateFormTemplateUploadUrlInput
): Promise<CreateFormTemplateUploadUrlOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: CREATE_FORM_TEMPLATE_UPLOAD_URL_ZAMBDA_ID, ...parameters });
    return chooseJson(response) as CreateFormTemplateUploadUrlOutput;
  } catch (error: unknown) {
    console.error(error);
    throw apiErrorToThrow(error);
  }
};

export const updateFormTemplate = async (
  oystehr: Oystehr,
  parameters: UpdateFormTemplateInput
): Promise<UpdateFormTemplateOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: UPDATE_FORM_TEMPLATE_ZAMBDA_ID, ...parameters });
    return chooseJson(response) as UpdateFormTemplateOutput;
  } catch (error: unknown) {
    console.error(error);
    throw apiErrorToThrow(error);
  }
};

export const deleteFormTemplate = async (
  oystehr: Oystehr,
  parameters: DeleteFormTemplateInput
): Promise<DeleteFormTemplateOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: DELETE_FORM_TEMPLATE_ZAMBDA_ID, ...parameters });
    return chooseJson(response) as DeleteFormTemplateOutput;
  } catch (error: unknown) {
    console.error(error);
    throw apiErrorToThrow(error);
  }
};

/**
 * Creates the template record and uploads its PDF.
 *
 * The record is created first and the browser then PUTs the file straight to storage, so the two are
 * not atomic. A template whose upload fails stays a draft pointing at an object that was never written;
 * it is visible in the admin list and can be deleted, and because drafts never reach the patient chart
 * a half-finished upload cannot surface to a provider.
 */
export const createFormTemplateWithPdf = async (
  oystehr: Oystehr,
  parameters: CreateFormTemplateUploadUrlInput & { file: File }
): Promise<CreateFormTemplateUploadUrlOutput> => {
  const { file, ...createParams } = parameters;

  const created = await createFormTemplateUploadUrl(oystehr, createParams);

  const uploadResponse = await fetch(created.presignedUploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/pdf' },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload the PDF (${uploadResponse.status} ${uploadResponse.statusText})`);
  }

  return created;
};
