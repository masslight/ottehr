import Oystehr from '@oystehr/sdk';
import { apiErrorToThrow, chooseJson } from 'utils/lib/helpers/oystehrApi';
import {
  AnalyzeFormTemplateInput,
  AnalyzeFormTemplateOutput,
  CreateCompletedFormUploadUrlInput,
  CreateCompletedFormUploadUrlOutput,
  CreateFormTemplateUploadUrlInput,
  CreateFormTemplateUploadUrlOutput,
  DeleteFormTemplateInput,
  DeleteFormTemplateOutput,
  FillFormTemplateInput,
  FillFormTemplateOutput,
  FormTemplateAnalysisStatus,
  GetFormTemplateDetailInput,
  GetFormTemplateDetailOutput,
  ListFormTemplatesInput,
  ListFormTemplatesOutput,
  ReplaceFormTemplatePdfInput,
  ReplaceFormTemplatePdfOutput,
  SaveCompletedFormInput,
  SaveCompletedFormOutput,
  SaveFormTemplateMappingInput,
  SaveFormTemplateMappingOutput,
  UpdateFormTemplateInput,
  UpdateFormTemplateOutput,
} from 'utils/lib/types/api/form-template.types';

const ANALYZE_FORM_TEMPLATE_ZAMBDA_ID = 'analyze-form-template';
const FILL_FORM_TEMPLATE_ZAMBDA_ID = 'fill-form-template';
const CREATE_COMPLETED_FORM_UPLOAD_URL_ZAMBDA_ID = 'create-completed-form-upload-url';
const SAVE_COMPLETED_FORM_ZAMBDA_ID = 'save-completed-form';
const CREATE_FORM_TEMPLATE_UPLOAD_URL_ZAMBDA_ID = 'create-form-template-upload-url';
const GET_FORM_TEMPLATE_DETAIL_ZAMBDA_ID = 'get-form-template-detail';
const REPLACE_FORM_TEMPLATE_PDF_ZAMBDA_ID = 'replace-form-template-pdf';
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

/** Builds a copy of a template prefilled from one encounter, and returns a URL to open it. */
export const fillFormTemplate = async (
  oystehr: Oystehr,
  parameters: FillFormTemplateInput
): Promise<FillFormTemplateOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: FILL_FORM_TEMPLATE_ZAMBDA_ID, ...parameters });
    return chooseJson(response) as FillFormTemplateOutput;
  } catch (error: unknown) {
    console.error(error);
    throw apiErrorToThrow(error);
  }
};

const createCompletedFormUploadUrl = async (
  oystehr: Oystehr,
  parameters: CreateCompletedFormUploadUrlInput
): Promise<CreateCompletedFormUploadUrlOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: CREATE_COMPLETED_FORM_UPLOAD_URL_ZAMBDA_ID, ...parameters });
    return chooseJson(response) as CreateCompletedFormUploadUrlOutput;
  } catch (error: unknown) {
    console.error(error);
    throw apiErrorToThrow(error);
  }
};

const saveCompletedForm = async (
  oystehr: Oystehr,
  parameters: SaveCompletedFormInput
): Promise<SaveCompletedFormOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: SAVE_COMPLETED_FORM_ZAMBDA_ID, ...parameters });
    return chooseJson(response) as SaveCompletedFormOutput;
  } catch (error: unknown) {
    console.error(error);
    throw apiErrorToThrow(error);
  }
};

/**
 * Puts a completed form back on the chart.
 *
 * Three steps in a deliberate order: ask where to put it, put it there, then ask for it to be filed. The
 * chart record is created only by the third call, so abandoning the upload — or uploading a form belonging
 * to another patient — leaves nothing behind to tidy up.
 */
export const returnCompletedForm = async (
  oystehr: Oystehr,
  parameters: { appointmentId: string; templateId: string; file: File }
): Promise<SaveCompletedFormOutput> => {
  const { appointmentId, templateId, file } = parameters;

  const { z3Url, presignedUploadUrl } = await createCompletedFormUploadUrl(oystehr, {
    appointmentId,
    fileName: file.name,
  });

  const uploadResponse = await fetch(presignedUploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/pdf' },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload the form (${uploadResponse.status} ${uploadResponse.statusText})`);
  }

  return saveCompletedForm(oystehr, { appointmentId, z3Url, templateId });
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

const replaceFormTemplatePdf = async (
  oystehr: Oystehr,
  parameters: ReplaceFormTemplatePdfInput
): Promise<ReplaceFormTemplatePdfOutput> => {
  try {
    const response = await oystehr.zambda.execute({ id: REPLACE_FORM_TEMPLATE_PDF_ZAMBDA_ID, ...parameters });
    return chooseJson(response) as ReplaceFormTemplatePdfOutput;
  } catch (error: unknown) {
    console.error(error);
    throw apiErrorToThrow(error);
  }
};

/**
 * Swaps an existing template's PDF and reconciles its mapping against the new field inventory.
 *
 * The upload goes to a candidate location and the template is only repointed once the replacement has
 * been fetched and analysed, so a rejected or failed replacement leaves the existing template and its
 * mapping untouched.
 */
export const replaceFormTemplateWithPdf = async (
  oystehr: Oystehr,
  parameters: { documentReferenceId: string; title: string; file: File }
): Promise<ReplaceFormTemplatePdfOutput> => {
  const { documentReferenceId, title, file } = parameters;

  const candidate = await createFormTemplateUploadUrl(oystehr, { documentReferenceId, title, fileName: file.name });

  const uploadResponse = await fetch(candidate.presignedUploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/pdf' },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload the PDF (${uploadResponse.status} ${uploadResponse.statusText})`);
  }

  const result = await replaceFormTemplatePdf(oystehr, { documentReferenceId, z3Url: candidate.z3Url });

  const rejection = REJECTION_MESSAGES[result.status as FormTemplateAnalysisStatus];
  if (rejection) {
    throw new Error(`${rejection} The existing PDF has been kept.`);
  }

  return result;
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
