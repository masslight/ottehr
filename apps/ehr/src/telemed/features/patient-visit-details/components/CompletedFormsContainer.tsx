import { useAuth0 } from '@auth0/auth0-react';
import { Bundle, BundleEntry, DocumentReference } from 'fhir/r4b';
import { Button } from '@mui/material';
import { FC, ReactElement, useState } from 'react';
import { CONSENT_CODE, getIpAddress, getQuestionnaireResponseByLinkId, mdyStringFromISOString } from 'utils';
import { otherColors } from '../../../../CustomThemeProvider';
import { getPresignedFileUrl } from '../../../../helpers/files.helper';
import { InformationCard } from './InformationCard';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore, useGetDocumentReferences } from '../../../state';

const PdfButton = ({ pdfUrl }: { pdfUrl?: string }): ReactElement => {
  return (
    <Button
      variant="outlined"
      sx={{
        borderColor: otherColors.consentBorder,
        borderRadius: 100,
        textTransform: 'none',
        fontWeight: 700,
        fontSize: 14,
        minWidth: 'max-content',
      }}
      href={pdfUrl || ''}
      target="_blank"
      disabled={!pdfUrl}
    >
      Get PDF
    </Button>
  );
};

export const CompletedFormsContainer: FC = () => {
  const { getAccessTokenSilently } = useAuth0();
  const { patient, appointment, questionnaireResponse } = getSelectors(useAppointmentStore, [
    'patient',
    'appointment',
    'questionnaireResponse',
  ]);

  const [consentPdfUrl, setConsentPdfUrl] = useState<string | undefined>();
  const [hippaPdfUrl, setHippaPdfUrl] = useState<string | undefined>();

  useGetDocumentReferences({ appointmentId: appointment?.id, patientId: patient?.id }, async (data) => {
    const authToken = await getAccessTokenSilently();

    const documentReferenceResources: DocumentReference[] = [];

    const bundleEntries = data.entry;
    bundleEntries?.forEach((bundleEntry: BundleEntry) => {
      const bundleResource = bundleEntry.resource as Bundle;
      bundleResource.entry?.forEach((entry) => {
        const docRefResource = entry.resource as DocumentReference;
        docRefResource && documentReferenceResources.push(docRefResource);
      });
    });

    for (const docRef of documentReferenceResources) {
      const docRefCode = docRef.type?.coding?.[0].code;

      if (docRefCode === CONSENT_CODE) {
        for (const content of docRef.content) {
          const title = content.attachment.title;
          const z3Url = content.attachment.url;
          const presignedUrl = z3Url && (await getPresignedFileUrl(z3Url, authToken));

          if (title === 'Consent forms') {
            setConsentPdfUrl(presignedUrl);
          } else if (title === 'HIPPA forms') {
            setHippaPdfUrl(presignedUrl);
          }
        }
      }
    }
  });

  const hipaaAcknowledgement = getQuestionnaireResponseByLinkId('hipaa-acknowledgement', questionnaireResponse)
    ?.answer?.[0]?.valueBoolean;
  const consentToTreat = getQuestionnaireResponseByLinkId('consent-to-treat', questionnaireResponse)?.answer?.[0]
    ?.valueBoolean;

  const signature = getQuestionnaireResponseByLinkId('signature', questionnaireResponse)?.answer?.[0]?.valueString;
  const fullName = getQuestionnaireResponseByLinkId('full-name', questionnaireResponse)?.answer?.[0]?.valueString;
  const relaytionship = getQuestionnaireResponseByLinkId('consent-form-signer-relationship', questionnaireResponse)
    ?.answer?.[0]?.valueString;
  const signDate = questionnaireResponse?.authored && mdyStringFromISOString(questionnaireResponse?.authored);
  const ipAddress = getIpAddress(questionnaireResponse);

  return (
    <InformationCard
      title="Completed consent forms"
      fields={[
        {
          label: 'I have reviewed and accept HIPAA Acknowledgement',
          value: hipaaAcknowledgement ? 'Signed' : 'Not signed',
          button: <PdfButton pdfUrl={hippaPdfUrl} />,
        },
        {
          label: 'I have reviewed and accept Consent to Treat and Guarantee of Payment',
          value: consentToTreat ? 'Signed' : 'Not signed',
          button: <PdfButton pdfUrl={consentPdfUrl} />,
        },
        {
          label: 'Signature',
          value: signature,
        },
        {
          label: 'Full name',
          value: fullName,
        },
        {
          label: 'Relationship to the patient',
          value: relaytionship,
        },
        {
          label: 'Date',
          value: signDate,
        },
        {
          label: 'IP',
          value: ipAddress,
        },
      ]}
    />
  );
};
