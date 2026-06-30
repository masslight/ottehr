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
}

export const composeSignature: DataComposer<SignatureComposerInput, SignatureData> = ({
  appointmentPackage,
  visit,
  signatures,
}) => {
  const { timezone } = appointmentPackage;

  // The visit-note PDF is only generated once a note is signed, so the signed line always renders.
  // Prefer the `author` Provenance (accurate signer + original sign time, stable across re-generation
  // after supervisor approval); fall back to the attending provider and the current time when none
  // exists (the non-supervisor sign flow writes no Provenance).
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
    shouldRender: (data) => !!(data.signedBy || data.approvedBy),
    render: (client, data, styles) => {
      client.drawSeparatedLine(styles.lineStyles.separator);
      if (data.signedBy) {
        drawRegularText(client, styles, data.signedBy);
      }
      if (data.approvedBy) {
        drawRegularText(client, styles, data.approvedBy);
      }
    },
  }));
};
