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
import Dropzone, { DropzoneProps } from 'react-dropzone';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';

export const DropzoneField = ({
  name,
  multiple,
  accept,
  required,
  ...rest
}: {
  name: string;
  multiple: boolean;
  accept?: DropzoneProps['accept'];
  required?: boolean;
} & Omit<DropzoneProps, 'multiple' | 'onDrop' | 'accept'>): ReactElement => {
  const { control } = useFormContext();
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
            multiple={multiple}
            accept={accept}
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
                              File{multiple ? 's' : ''} could not be uploaded. Please select{' '}
                              {multiple ? 'files' : 'a file'} with an allowed type.
                            </FormHelperText>
                          ) : (
                            <></>
                          )}
                          {fieldError ? <FormHelperText error={true}>{fieldError?.message}</FormHelperText> : <></>}
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
