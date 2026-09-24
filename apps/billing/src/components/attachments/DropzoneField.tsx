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
import Dropzone, { DropzoneProps, FileRejection } from 'react-dropzone';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';

const rejectionMessage = (rejections: FileRejection[]): string => {
  const code = rejections[0]?.errors[0]?.code;
  if (code === 'file-too-large') return 'That file is too large';
  if (code === 'file-invalid-type') return "That type of file can't be attached here";
  return rejections[0]?.errors[0]?.message ?? 'That file was not accepted';
};

// A react-hook-form file field: a drop zone that also opens the file picker on click. Holds a File (or
// File[] when multiple) under `name` in the surrounding FormProvider.
export const DropzoneField = ({
  name,
  multiple,
  required,
  ...rest
}: {
  name: string;
  multiple: boolean;
  required?: boolean;
} & Omit<DropzoneProps, 'multiple' | 'onDrop'>): ReactElement => {
  const { control, setError } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      rules={required ? { required: REQUIRED_FIELD_ERROR_MESSAGE } : undefined}
      render={({ field: { value, onChange, onBlur }, fieldState: { error: fieldError } }) => (
        <>
          {!value ? (
            <></>
          ) : (
            <ListItem disablePadding disableGutters>
              <ListItemIcon sx={{ minWidth: 0, mr: 1.5 }}>
                <DescriptionIcon />
              </ListItemIcon>
              <ListItemText primary={value.name} />
            </ListItem>
          )}
          <Dropzone
            onDrop={(acceptedFiles, rejections) => {
              if (rejections.length > 0 && acceptedFiles.length === 0) {
                setError(name, { type: 'validate', message: rejectionMessage(rejections) });
                return;
              }
              onChange(multiple ? acceptedFiles : acceptedFiles[0]);
            }}
            {...rest}
          >
            {({ getRootProps, getInputProps, isDragActive }) => {
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
                      })}
                    />
                    <Grid
                      item
                      container
                      direction="column"
                      justifyContent="center"
                      alignItems="strech"
                      rowGap={2}
                      wrap="nowrap"
                    >
                      <Grid item xs={12}>
                        <Stack direction="column" width="100%" justifyContent="center" alignItems="center" gap={1}>
                          <FileUploadIcon />
                          <Typography variant="body1" component="p" textAlign="center">
                            {isDragActive ? 'Drop file here to upload' : 'Click here or drag file to upload'}
                          </Typography>
                          {fieldError ? (
                            <FormHelperText id={`dropzone-helper-text`} error={true}>
                              {fieldError?.message}
                            </FormHelperText>
                          ) : (
                            <></>
                          )}
                        </Stack>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              );
            }}
          </Dropzone>
        </>
      )}
    />
  );
};
