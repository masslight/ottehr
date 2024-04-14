import { Box, useTheme } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid-pro';
import { BatchInputGetRequest } from '@zapehr/sdk';
import { Appointment, Bundle, Location, Patient, RelatedPerson } from 'fhir/r4';
import { ReactElement, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { convertFhirNameToDisplayName } from 'ehr-utils';
import { formatDateUsingSlashes } from '../helpers/formatDateTime';
import { standardizePhoneNumber } from '../helpers/formatPhoneNumber';
import { useApiClients } from '../hooks/useAppClients';
import { MAX_RESULTS } from '../pages/Patients';
import CustomTable, { dateTimeEqualsOperator } from './CustomTable';

interface PatientsTableProps {
  fhirPatients: Patient[] | null;
  relatedPersons: RelatedPerson[] | null;
  total: number;
  patientsLoading: boolean;
}

interface PatientRow {
  id: string | undefined;
  patient: string | undefined;
  dateOfBirth: string | undefined;
  phone: string | undefined;
  lastVisit?: string;
  lastOffice?: string;
}

export default function PatientsTable({
  fhirPatients,
  relatedPersons,
  total,
  patientsLoading,
}: PatientsTableProps): ReactElement {
  const { fhirClient } = useApiClients();
  const theme = useTheme();

  const [patientRows, setPatientRows] = useState<PatientRow[] | null>(null);
  const [rowsLoading, setRowsLoading] = useState<boolean>(false);
  const [locations, setLocations] = useState<Location[]>();

  const emptyMessage = 'There are no patients. Please update the search filters above.';
  const narrowSearchMessage = `You have reached the limit of ${MAX_RESULTS} results. Please update the search filters above to narrow your search.`;

  const columns: GridColDef[] = [
    {
      field: 'patient',
      headerName: 'Patient',
      renderCell: (params) => (
        <Link to={`/patient/${params.id}`} style={{ textDecoration: 'none', color: theme.palette.primary.main }}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'dateOfBirth',
      headerName: 'DOB',
      filterOperators: [dateTimeEqualsOperator],
      valueFormatter: ({ value }) => (value ? formatDateUsingSlashes(value) : '-'),
    },
    {
      field: 'phone',
      headerName: 'Phone',
      valueFormatter: ({ value }) => (value ? value : '-'),
    },
    {
      field: 'lastVisit',
      headerName: 'Last visit',
      filterOperators: [dateTimeEqualsOperator],
      valueFormatter: ({ value }) => (value ? formatDateUsingSlashes(value) : '-'),
    },
    {
      field: 'lastOffice',
      headerName: 'Last Office',
      valueFormatter: ({ value }) => (value ? value : '-'),
    },
  ];

  // Get Location info
  useEffect(() => {
    async function getLocations(): Promise<void> {
      const locationResults = await fhirClient?.searchResources<Location>({
        resourceType: 'Location',
        searchParams: [{ name: '_elements', value: 'id,address' }],
      });
      setLocations(locationResults);
    }

    getLocations().catch((error) => {
      console.log(error);
    });
  }, [fhirClient]);

  // Get all info for patient rows
  useEffect(() => {
    async function setPatientRowInfo(fhirPatients: Patient[] | null): Promise<void> {
      if (!fhirPatients) {
        setPatientRows(null);
        return;
      }

      const appointmentRequests: BatchInputGetRequest[] = [];

      // Get patient name, DOB
      const patientInfo = fhirPatients.reduce((accumulator: PatientRow[], fhirPatient) => {
        appointmentRequests.push({
          method: 'GET',
          url: `/Appointment?_tag=OTTEHR-UC&actor=Patient/${fhirPatient.id}&status=fulfilled&_elements=participant,start&_sort=date&_count=1`,
        });

        accumulator.push({
          id: fhirPatient.id,
          patient: fhirPatient.name && convertFhirNameToDisplayName(fhirPatient.name[0]),
          dateOfBirth: fhirPatient.birthDate,
          phone: standardizePhoneNumber(
            relatedPersons
              ?.find((rp) => rp.patient.reference === `Patient/${fhirPatient.id}`)
              ?.telecom?.find((telecom) => telecom.system === 'phone')?.value,
          ),
        });

        return accumulator;
      }, []);

      // Search for last appointments
      const appointments: Appointment[] = [];
      setRowsLoading(true);

      const bundle = await fhirClient?.batchRequest({
        requests: appointmentRequests,
      });
      const bundleAppointments =
        bundle?.entry?.map((entry) => {
          const innerBundle = entry?.resource && (entry.resource as Bundle);
          return innerBundle?.entry?.[0]?.resource as Appointment;
        }) || [];

      appointments.push(...bundleAppointments);

      // Get the patient's last visit and last office
      appointments.forEach((appointment) => {
        if (!appointment) {
          return;
        }

        const patientID = appointment.participant
          .find((participant) => participant.actor?.reference?.startsWith('Patient'))
          ?.actor?.reference?.replace('Patient/', '');
        const locationID = appointment.participant
          .find((participant) => participant.actor?.reference?.startsWith('Location'))
          ?.actor?.reference?.replace('Location/', '');
        const locationResource = locations?.find((location) => location.id === locationID);
        const locationState = locationResource?.address?.state;
        const locationCity = locationResource?.address?.city;

        const index = patientInfo.findIndex((info) => info.id === patientID);
        patientInfo[index] = {
          ...patientInfo[index],
          lastVisit: appointment.start,
          lastOffice: locationState && locationCity && `${locationState.toUpperCase()}-${locationCity}`,
        };
      });

      setRowsLoading(false);
      setPatientRows(patientInfo);
    }

    setPatientRowInfo(fhirPatients).catch((error) => {
      console.log(error);
      setRowsLoading(false);
    });
  }, [fhirClient, fhirPatients, locations, relatedPersons]);

  return (
    <>
      {patientRows && patientRows.length > 0 && patientRows.length < total && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {narrowSearchMessage}
        </Box>
      )}
      <CustomTable
        defaultSort={{ field: 'patient', sort: 'asc' }}
        emptyMessage={emptyMessage}
        isLoading={rowsLoading || patientsLoading}
        rows={patientRows}
        columns={columns}
      />
    </>
  );
}
