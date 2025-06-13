import {
  Card,
  FormControl,
  FormLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Control, Controller } from 'react-hook-form';
import { Autocomplete, TextField } from '@mui/material';
import { PractitionerLicense, PractitionerQualificationCodesLabels, AllStates } from 'utils';
import { FormErrors } from './types';
import { dataTestIds } from '../../constants/data-test-ids';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { RoundedButton } from '../RoundedButton';
import { DateTime } from 'luxon';
import { otherColors } from '@ehrTheme/colors';

const displayStates = AllStates.map((state) => state.value);

interface ProviderQualificationsProps {
  control: Control<any>;
  errors: FormErrors;
  handleAddLicense: () => void;
  newLicenses: PractitionerLicense[];
  setNewLicenses: (licenses: PractitionerLicense[]) => void;
}

export function ProviderQualifications({
  control,
  errors,
  handleAddLicense,
  newLicenses,
  setNewLicenses,
}: ProviderQualificationsProps): JSX.Element {
  return (
    <FormControl sx={{ width: '100%' }}>
      <FormLabel sx={{ mt: 3, fontWeight: '600 !important' }}>Provider Qualifications</FormLabel>
      <Stack mt={1} gap={2}>
        <TableContainer>
          <Table data-testid={dataTestIds.employeesPage.qualificationsTable}>
            <TableHead>
              <TableRow>
                <TableCell>State</TableCell>
                <TableCell align="left">Qualification</TableCell>
                <TableCell align="left">License</TableCell>
                <TableCell align="left">Operate in state</TableCell>
                <TableCell align="left">Delete License</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {newLicenses.map((license, index) => (
                <TableRow key={index} data-testid={dataTestIds.employeesPage.qualificationRow(license.code)}>
                  <TableCell>{license.state}</TableCell>
                  <TableCell align="left">{license.code}</TableCell>
                  <TableCell align="left">
                    {license.number && <Typography>{license.number}</Typography>}
                    {license.date && (
                      <Typography variant="body2" color="secondary.light">
                        till {DateTime.fromISO(license.date).toFormat('MM/dd/yyyy')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={license.active}
                      onChange={async () => {
                        const updatedLicenses = [...newLicenses];
                        updatedLicenses[index].active = !updatedLicenses[index].active;
                        setNewLicenses(updatedLicenses);
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      sx={{
                        color: 'error.dark',
                        ':hover': {
                          backgroundColor: 'error.light',
                          color: 'error.contrastText',
                        },
                      }}
                      onClick={async () => {
                        const updatedLicenses = [...newLicenses];
                        updatedLicenses.splice(index, 1);
                        setNewLicenses(updatedLicenses);
                      }}
                      data-testid={dataTestIds.employeesPage.deleteQualificationButton}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Card
          sx={{ p: 2, backgroundColor: otherColors.formCardBg }}
          elevation={0}
          component={Stack}
          spacing={2}
          data-testid={dataTestIds.employeesPage.addQualificationCard}
        >
          <Typography fontWeight={600} color="primary.dark">
            Add state qualification
          </Typography>

          <Stack direction="row" spacing={2}>
            <Controller
              name="newLicenseState"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  {...field}
                  fullWidth
                  size="small"
                  options={displayStates}
                  getOptionLabel={(option: string) => option}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="State"
                      data-testid={dataTestIds.employeesPage.newQualificationStateDropdown}
                      error={errors.state}
                      helperText={errors.state ? 'Please select a state' : null}
                    />
                  )}
                  onChange={(_, value: string | null) => field.onChange(value ?? undefined)}
                  value={field.value || null}
                />
              )}
            />

            <Controller
              name="newLicenseCode"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  {...field}
                  fullWidth
                  size="small"
                  options={Object.keys(PractitionerQualificationCodesLabels)}
                  getOptionLabel={(option: string) => option}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Qualification"
                      data-testid={dataTestIds.employeesPage.newQualificationTypeDropdown}
                      error={errors.qualification}
                      helperText={errors.qualification ? 'Please select a qualification' : null}
                    />
                  )}
                  onChange={(_, value: string | null) => field.onChange(value ?? undefined)}
                  value={field.value || null}
                />
              )}
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <Controller
              name="newLicenseNumber"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  size="small"
                  label="License number"
                  data-testid={dataTestIds.employeesPage.newQualificationNumberField}
                  error={errors.number}
                  helperText={errors.number ? 'Please enter license number' : null}
                  onChange={(e) => field.onChange(e.target.value ?? undefined)}
                  value={field.value || ''}
                />
              )}
            />

            <Controller
              name="newLicenseExpirationDate"
              control={control}
              render={({ field: { onChange, value } }) => (
                <LocalizationProvider dateAdapter={AdapterLuxon}>
                  <DatePicker
                    label="Expiration date"
                    onChange={onChange}
                    slotProps={{
                      textField: {
                        style: { width: '100%' },
                        size: 'small',
                        helperText: errors.date ? 'Please enter expiration date' : null,
                        error: errors.date,
                        inputProps: {
                          'data-testid': dataTestIds.employeesPage.newQualificationExpDatePicker,
                        },
                      },
                    }}
                    value={value || null}
                  />
                </LocalizationProvider>
              )}
            />

            {/*<Controller*/}
            {/*  name="newLicenseExpirationDate"*/}
            {/*  control={control}*/}
            {/*  render={({ field }) => (*/}
            {/*    <TextField*/}
            {/*      {...field}*/}
            {/*      fullWidth*/}
            {/*      size="small"*/}
            {/*      label="Expiration date"*/}
            {/*      data-testid={dataTestIds.employeesPage.newQualificationTypeDropdown}*/}
            {/*      error={errors.qualification}*/}
            {/*      helperText={errors.qualification ? 'Please select a qualification' : null}*/}
            {/*      onChange={(e) => field.onChange(e.target.value ?? undefined)}*/}
            {/*      value={field.value || null}*/}
            {/*    />*/}
            {/*  )}*/}
            {/*/>*/}
          </Stack>

          <RoundedButton data-testid={dataTestIds.employeesPage.addQualificationButton} onClick={handleAddLicense}>
            Add
          </RoundedButton>

          {errors.duplicateLicense && (
            <Typography color="error" variant="body2" mt={1} mx={1}>{`License already exists.`}</Typography>
          )}
        </Card>
      </Stack>
    </FormControl>
  );
}
