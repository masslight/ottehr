import { flattenQuestionnaireAnswers, formatDateForDisplay, getAttestedConsentFromEncounter } from 'utils';
import { DataComposer } from '../pdf-common';
import { consentFormsInfo, ConsentsDataInput, PdfSection } from '../types';

export const composeConsentFormsData: DataComposer<ConsentsDataInput, consentFormsInfo> = ({
  encounter,
  consents,
  questionnaireResponse,
  timezone,
}) => {
  if (!questionnaireResponse) {
    return {
      isSigned: false,
      signature: '',
      fullName: '',
      relationship: '',
      date: '',
      ip: '',
      consentIsAttested: false,
    };
  }

  const firstConsent = consents && consents.length > 0 ? consents[0] : undefined;

  const date = formatDateForDisplay(firstConsent?.dateTime, timezone);

  const flattenedPaperwork = flattenQuestionnaireAnswers(questionnaireResponse.item || []);
  const signature = flattenedPaperwork.find((item) => item.linkId === 'signature')?.answer?.[0]?.valueString ?? '';
  const isSigned = !!signature;
  const fullName =
    flattenedPaperwork.find((question) => question.linkId === 'full-name')?.answer?.[0]?.valueString ?? '';
  const relationship =
    flattenedPaperwork.find((question) => question.linkId === 'consent-form-signer-relationship')?.answer?.[0]
      ?.valueString ?? '';

  const ip =
    questionnaireResponse?.extension?.find(
      (e) => e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/ip-address'
    )?.valueString ?? '';

  const consentIsAttested = getAttestedConsentFromEncounter(encounter) ? true : false;

  return {
    isSigned,
    signature,
    fullName,
    relationship,
    date,
    ip,
    consentIsAttested,
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
        drawDivider: true,
        dividerMargin: 8,
      });
      client.drawLabelValueRow(
        'I verify that patient consent has been obtained',
        data.consentIsAttested ? 'Yes' : 'No',
        styles.textStyles.regular,
        styles.textStyles.regular,
        {
          spacing: 16,
        }
      );
    }
  },
});
