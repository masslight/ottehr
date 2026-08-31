import type { PaperworkConfig, ResolvedConsentFormConfig } from 'config-types';
import { camelCase } from 'lodash-es';
import { INTAKE_PAPERWORK_CONFIG } from '../ottehr-config/intake-paperwork';

/**
 * Check if a field is hidden in any section of the given paperwork config.
 */
export const checkFieldHidden = (fieldKey: string, config: PaperworkConfig = INTAKE_PAPERWORK_CONFIG): boolean => {
  return Object.values(config.FormFields)
    .flatMap((section: any) => section.hiddenFields || [])
    .includes(fieldKey);
};

export const getIntakeFormPageSubtitle = (
  pageLinkId: string,
  patientName: string,
  config: PaperworkConfig = INTAKE_PAPERWORK_CONFIG
): string => {
  if (config.getIntakeFormPageSubtitle) {
    return config.getIntakeFormPageSubtitle(pageLinkId, patientName);
  }
  return patientName;
};

/**
 * Build consent form checkbox items dynamically from consent forms config.
 * This is called at config creation time so it picks up any test overrides.
 */
export function buildConsentFormCheckboxItems(consentForms: ResolvedConsentFormConfig[]): Record<string, any> {
  return Object.fromEntries(
    consentForms.map((form) => [
      camelCase(form.id),
      {
        key: form.id,
        label: `I have reviewed and accept [${form.formTitle}](${form.publicUrl})`,
        type: 'boolean',
        triggers: [
          {
            targetQuestionLinkId: '$status',
            effect: ['enable'],
            operator: '!=',
            answerString: 'completed',
          },
          {
            targetQuestionLinkId: '$status',
            effect: ['enable'],
            operator: '!=',
            answerString: 'amended',
          },
        ],
        enableBehavior: 'all',
        permissibleValue: true,
        disabledDisplay: 'disabled',
      },
    ])
  );
}
