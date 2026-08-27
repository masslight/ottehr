import Oystehr from '@oystehr/sdk';
import { apiErrorToThrow, chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  AnalyzeFormTemplateInput,
  AnalyzeFormTemplateOutput,
  CreateFormTemplateUploadUrlInput,
  CreateFormTemplateUploadUrlOutput,
  DeleteFormTemplateInput,
  DeleteFormTemplateOutput,
  FormTemplateAnalysisStatus,
  GetFormTemplateDetailInput,
  GetFormTemplateDetailOutput,
  ListFormTemplatesInput,
  ListFormTemplatesOutput,
  SaveFormTemplateMappingInput,
  SaveFormTemplateMappingOutput,
  UpdateFormTemplateInput,
  UpdateFormTemplateOutput,
} from 'utils/lib/types/api/form-template.types';

const ANALYZE_FORM_TEMPLATE_ZAMBDA_ID = 'analyze-form-template';
const CREATE_FORM_TEMPLATE_UPLOAD_URL_ZAMBDA_ID = 'create-form-template-upload-url';
const GET_FORM_TEMPLATE_DETAIL_ZAMBDA_ID = 'get-form-template-detail';
const SAVE_FORM_TEMPLATE_MAPPING_ZAMBDA_ID = 'save-form-template-mapping';
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

export const getFormTemplateDetail = async (
  oystehr: Oystehr,
  parameters: GetFormTemplateDetailInput
): Promise<GetFormTemplateDetailOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: GET_FORM_TEMPLATE_DETAIL_ZAMBDA_ID, ...parameters });
    return chooseJson(response) as GetFormTemplateDetailOutput;
  } catch (error: unknown) {
    console.error(error);
    throw apiErrorToThrow(error);
  }
};

export const saveFormTemplateMapping = async (
  oystehr: Oystehr,
  parameters: SaveFormTemplateMappingInput
): Promise<SaveFormTemplateMappingOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: SAVE_FORM_TEMPLATE_MAPPING_ZAMBDA_ID, ...parameters });
    return chooseJson(response) as SaveFormTemplateMappingOutput;
  } catch (error: unknown) {
    console.error(error);
    throw apiErrorToThrow(error);
  }
};

export const analyzeFormTemplate = async (
  oystehr: Oystehr,
  parameters: AnalyzeFormTemplateInput
): Promise<AnalyzeFormTemplateOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: ANALYZE_FORM_TEMPLATE_ZAMBDA_ID, ...parameters });
    return chooseJson(response) as AnalyzeFormTemplateOutput;
  } catch (error: unknown) {
    console.error(error);
    throw apiErrorToThrow(error);
  }
};

/** Why a PDF could not be accepted, in terms an administrator can act on. */
export const REJECTION_MESSAGES: Record<string, string> = {
  encrypted:
    'This PDF is password- or permission-protected, so its fields cannot be read. Please upload a copy without security restrictions.',
  dynamicXfa:
    'This PDF uses Adobe’s dynamic XFA format, which browsers cannot display. Please upload a standard PDF version of the form.',
  unreadable: 'This file could not be read as a PDF. Please check the file and try again.',
};

/**
 * Creates the template record, uploads its PDF, then analyzes it.
 *
 * The record is created before the browser PUTs the file, so the three steps are not atomic. Analysis is
 * what closes that gap: it is the first thing to actually read the stored bytes, and it deletes the
 * record outright if the upload turns out to be unusable — so a failed upload leaves nothing behind
 * rather than a draft pointing at a file nobody can read.
 */
export const createFormTemplateWithPdf = async (
  oystehr: Oystehr,
  parameters: CreateFormTemplateUploadUrlInput & { file: File }
): Promise<{ created: CreateFormTemplateUploadUrlOutput; analysis: AnalyzeFormTemplateOutput }> => {
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

  const analysis = await analyzeFormTemplate(oystehr, { documentReferenceId: created.documentReferenceId });

  const rejection = REJECTION_MESSAGES[analysis.status as FormTemplateAnalysisStatus];
  if (rejection) {
    throw new Error(rejection);
  }

  return { created, analysis };
};
