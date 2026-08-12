import { DateTime } from 'luxon';
import { formatDateTimeToZone } from 'utils';
import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, ProgressNoteSignatures, SignatureData, VisitDetailsForProgressNote } from '../../types';
import { FullAppointmentResourcePackage } from '../../visit-details-pdf/types';

interface SignatureComposerInput {
  appointmentPackage: FullAppointmentResourcePackage;
  visit: VisitDetailsForProgressNote;
  signatures?: ProgressNoteSignatures;
  signed?: boolean;
}

const PENDING_SIGNATURE_TEXT = 'Pending provider signature';

export const composeSignature: DataComposer<SignatureComposerInput, SignatureData> = ({
  appointmentPackage,
  visit,
  signatures,
  signed,
}) => {
  const { timezone } = appointmentPackage;

  if (signed === false) {
    return { pendingSignature: PENDING_SIGNATURE_TEXT };
  }

  const fallbackProviderName = visit.visitType === 'initial' ? visit.provider : visit.provider?.name ?? '';
  const signedName = signatures?.signedBy?.name || fallbackProviderName;
  const signedDateTime = formatDateTimeToZone(
    signatures?.signedBy?.dateTimeISO ?? DateTime.now().toISO() ?? undefined,
    timezone
  );
  const signedBy =
    signedName && signedDateTime ? `Signed electronically by ${signedName} on ${signedDateTime}` : undefined;

  let approvedBy: string | undefined;
  if (signatures?.approvedBy?.name) {
    const approvedDateTime = formatDateTimeToZone(signatures.approvedBy.dateTimeISO, timezone);
    if (approvedDateTime) {
      approvedBy = `Approved by ${signatures.approvedBy.name} on ${approvedDateTime}`;
    }
  }

  return { signedBy, approvedBy };
};

export const createSignatureSection = <TData extends { signature: SignatureData }>(): PdfSection<
  TData,
  SignatureData
> => {
  return createConfiguredSection(null, () => ({
    dataSelector: (data) => data.signature,
    shouldRender: (data) => !!(data.signedBy || data.approvedBy || data.pendingSignature),
    render: (client, data, styles) => {
      if (data.pendingSignature) {
        drawRegularText(client, styles, data.pendingSignature);
        return;
      }

      if (data.signedBy) {
        drawRegularText(client, styles, data.signedBy);
      }

      if (data.approvedBy) {
        drawRegularText(client, styles, data.approvedBy);
      }
    },
  }));
};
