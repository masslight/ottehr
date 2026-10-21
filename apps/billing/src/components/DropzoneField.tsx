import { Description as DescriptionIcon, FileUpload as FileUploadIcon } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  FormHelperText,
  Grid,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import Dropzone, { DropzoneProps, ErrorCode, FileRejection } from 'react-dropzone';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';

const formatFileSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.round(bytes / 1024)} KB`;

// Why dropped files were turned away: too large (when there is a size limit), else not an allowed type.
const rejectionMessage = (rejections: readonly FileRejection[], multiple: boolean, maxSize?: number): string => {
  const tooLarge = rejections.some(({ errors }) => errors.some(({ code }) => code === ErrorCode.FileTooLarge));
  const request =
    tooLarge && maxSize !== undefined
      ? `${multiple ? 'files' : 'a file'} smaller than ${formatFileSize(maxSize)}`
      : `${multiple ? 'files' : 'a file'} with an allowed type`;
  return `File${multiple ? 's' : ''} could not be uploaded. Please select ${request}.`;
};

export const DropzoneField = ({
  name,
  multiple,
  accept,
  required,
  error,
  ariaLabel = 'Upload file',
  maxSize,
  ...rest
}: {
  name: string;
  multiple: boolean;
  accept?: DropzoneProps['accept'];
  required?: boolean;
  error?: string | null;
  ariaLabel?: string;
} & Omit<DropzoneProps, 'multiple' | 'onDrop' | 'accept'>): ReactElement => {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      rules={required ? { required: REQUIRED_FIELD_ERROR_MESSAGE } : undefined}
      render={({ field: { value, onChange, onBlur }, fieldState: { error: fieldError } }) => {
        const errorMessage = error ?? fieldError?.message;
        const selectedFiles: File[] = Array.isArray(value) ? value : value ? [value] : [];
        return (
          <>
            {selectedFiles.map((file) => (
              <ListItem key={`${file.name}-${file.size}-${file.lastModified}`} disablePadding disableGutters>
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 1.5,
                  }}
                >
                  <DescriptionIcon />
                </ListItemIcon>
                <ListItemText primary={file.name} />
              </ListItem>
            ))}
            <Dropzone
              multiple={multiple}
              accept={accept}
              maxSize={maxSize}
              onDrop={(acceptedFiles) => {
                onChange(multiple ? acceptedFiles : acceptedFiles[0]);
              }}
              {...rest}
            >
              {({ getRootProps, getInputProps, isDragActive, fileRejections }) => {
                return (
                  <Card
                    variant="outlined"
                    component="div"
                    elevation={0}
                    sx={{
                      px: 4,
                      backgroundColor: 'lightgrey',
                    }}
                    {...getRootProps()}
                  >
                    <CardContent>
                      <Box
                        component="input"
                        {...getInputProps({
                          onBlur,
                          'aria-label': ariaLabel,
                        })}
                      />
                      <Grid
                        item
                        container
                        direction="column"
                        justifyContent="center"
                        alignItems="stretch"
                        rowGap={2}
                        wrap="nowrap"
                      >
                        <Grid item xs={12}>
                          <Stack direction="column" width="100%" justifyContent="center" alignItems="center" gap={1}>
                            <FileUploadIcon />
                            <Typography variant="body1" component="p" textAlign="center">
                              {isDragActive ? 'Drop file here to upload' : 'Click here or drag file to upload'}
                            </Typography>
                            {accept && Object.values(accept).length ? (
                              <Typography variant="body2" component="p" textAlign="center">
                                Accepted types:{' '}
                                {Object.values(accept)
                                  .flatMap((val) => val)
                                  .join(', ')}
                              </Typography>
                            ) : (
                              <></>
                            )}
                            {fileRejections.length ? (
                              <FormHelperText error={true}>
                                {rejectionMessage(fileRejections, multiple, maxSize)}
                              </FormHelperText>
                            ) : (
                              <></>
                            )}
                            {errorMessage ? <FormHelperText error={true}>{errorMessage}</FormHelperText> : <></>}
                          </Stack>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                );
              }}
            </Dropzone>
          </>
        );
      }}
    />
  );
};
