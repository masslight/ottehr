import { FC, ChangeEvent, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { Attachment } from 'fhir/r4b';
import { zapehrApi } from '../../../../api';
import { ZambdaClient, useUCZambdaClient } from 'ui-components/lib/hooks/useUCZambdaClient';
import { DateTime } from 'luxon';
import { addContentTypeToAttachement } from 'utils';
import CardDisplay from './CardDisplay';
import UploadComponent from './UploadComponent';
import Link from '@mui/material/Link';
import imageCompression from 'browser-image-compression';
import { PaperworkContext } from '../../context';
import NonImageCardComponent from './NonImageCardComponent';

export type AttachmentType = 'image' | 'pdf';

interface FileInputProps {
  fieldName: string;
  fileName: string;
  value: Attachment | undefined;
  description: string;
  attachmentType?: AttachmentType;
  onChange: (event: any) => void;
  usePaperworkContext: () => PaperworkContext;
}

enum UploadState {
  initial,
  pending,
  complete,
  failed,
}

const FileInput: FC<FileInputProps> = ({
  fieldName: name,
  fileName,
  value,
  onChange,
  description,
  attachmentType = 'image',
  usePaperworkContext,
}) => {
  const { formState } = useFormContext();
  const { defaultValues } = formState;
  const { appointment, setSaveButtonDisabled } = usePaperworkContext();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingZ3Upload, setPendingZ3Upload] = useState<File | undefined>();
  const [z3UploadState, setZ3UploadState] = useState(UploadState.initial);
  const [compressingImage, setCompressingImage] = useState(false);
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  // when the user clears an existing value, then uploads a different image, then deletes it, we set the value
  // back to the starting value in the form state since we won't actually be deleting the existing image in that case.
  // this prevents the upload button from appearing, because value exists. this additional state is a hack to make the upload button
  // show up in that case as well.
  const [existingValueCleared, setExistingValueCleared] = useState(false);

  const defaultVal = (() => {
    const pathParts = name.split('.');
    const baseField = pathParts.reduce((accum, current) => {
      return accum?.[current];
    }, defaultValues);
    return baseField?.answer?.[0]?.valueAttachement;
  })();

  const inputRef = useRef<HTMLInputElement>(null);
  const handleReuploadClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    try {
      if (inputRef?.current) {
        inputRef.current.click();
      } else {
        throw new Error('inputRef is not defined');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleClearSelection = useCallback(async () => {
    setZ3UploadState(UploadState.initial);
    setPreviewUrl(null);
    setExistingValueCleared(true);
    onChange(defaultVal);
  }, [defaultVal, onChange]);

  const uploadDescription = useMemo(() => {
    const defaultVal = value; //((defaultValues ?? {})[name]);

    if (defaultVal?.url && !previewUrl) {
      const creationDate = defaultVal?.creation ? DateTime.fromISO(defaultVal.creation) : null;
      let dateString = '';
      if (creationDate) {
        dateString = `${creationDate.toLocaleString({ dateStyle: 'short' })}. `;
      }
      return (
        <>
          {`We already have this! It was saved on ${dateString}`}
          <Link href="#" onClick={handleReuploadClick} underline="hover">
            {'Click to re-upload'}
          </Link>
          .
        </>
      );
    }
    return description;
  }, [value, previewUrl, description]);

  useEffect(() => {
    const saveObjectToZ3 = async (file: File, appointmentId: string, client: ZambdaClient): Promise<void> => {
      try {
        setZ3UploadState(UploadState.pending);
        const uploadResponse = await zapehrApi.createZ3Object(
          appointmentId,
          fileName,
          file.type.split('/')[1],
          client,
          file
        ); // fileDate is just of type File
        const { z3URL } = uploadResponse;
        const attachment: Attachment = {
          url: z3URL,
          title: fileName,
          creation: DateTime.now().toISO(),
        };
        onChange(addContentTypeToAttachement(attachment));
        setZ3UploadState(UploadState.complete);
        setPendingZ3Upload(undefined);
        setSaveButtonDisabled(false);
      } catch (e) {
        console.error(e);
        setZ3UploadState(UploadState.failed);
      } finally {
        setSaveButtonDisabled(false);
      }
    };
    if (pendingZ3Upload && tokenlessZambdaClient && appointment?.id && z3UploadState === UploadState.initial) {
      void saveObjectToZ3(pendingZ3Upload, appointment.id, tokenlessZambdaClient);
    }
  }, [
    pendingZ3Upload,
    name,
    tokenlessZambdaClient,
    appointment?.id,
    z3UploadState,
    fileName,
    onChange,
    setSaveButtonDisabled,
  ]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<string | null> => {
    try {
      const { files } = event.target;

      if (files && files.length > 0) {
        // Even though files is an array we know there is always only one file because we don't set the `multiple` attribute on the file input
        const file = files[0];
        let finalFile = file;
        if (attachmentType === 'image') {
          const fileSizeInMb = file.size / (1024 * 1024);
          if (fileSizeInMb >= 5) {
            setSaveButtonDisabled(true);
            setCompressingImage(true);
            const options = {
              maxSizeMB: 4.9,
            };
            try {
              finalFile = await imageCompression(file, options);
              console.log(`compressedFile size ${finalFile.size / 1024 / 1024} MB`); // smaller than maxSizeMB
            } catch (error) {
              console.log('error compressing file', error);
            }
          }
        }

        const tempURL = URL.createObjectURL(finalFile);
        setPreviewUrl(tempURL); // Use this as a temporary image URL until the insurance info form is submitted
        setPendingZ3Upload(finalFile);
        setSaveButtonDisabled(true);
        setZ3UploadState(UploadState.initial);
        setCompressingImage(false);
        return finalFile.name;
      } else {
        console.log('No files selected');
        return null;
      }
    } catch (error) {
      console.error('Error occurred during file upload:', error);
      return null;
    }
  };

  const showCard = (): JSX.Element => {
    // Prompt to re-upload file if upload fails
    if (z3UploadState === UploadState.failed) {
      return (
        <UploadComponent
          name={name}
          attachmentType={attachmentType}
          uploadDescription="Failed to upload card. Please try again"
          isCompressing={false}
          handleFileUpload={handleClearSelection}
          inputRef={inputRef}
          showUploadButton={true}
        />
      );
    }

    if (previewUrl) {
      if (attachmentType === 'image') {
        return (
          <CardDisplay
            name={name}
            previewUrl={previewUrl}
            isLoading={z3UploadState === UploadState.pending}
            onClear={handleClearSelection}
          />
        );
      } else {
        return (
          <NonImageCardComponent
            fileName={`${value?.title ?? fileName ?? 'note_template'}.pdf`}
            fileUrl={previewUrl}
            onClear={handleClearSelection}
          />
        );
      }
    }
    // Otherwise prompt to upload a file
    if (attachmentType === 'pdf' && value) {
      return (
        <NonImageCardComponent
          fileName={`${value?.title ?? fileName ?? 'note_template'}.pdf`}
          fileUrl={value?.url}
          onClear={handleClearSelection}
        />
      );
    }
    return (
      <UploadComponent
        name={name}
        attachmentType={attachmentType}
        uploadDescription={uploadDescription}
        handleFileUpload={handleFileUpload}
        inputRef={inputRef}
        showUploadButton={!value || existingValueCleared}
        isCompressing={compressingImage}
      />
    );
  };

  return showCard();
};

export default FileInput;
