import { useMutation, UseMutationResult, useQuery, UseQueryResult } from '@tanstack/react-query';
import { Attachment } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { Dispatch, SetStateAction, useState } from 'react';
import { createZ3Object, deleteVisitFiles, getPatientVisitFiles, updateVisitFiles } from 'src/api/api';
import { DocumentInfo, DocumentType, UpdateVisitFilesInput, VisitDocuments } from 'utils';
import { downscaleImageForUpload } from 'utils/lib/frontend';
import { useApiClients } from './useAppClients';

/** The saved front/back images (and their DocumentReference ids) for one card (photo ID or an insurance card). */
export interface SavedCardItem {
  front: DocumentInfo | null;
  frontId: string | null;
  back: DocumentInfo | null;
  backId: string | null;
}

export interface UseVisitCardsInput {
  appointmentId: string | undefined;
  patientId: string | undefined;
}

export interface UseVisitCardsResult {
  // get-visit-files query
  imagesLoading: boolean;
  refetchFileData: UseQueryResult<VisitDocuments, Error>['refetch'];
  consentPdfUrls: string[];

  // derived card groupings
  idCards: SavedCardItem;
  primaryInsuranceCards: SavedCardItem;
  secondaryInsuranceCards: SavedCardItem;

  // upload mutation
  filesMutation: UseMutationResult<void, Error, UpdateVisitFilesInput, unknown>;
  uploadingFileType: UpdateVisitFilesInput['fileType'] | null;

  // delete (remove + reload a card image)
  deletingFileId: string | null;
  handleDeleteClick: (id: string | null) => Promise<void>;

  // scanner modal
  scannerModalOpen: boolean;
  setScannerModalOpen: Dispatch<SetStateAction<boolean>>;
  handleOpenScanner: (fileType: UpdateVisitFilesInput['fileType']) => void;
  handleScanComplete: (fileBlob: Blob | Blob[], fileName: string) => Promise<void>;
}

/**
 * Card-related state, queries, and handlers for a visit: the get-visit-files query, the derived
 * insurance/ID card groupings, card deletion (so a face can be removed and reloaded), and the
 * scanner-modal upload flow.
 *
 * Extracted from VisitDetailsPage so multiple mount points can drive the card displays and the
 * shared single <ScannerModal> from one source of truth.
 */
