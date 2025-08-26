import CloseIcon from '@mui/icons-material/Close';
import {
  Dialog,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableCell,
  TableContainer,
  TableRow,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import { Patient } from 'fhir/r4';
import { FC, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { PROJECT_NAME } from 'utils';
import { ConfirmationDialog, ContainedPrimaryToggleButton } from '../../telemed';
import { RoundedButton } from '../RoundedButton';
import { useGetPatientsForMerge } from './queries';

type PatientFormValues = {
  birthGender?: 'male' | 'female' | 'other' | 'unknown';
  streetLine2?: string;
  lastName?: string;
  streetLine1?: string;
  deceased?: boolean;
  ethnicity?: string;
  city?: string;
  sendMarketingMessages?: boolean;
  responsiblePartyBirthSex?: 'male' | 'female' | 'other' | 'unknown';
  responsiblePartyRelationship?: string;
  language?: string;
  genderIdentity?: string;
  id?: string;
  preferredName?: string;
  state?: string;
  pcp?: string;
  email?: string;
  parentGuardianPhone?: string;
  zip?: string;
  responsiblePartyFirstName?: string;
  hearingImpairedRelayService?: boolean;
  responsiblePartyLastName?: string;
  race?: string;
  parentGuardianRelationship?: string;
  photo?: string;
  active?: boolean;
  fillingOutAs?: string;
  responsiblePartyPhone?: string;
  responsiblePartyEmail?: string;
  commonWellConsent?: boolean;
  pointOfDiscovery?: string;
  sexualOrientation?: string;
  firstName?: string;
  sendStatements?: string;
  excludeFromCollections?: boolean;
  parentGuardianEmail?: string;
  phone?: string;
  dob?: string;
  middleName?: string;
  pronouns?: string;
  responsiblePartyDob?: string;
};

type FormValues = Record<keyof PatientFormValues, string>;

const mapPatientResourceToFormValues = (patient: Patient): PatientFormValues => {
  const officialName = patient.name?.find((name) => name.use !== 'nickname'); // name.use === 'official'
  const preferredName = patient.name?.find((name) => name.use === 'nickname');
  const address = patient.address?.[0];
  const responsibleParty = patient.contact?.[0];

  return {
    id: patient.id,
    photo: patient.photo?.[0]?.url,
    firstName: officialName?.given?.[0],
    middleName: officialName?.given?.[1],
    lastName: officialName?.family,
    preferredName: preferredName?.given?.[0],
    birthGender: patient.gender,
    genderIdentity: patient.extension?.find(
      (extension) => extension.url === 'http://hl7.org/fhir/StructureDefinition/individual-genderIdentity'
    )?.valueString,
    pronouns: patient.extension?.find(
      (extension) => extension.url === 'http://hl7.org/fhir/StructureDefinition/individual-pronouns'
    )?.valueString,
    dob: patient.birthDate,
    streetLine1: address?.line?.[0],
    streetLine2: address?.line?.[1],
    city: address?.city,
    state: address?.state,
    zip: address?.postalCode,
    fillingOutAs: patient.extension?.find(
      (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/filling-out-as'
    )?.valueString,
    email: patient.telecom?.find((telecom) => telecom.system === 'email')?.value,
    phone: patient.telecom?.find((telecom) => telecom.system === 'phone')?.value,
    responsiblePartyFirstName: responsibleParty?.name?.given?.[0],
    responsiblePartyLastName: responsibleParty?.name?.family,
    responsiblePartyDob: responsibleParty?.extension?.find(
      (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/birth-date'
    )?.valueString,
    responsiblePartyBirthSex: responsibleParty?.gender,
    responsiblePartyPhone: responsibleParty?.telecom?.find(
      (telecom) => telecom.system === 'phone' && telecom.use === 'mobile'
    )?.value,
    responsiblePartyEmail: responsibleParty?.telecom?.find((telecom) => telecom.system === 'email')?.value,
    responsiblePartyRelationship: responsibleParty?.relationship
      ?.find(
        (relationship) =>
          relationship.coding?.find(
            (coding) => coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0131' && coding.code === 'BP'
          )
      )
      ?.coding?.find(
        (coding) => coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0131' && coding.code === 'BP'
      )?.display,
    parentGuardianEmail: responsibleParty?.telecom?.find((telecom) => telecom.system === 'email')?.value,
    parentGuardianPhone: responsibleParty?.telecom?.find((telecom) => telecom.system === 'phone')?.value,
    parentGuardianRelationship: responsibleParty?.relationship
      ?.find(
        (relationship) =>
          relationship.coding?.find(
            (coding) =>
              coding.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship' &&
              coding.code === 'Parent/Guardian'
          )
      )
      ?.coding?.find(
        (coding) =>
          coding.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship' &&
          coding.code === 'Parent/Guardian'
      )?.display,
    ethnicity: patient.extension
      ?.find((extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/ethnicity')
      ?.valueCodeableConcept?.coding?.find((coding) => coding.system === 'http://hl7.org/fhir/v3/Ethnicity')?.display,
    race: patient.extension
      ?.find((extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/race')
      ?.valueCodeableConcept?.coding?.find((coding) => coding.system === 'http://hl7.org/fhir/v3/Race')?.display,
    sexualOrientation: patient.extension?.find(
      (extension) => extension.url === 'http://hl7.org/fhir/us/cdmh/StructureDefinition/cdmh-patient-sexualOrientation'
    )?.valueString,
    pcp: patient.contained?.[0]?.id, // TODO: change to name
    pointOfDiscovery: patient.extension?.find(
      (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/point-of-discovery'
    )?.valueString,
    sendMarketingMessages: patient.extension?.find(
      (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/send-marketing'
    )?.valueBoolean,
    hearingImpairedRelayService: patient.extension?.find(
      (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/hearing-impaired-relay-service'
    )?.valueBoolean,
    commonWellConsent: patient.extension?.find(
      (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/common-well-consent'
    )?.valueBoolean,
    language: patient.communication?.find((communication) => communication.preferred)?.language?.coding?.[0]?.display,
    active: patient.active,
    sendStatements: patient.extension?.find(
      (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/send-statements'
    )?.valueString,
    excludeFromCollections: patient.extension?.find(
      (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/exclude-from-collections'
    )?.valueBoolean,
    deceased: patient.deceasedBoolean,
  };
};

type Row = {
  title: string;
  field: keyof PatientFormValues;
  render: (patient: PatientFormValues) => string;
};

const rows: Row[] = [
  {
    title: 'Photo',
    field: 'photo',
    render: (patient) => patient.photo || '-',
  },
  {
    title: 'Patient first name',
    field: 'firstName',
    render: (patient) => patient.firstName || '-',
  },
  {
    title: 'Patient middle name',
    field: 'middleName',
    render: (patient) => patient.middleName || '-',
  },
  {
    title: 'Patient last name',
    field: 'lastName',
    render: (patient) => patient.lastName || '-',
  },
  {
    title: 'Patient preferred name',
    field: 'preferredName',
    render: (patient) => patient.preferredName || '-',
  },
  {
    title: 'Birth gender',
    field: 'birthGender',
    render: (patient) => patient.birthGender || '-',
  },
  {
    title: 'Gender identity',
    field: 'genderIdentity',
    render: (patient) => patient.genderIdentity || '-',
  },
  {
    title: 'Pronouns',
    field: 'pronouns',
    render: (patient) => patient.pronouns || '-',
  },
  {
    title: 'Date of Birth',
    field: 'dob',
    render: (patient) => patient.dob || '-',
  },
  {
    title: 'Street Address',
    field: 'streetLine1',
    render: (patient) => patient.streetLine1 || '-',
  },
  {
    title: 'Street Address line 2',
    field: 'streetLine2',
    render: (patient) => patient.streetLine2 || '-',
  },
  {
    title: 'City',
    field: 'city',
    render: (patient) => patient.city || '-',
  },
  {
    title: 'State',
    field: 'state',
    render: (patient) => patient.state || '-',
  },
  {
    title: 'ZIP',
    field: 'zip',
    render: (patient) => patient.zip || '-',
  },
  {
    title: 'Filling Out Information (Self/Guardian)',
    field: 'fillingOutAs',
    render: (patient) => patient.fillingOutAs || '-',
  },
  {
    title: 'Patient Email',
    field: 'email',
    render: (patient) => patient.email || '-',
  },
  {
    title: 'Patient Mobile',
    field: 'phone',
    render: (patient) => patient.phone || '-',
  },
  {
    title: 'Responsible party first name',
    field: 'responsiblePartyFirstName',
    render: (patient) => patient.responsiblePartyFirstName || '-',
  },
  {
    title: 'Responsible party last name',
    field: 'responsiblePartyLastName',
    render: (patient) => patient.responsiblePartyLastName || '-',
  },
  {
    title: 'Responsible party Date of Birth',
    field: 'responsiblePartyDob',
    render: (patient) => patient.responsiblePartyDob || '-',
  },
  {
    title: 'Responsible party Birth sex',
    field: 'responsiblePartyBirthSex',
    render: (patient) => patient.responsiblePartyBirthSex || '-',
  },
  {
    title: 'Responsible party number',
    field: 'responsiblePartyPhone',
    render: (patient) => patient.responsiblePartyPhone || '-',
  },
  {
    title: 'Responsible party email',
    field: 'responsiblePartyEmail',
    render: (patient) => patient.responsiblePartyEmail || '-',
  },
  {
    title: 'Responsible party relationship',
    field: 'responsiblePartyRelationship',
    render: (patient) => patient.responsiblePartyRelationship || '-',
  },
  {
    title: 'Parent/Guardian Email',
    field: 'parentGuardianEmail',
    render: (patient) => patient.parentGuardianEmail || '-',
  },
  {
    title: 'Parent/Guardian Mobile',
    field: 'parentGuardianPhone',
    render: (patient) => patient.parentGuardianPhone || '-',
  },
  {
    title: 'Parent/Guardian relationship',
    field: 'parentGuardianRelationship',
    render: (patient) => patient.parentGuardianRelationship || '-',
  },
  {
    title: 'Ethnicity',
    field: 'ethnicity',
    render: (patient) => patient.ethnicity || '-',
  },
  {
    title: 'Race',
    field: 'race',
    render: (patient) => patient.race || '-',
  },
  {
    title: 'Sexual orientation',
    field: 'sexualOrientation',
    render: (patient) => patient.sexualOrientation || '-',
  },
  {
    title: 'Primary Care Physician',
    field: 'pcp',
    render: (patient) => patient.pcp || '-',
  },
  {
    title: `How did patient heard about ${PROJECT_NAME}`,
    field: 'pointOfDiscovery',
    render: (patient) => patient.pointOfDiscovery || '-',
  },
  {
    title: 'Send marketing messages',
    field: 'sendMarketingMessages',
    render: (patient) =>
      typeof patient.sendMarketingMessages === 'boolean' ? (patient.sendMarketingMessages ? 'Yes' : 'No') : '-',
  },
  {
    title: 'Hearing impaired relay service',
    field: 'hearingImpairedRelayService',
    render: (patient) =>
      typeof patient.hearingImpairedRelayService === 'boolean'
        ? patient.hearingImpairedRelayService
          ? 'Yes'
          : 'No'
        : '-',
  },
  {
    title: 'CommonWell consent',
    field: 'commonWellConsent',
    render: (patient) =>
      typeof patient.commonWellConsent === 'boolean' ? (patient.commonWellConsent ? 'Yes' : 'No') : '-',
  },
  {
    title: 'Language',
    field: 'language',
    render: (patient) => patient.language || '-',
  },
  {
    title: 'Active',
    field: 'active',
    render: (patient) => (typeof patient.active === 'boolean' ? (patient.active ? 'Yes' : 'No') : '-'),
  },
  {
    title: 'Send statements',
    field: 'sendStatements',
    render: (patient) => patient.sendStatements || '-',
  },
  {
    title: 'Exclude from collections',
    field: 'excludeFromCollections',
    render: (patient) =>
      typeof patient.excludeFromCollections === 'boolean' ? (patient.excludeFromCollections ? 'Yes' : 'No') : '-',
  },
  {
    title: 'Deceased',
    field: 'deceased',
    render: (patient) => (typeof patient.deceased === 'boolean' ? (patient.deceased ? 'Yes' : 'No') : '-'),
  },
];

type PatientMergeDifferenceProps = {
  open: boolean;
  close: () => void;
  back: () => void;
  patientIds?: string[];
};

export const PatientsMergeDifference: FC<PatientMergeDifferenceProps> = (props) => {
  const { open, close, back, patientIds } = props;

  const { isLoading } = useGetPatientsForMerge({ patientIds }, (data) => {
    const patients = data as unknown as Patient[];
    const parsedPatients = patients.map((patient) => mapPatientResourceToFormValues(patient));
    const mainPatient = patients[0] as Patient;

    setPatients(patients);
    setParsedPatients(parsedPatients);
    setParsedRows(
      rows.map((row) => ({
        ...row,
        different: !parsedPatients.every((patient) => patient[row.field] === parsedPatients[0][row.field]),
      }))
    );
    setMainPatient(mainPatient?.id);
    reset(
      rows.reduce((previousValue, currentValue) => {
        previousValue[currentValue.field] = mainPatient?.id;
        return previousValue;
      }, {} as Partial<FormValues>)
    );
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [parsedPatients, setParsedPatients] = useState<PatientFormValues[]>([]);
  const [parsedRows, setParsedRows] = useState<(Row & { different: boolean })[]>([]);
  const [mainPatient, setMainPatient] = useState<string | undefined>(undefined);
  const [showVariant, setShowVariant] = useState<'different' | 'all'>('different');
  const theme = useTheme();
  const methods = useForm<FormValues>();
  const { control, handleSubmit, reset, getValues } = methods;

  const lightBackground = `${theme.palette.primary.main}0A`;

  const onSave = (values: FormValues): void => {
    console.log(values);
    close();
  };

  const changeMainPatient = (id: string): void => {
    setMainPatient(id);
    reset(
      rows.reduce((previousValue, currentValue) => {
        previousValue[currentValue.field] = id;
        return previousValue;
      }, {} as Partial<FormValues>)
    );
  };

  const removePatient = (id: string): void => {
    const newPatients = patients.filter((patient) => patient.id !== id);
    const newParsedPatients = newPatients.map((patient) => mapPatientResourceToFormValues(patient));
    const newMainPatient = (mainPatient === id ? newPatients[0].id : mainPatient) as string;

    if (mainPatient === id) {
      setMainPatient(newPatients[0].id);
    }
    setPatients(newPatients);
    setParsedPatients(newParsedPatients);
    setParsedRows(
      rows.map((row) => ({
        ...row,
        different: !newParsedPatients.every((patient) => patient[row.field] === newParsedPatients[0][row.field]),
      }))
    );

    const values = getValues();
    rows.forEach((row) => {
      if (values[row.field] === id) {
        values[row.field] = newMainPatient;
      }
    });
    reset(values);
  };

  return (
    <FormProvider {...methods}>
      <Dialog open={open} onClose={close} maxWidth="lg" fullWidth>
        <IconButton size="small" onClick={close} sx={{ position: 'absolute', right: 16, top: 16 }}>
          <CloseIcon fontSize="small" />
        </IconButton>

        <Stack spacing={2} sx={{ p: 3 }}>
          <Stack spacing={1}>
            <Typography variant="h4" color="primary.dark">
              Merge Patients
            </Typography>
            <Typography>
              Please select which information should carry over to the Main Patient record after merge. All other
              patient records will be removed.
            </Typography>
          </Stack>

          <ToggleButtonGroup
            size="small"
            exclusive
            value={showVariant}
            onChange={(_, newValue) => newValue && setShowVariant(newValue)}
          >
            <ContainedPrimaryToggleButton value="different">Only Different Info</ContainedPrimaryToggleButton>
            <ContainedPrimaryToggleButton value="all">All Info</ContainedPrimaryToggleButton>
          </ToggleButtonGroup>

          <TableContainer sx={{ maxHeight: '60vh' }}>
            <Table size="small">
              <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold' } }}>
                <TableCell variant="head">Parameter</TableCell>
                {parsedPatients.map((patient) => (
                  <TableCell
                    variant="head"
                    key={patient.id}
                    sx={{
                      backgroundColor: patient.id === mainPatient ? lightBackground : undefined,
                    }}
                  >
                    PID: {patient.id}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Main Patient Record</TableCell>
                {parsedPatients.map((patient) => (
                  <TableCell
                    key={patient.id}
                    sx={{
                      backgroundColor: patient.id === mainPatient ? lightBackground : undefined,
                    }}
                  >
                    <RadioGroup row value={mainPatient} onChange={(e) => changeMainPatient(e.target.value)}>
                      <FormControlLabel value={patient.id} control={<Radio />} label="" />
                    </RadioGroup>
                  </TableCell>
                ))}
              </TableRow>
              {parsedRows
                .filter((row) => (showVariant === 'all' ? true : row.different))
                .map((row) => (
                  <TableRow key={row.title}>
                    <TableCell>{row.title}</TableCell>
                    {parsedPatients.map((patient) => (
                      <TableCell
                        key={patient.id}
                        sx={{
                          backgroundColor: patient.id === mainPatient ? lightBackground : undefined,
                        }}
                      >
                        <Controller
                          render={({ field: { onChange, value } }) => (
                            <RadioGroup row value={value} onChange={onChange}>
                              <FormControlLabel value={patient.id} control={<Radio />} label={row.render(patient)} />
                            </RadioGroup>
                          )}
                          name={row.field}
                          control={control}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              <TableRow>
                <TableCell>Remove from merge</TableCell>
                {parsedPatients.map((patient) => (
                  <TableCell
                    key={patient.id}
                    sx={{
                      backgroundColor: patient.id === mainPatient ? lightBackground : undefined,
                    }}
                  >
                    <RoundedButton
                      disabled={patients.length < 3}
                      variant="text"
                      color="error"
                      onClick={() => removePatient(patient.id!)}
                    >
                      Remove
                    </RoundedButton>
                  </TableCell>
                ))}
              </TableRow>
            </Table>
          </TableContainer>

          <Stack direction="row" spacing={2} justifyContent="space-between">
            <RoundedButton onClick={back}>Cancel</RoundedButton>
            <ConfirmationDialog
              title="Merge Patients"
              description={
                <Stack spacing={2}>
                  <Typography>
                    Are you sure you want to merge patient records? Merged records will be deactivated.
                  </Typography>
                  <Stack>
                    <Typography fontWeight={600}>Merged patient record PIDs:</Typography>
                    {patients
                      .filter((patient) => patient.id !== mainPatient)
                      .map((patient) => (
                        <Typography key={patient.id}>{patient.id}</Typography>
                      ))}
                  </Stack>
                  <Stack>
                    <Typography fontWeight={600}>Main patient record PID:</Typography>
                    <Typography>{mainPatient}</Typography>
                  </Stack>
                </Stack>
              }
              response={handleSubmit(onSave)}
              actionButtons={{
                proceed: {
                  text: 'Confirm Merge',
                },
                back: {
                  text: 'Back',
                },
                reverse: true,
              }}
            >
              {(showDialog) => (
                <RoundedButton variant="contained" onClick={showDialog} disabled={isLoading}>
                  Merge Patients
                </RoundedButton>
              )}
            </ConfirmationDialog>
          </Stack>
        </Stack>
      </Dialog>
    </FormProvider>
  );
};
