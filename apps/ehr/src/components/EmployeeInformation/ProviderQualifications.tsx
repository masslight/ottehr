import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  FormControl,
  FormLabel,
  Grid,
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import { Control, Controller } from 'react-hook-form';
import { Autocomplete, TextField } from '@mui/material';
import { PractitionerLicense, PractitionerQualificationCodesLabels } from 'utils';
import { AllStates } from '../../types/types';
import { FormErrors } from './types';
import { dataTestIds } from '../../constants/data-test-ids';

const displaystates = AllStates.map((state) => state.value);

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
      <Box mt={1}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>State</TableCell>
                <TableCell align="left">Qualification</TableCell>
                <TableCell align="left">Operate in state</TableCell>
                <TableCell align="left">Delete License</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {newLicenses.map((license, index) => (
                <TableRow key={index}>
                  <TableCell>{license.state}</TableCell>
                  <TableCell align="left">{license.code}</TableCell>
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
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            data-testid={dataTestIds.employeesPage.addQualificationAccordion}
            sx={{
              marginTop: '20px',
              fontWeight: 'bold',
              color: 'primary.main',
              cursor: 'pointer',
            }}
          >
            Add New State Qualification
          </AccordionSummary>
          <AccordionDetails>
            <Grid container direction={'row'} spacing={1}>
              <Grid item xs={4}>
                <Controller
                  name="newLicenseState"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
                      options={displaystates}
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
              </Grid>
              <Grid item xs={4}>
                <Controller
                  name="newLicenseCode"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      {...field}
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
              </Grid>
              <Grid item xs={4} alignContent={'center'}>
                <Button
                  variant="contained"
                  endIcon={<AddIcon />}
                  data-testid={dataTestIds.employeesPage.addQualificationButton}
                  sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 28 }}
                  fullWidth
                  onClick={handleAddLicense}
                >
                  Add
                </Button>
              </Grid>
              {errors.duplicateLicense && (
                <Typography color="error" variant="body2" mt={1} mx={1}>{`License already exists.`}</Typography>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Box>
    </FormControl>
  );
}
