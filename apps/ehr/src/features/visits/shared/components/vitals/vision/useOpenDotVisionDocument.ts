import { DocumentReference } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { getPresignedURL, VitalsDotVisionScreeningDocument } from 'utils';

/**
 * Opens a DOT referral document in a new tab. Z3 URLs are not directly accessible, so the raw URL is
 * exchanged for a short-lived presigned download URL first (fixes the "{message: unauthorized}" when
 * clicking the raw link). Works both in-session (the z3 `url` is present) and for entries re-read
 * from FHIR (only `documentReferenceId` is persisted, so the attachment URL is resolved on demand).
 */
export const useOpenDotVisionDocument = (): {
  openDocument: (document: VitalsDotVisionScreeningDocument) => Promise<void>;
  isOpening: boolean;
} => {
  const { oystehr } = useApiClients();
  const [isOpening, setIsOpening] = useState(false);

  const openDocument = useCallback(
    async (document: VitalsDotVisionScreeningDocument): Promise<void> => {
      if (!oystehr) return;
      // Open the tab synchronously so it isn't blocked as a popup while we await the presigned URL.
      const newTab = window.open('', '_blank');
      try {
        setIsOpening(true);

        let z3Url = document.url;
        if (!z3Url && document.documentReferenceId) {
          const docRef = await oystehr.fhir.get<DocumentReference>({
            resourceType: 'DocumentReference',
            id: document.documentReferenceId,
          });
          z3Url = docRef.content?.find((c) => c.attachment?.url)?.attachment?.url;
        }

        const accessToken = oystehr.config.accessToken;
        if (!z3Url || !accessToken) {
          newTab?.close();
          enqueueSnackbar('Could not open the attached document.', { variant: 'error' });
          return;
        }

        const presignedUrl = await getPresignedURL(z3Url, accessToken);
        if (newTab) newTab.location.href = presignedUrl;
        else window.open(presignedUrl, '_blank');
      } catch (error) {
        newTab?.close();
        console.error('Failed to open DOT vision document', error);
        enqueueSnackbar('Could not open the attached document.', { variant: 'error' });
      } finally {
        setIsOpening(false);
      }
    },
    [oystehr]
  );

  return { openDocument, isOpening };
};
