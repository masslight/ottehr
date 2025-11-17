import { QuestionnaireResponse } from 'fhir/r4b';
import { flattenQuestionnaireAnswers } from 'utils';
import { DataComposer } from '../pdf-common';
import { consentFormsInfo, PdfSection } from '../types';

export const composeConsentFormsData: DataComposer<QuestionnaireResponse | undefined, consentFormsInfo> = (
  questionnaireResponse
) => {
  if (!questionnaireResponse) {
    return {
      isSigned: false,
      signature: '',
      fullName: '',
      relationship: '',
      date: '',
      ip: '',
    };
  }

  const flattenedPaperwork = flattenQuestionnaireAnswers(questionnaireResponse.item || []);
  const signature = flattenedPaperwork.find((item) => item.linkId === 'signature')?.answer?.[0]?.valueString ?? '';
  const isSigned = !!signature;
  const fullName =
    flattenedPaperwork.find((question) => question.linkId === 'full-name')?.answer?.[0]?.valueString ?? '';
  const relationship =
    flattenedPaperwork.find((question) => question.linkId === 'consent-form-signer-relationship')?.answer?.[0]
      ?.valueString ?? '';

  const date = '';
  const ip =
    questionnaireResponse?.extension?.find(
      (e) => e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/ip-address'
    )?.valueString ?? '';

  return {
    isSigned,
    signature,
    fullName,
    relationship,
    date,
    ip,
  };
};

export const createConsentFormsSection = <TData extends { consentForms?: consentFormsInfo }>(): PdfSection<
  TData,
  consentFormsInfo
> => ({
  title: 'Completed consent forms',
  dataSelector: (data) => data.consentForms,
  render: (client, data, styles) => {
    client.drawLabelValueRow(
      'Consent Forms signed?',
      data.isSigned ? 'Signed' : 'Not signed',
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    if (data.isSigned) {
      client.drawLabelValueRow('Signature', data.signature, styles.textStyles.regular, styles.textStyles.regular, {
        drawDivider: true,
        dividerMargin: 8,
      });
      client.drawLabelValueRow('Full name', data.fullName, styles.textStyles.regular, styles.textStyles.regular, {
        drawDivider: true,
        dividerMargin: 8,
      });
      client.drawLabelValueRow(
        `Relationship to the patient`,
        data.relationship,
        styles.textStyles.regular,
        styles.textStyles.regular,
        {
          drawDivider: true,
          dividerMargin: 8,
        }
      );
      client.drawLabelValueRow(`Date`, data.date, styles.textStyles.regular, styles.textStyles.regular, {
        drawDivider: true,
        dividerMargin: 8,
      });
      client.drawLabelValueRow(`IP`, data.ip, styles.textStyles.regular, styles.textStyles.regular, {
        spacing: 16,
      });
    }
  },
});