export const useVisitCards = ({ appointmentId, patientId }: UseVisitCardsInput): UseVisitCardsResult => {
  const { oystehrZambda } = useApiClients();

  const [scannerModalOpen, setScannerModalOpen] = useState<boolean>(false);
  const [scannerFileType, setScannerFileType] = useState<UpdateVisitFilesInput['fileType'] | null>(null);
  const [uploadingFileType, setUploadingFileType] = useState<UpdateVisitFilesInput['fileType'] | null>(null);
  const [deletingFileId, setDeletingFile] = useState<string | null>(null);

  const {
    data: imageFileData,
    isLoading: imagesLoading,
    refetch: refetchFileData,
  } = useQuery({
    queryKey: ['get-visit-files', appointmentId],

    queryFn: async (): Promise<VisitDocuments> => {
      if (oystehrZambda && appointmentId) {
        return getPatientVisitFiles(oystehrZambda, { appointmentId });
      }
      throw new Error('fhir client not defined or patientIds not provided');
    },

    enabled: Boolean(oystehrZambda) && appointmentId !== undefined,
  });

  const { consentPdfUrls } = imageFileData || {
    consentPdfUrls: [],
  };

  const { idCards, primaryInsuranceCards, secondaryInsuranceCards } = (() => {
    const { photoIdCards, insuranceCards, insuranceCardsSecondary } = imageFileData || {
      photoIdCards: [],
      insuranceCards: [],
      insuranceCardsSecondary: [],
    };
    const idCards: SavedCardItem = { front: null, frontId: null, back: null, backId: null };
    const primaryInsuranceCards: SavedCardItem = {
      front: null,
      frontId: null,
      back: null,
      backId: null,
    };
    const secondaryInsuranceCards: SavedCardItem = {
      front: null,
      frontId: null,
      back: null,
      backId: null,
    };
    insuranceCards.forEach((card) => {
      if (card.type === DocumentType.InsuranceFront) {
        primaryInsuranceCards.front = card;
        primaryInsuranceCards.frontId = card.id;
      } else if (card.type === DocumentType.InsuranceBack) {
        primaryInsuranceCards.back = card;
        primaryInsuranceCards.backId = card.id;
      }
    });
    insuranceCardsSecondary.forEach((card) => {
      if (card.type === DocumentType.InsuranceFrontSecondary) {
        secondaryInsuranceCards.front = card;
        secondaryInsuranceCards.frontId = card.id;
      } else if (card.type === DocumentType.InsuranceBackSecondary) {
        secondaryInsuranceCards.back = card;
        secondaryInsuranceCards.backId = card.id;
      }
    });
    photoIdCards.forEach((card) => {
      if (card.type === DocumentType.PhotoIdFront) {
        idCards.front = card;
        idCards.frontId = card.id;
      } else if (card.type === DocumentType.PhotoIdBack) {
        idCards.back = card;
        idCards.backId = card.id;
      }
    });
    return {
      idCards,
      primaryInsuranceCards,
      secondaryInsuranceCards,
    };
  })();

  const filesMutation = useMutation({
    mutationFn: async (input: UpdateVisitFilesInput) => {
      if (!oystehrZambda) throw new Error('oystehrZambda not defined');
      await updateVisitFiles(oystehrZambda, input);
    },
    onSuccess: async () => {
      await refetchFileData();
    },
  });

  const handleDeleteClick = async (id: string | null): Promise<void> => {
    if (!oystehrZambda || !id) return;

    try {
      setDeletingFile(id);
      await deleteVisitFiles(oystehrZambda, { documentId: id, patientId: patientId ?? '' });
      setDeletingFile(null);
      enqueueSnackbar('File deleted successfully', { variant: 'success' });
      await refetchFileData();
    } catch (error) {
      console.error('Error deleting document:', error);
      setDeletingFile(null);
      enqueueSnackbar('Error deleting document', { variant: 'error' });
    }
  };

  // Handler for opening the scanner modal
  const handleOpenScanner = (fileType: UpdateVisitFilesInput['fileType']): void => {
    setScannerFileType(fileType);
    setScannerModalOpen(true);
  };

  // Handler for when scanning is complete
  const handleScanComplete = async (fileBlob: Blob | Blob[], fileName: string): Promise<void> => {
    if (!oystehrZambda || !appointmentId || !scannerFileType) return;

    try {
      setUploadingFileType(scannerFileType);
      // Handle PNG blobs (array of blobs)
      if (Array.isArray(fileBlob)) {
        // Upload each PNG file
        for (let i = 0; i < fileBlob.length; i++) {
          // Shrink oversized scans in the browser before upload; a downscaled blob comes back as JPEG.
          const blob = await downscaleImageForUpload(fileBlob[i]);
          const isJpeg = blob.type === 'image/jpeg';
          const fileExtension = isJpeg ? 'jpg' : 'png';
          const imageFileName =
            fileBlob.length > 1 ? `${fileName}-${i + 1}.${fileExtension}` : `${fileName}.${fileExtension}`;

          const z3URL = await createZ3Object(
            {
              appointmentID: appointmentId,
              fileType: scannerFileType,
              fileFormat: isJpeg ? 'jpeg' : 'png',
              file: new File([blob], imageFileName, { type: isJpeg ? 'image/jpeg' : 'image/png' }),
            },
            oystehrZambda
          );

          const attachment: Attachment = {
            url: z3URL,
            title: scannerFileType,
            creation: DateTime.now().toISO(),
          };

          await filesMutation.mutateAsync({
            appointmentId,
            attachment,
            fileType: scannerFileType,
          });
        }

        setScannerModalOpen(false);
        setUploadingFileType(null);
        enqueueSnackbar(
          `Successfully uploaded ${fileBlob.length} scanned ${fileBlob.length === 1 ? 'image' : 'images'}`,
          { variant: 'success' }
        );
      } else {
        // Handle single PDF blob (backward compatibility)
        const pdfFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

        const z3URL = await createZ3Object(
          {
            appointmentID: appointmentId,
            fileType: scannerFileType,
            fileFormat: 'pdf',
            file: new File([fileBlob], pdfFileName, { type: 'application/pdf' }),
          },
          oystehrZambda
        );

        const attachment: Attachment = {
          url: z3URL,
          title: scannerFileType,
          creation: DateTime.now().toISO(),
        };

        await filesMutation.mutateAsync({
          appointmentId,
          attachment,
          fileType: scannerFileType,
        });

        setScannerModalOpen(false);
        setUploadingFileType(null);
        enqueueSnackbar('Scanned document uploaded successfully', { variant: 'success' });
      }
    } catch (error) {
      console.error('Error uploading scanned document:', error);
      setUploadingFileType(null);
      enqueueSnackbar('Error uploading scanned document', { variant: 'error' });
    }
  };

  return {
    imagesLoading,
    refetchFileData,
    consentPdfUrls,
    idCards,
    primaryInsuranceCards,
    secondaryInsuranceCards,
    filesMutation,
    uploadingFileType,
    deletingFileId,
    handleDeleteClick,
    scannerModalOpen,
    setScannerModalOpen,
    handleOpenScanner,
    handleScanComplete,
  };
};
