import SearchIcon from '@mui/icons-material/Search';
import { Box, InputAdornment, TextField } from '@mui/material';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { FHIR_EXTENSION } from 'utils';
import { getEmployees } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useDebounce } from '../../../telemed';
import { useClaimsQueueStore, useGetFacilities, useGetInsurancePlans, useGetOrganizations } from '../../state';
import { VirtualizedAutocomplete } from '../claim/modals/components';

export const ClaimsQueueFilters: FC = () => {
  const {
    employees,
    teamMember,
    facilities,
    facility,
    facilityGroup,
    organizations,
    patient,
    visitId,
    insurance,
    insurancePlans,
  } = getSelectors(useClaimsQueueStore, [
    'employees',
    'teamMember',
    'facilities',
    'facility',
    'facilityGroup',
    'organizations',
    'patient',
    'visitId',
    'insurance',
    'insurancePlans',
  ]);

  const [patientValue, setPatientValue] = useState(patient || '');
  const [visitIdValue, setVisitIdValue] = useState(visitId || '');
  const { debounce: patientDebounce } = useDebounce();
  const { debounce: visitIdDebounce } = useDebounce();
  const { oystehrZambda } = useApiClients();

  useEffect(() => {
    if (!patient) {
      setPatientValue('');
    }
  }, [patient, setPatientValue]);

  useEffect(() => {
    if (!visitId) {
      setVisitIdValue('');
    }
  }, [visitId, setVisitIdValue]);

  useQuery(['rcm-get-employees', { oystehrZambda }], () => (oystehrZambda ? getEmployees(oystehrZambda) : null), {
    onSuccess: (response) => {
      console.log('Employees', response?.employees);
      useClaimsQueueStore.setState({ employees: response?.employees || [] });
    },
    enabled: !!oystehrZambda,
  });

  useGetOrganizations((data) => {
    console.log('Organizations', data);
    useClaimsQueueStore.setState({ organizations: data });
  });

  useGetFacilities((data) => {
    console.log('Facilities', data);
    useClaimsQueueStore.setState({ facilities: data });
  });

  useGetInsurancePlans((data) => {
    console.log('Insurance plans', data);
    useClaimsQueueStore.setState({ insurancePlans: data });
  });

  const currentTeamMember = useMemo(
    () => employees.find((employee) => employee.profile === teamMember),
    [employees, teamMember]
  );

  const currentFacility = useMemo(() => facilities.find((f) => f.id === facility), [facilities, facility]);

  const allFacilities = useMemo(
    () =>
      facilities.filter(
        (facility) =>
          facility.managingOrganization &&
          facility.extension?.find(
            (extension) =>
              extension.url === FHIR_EXTENSION.Location.locationFormPreRelease.url &&
              extension.valueCoding?.code === 'vi'
          )
      ),
    [facilities]
  );

  const currentGroup = useMemo(() => organizations.find((o) => o.id === facilityGroup), [organizations, facilityGroup]);

  const allFacilityGroups = useMemo(
    () =>
      organizations.filter(
        (organization) =>
          organization.type?.find(
            (type) =>
              type.coding?.find(
                (coding) => coding.system === FHIR_EXTENSION.Organization.organizationType.url && coding.code === 'prov'
              )
          )
      ),
    [organizations]
  );

  const currentInsurancePlan = useMemo(
    () => insurancePlans.find((i) => i.name === insurance),
    [insurancePlans, insurance]
  );

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {/*<TextField*/}
        {/*  size="small"*/}
        {/*  fullWidth*/}
        {/*  label="Patient Name"*/}
        {/*  placeholder="Name"*/}
        {/*  InputProps={{*/}
        {/*    endAdornment: (*/}
        {/*      <InputAdornment position="end">*/}
        {/*        <SearchIcon fontSize="small" />*/}
        {/*      </InputAdornment>*/}
        {/*    ),*/}
        {/*  }}*/}
        {/*/>*/}

        <TextField
          value={patientValue}
          onChange={(e) => {
            setPatientValue(e.target.value);
            patientDebounce(() => useClaimsQueueStore.setState({ patient: e.target.value.trim() }));
          }}
          size="small"
          fullWidth
          label="Patient ID"
          placeholder="PID"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          value={visitIdValue}
          onChange={(e) => {
            setVisitIdValue(e.target.value);
            visitIdDebounce(() => useClaimsQueueStore.setState({ visitId: e.target.value.trim() }));
          }}
          size="small"
          fullWidth
          label="Visit ID"
          placeholder="VID"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {/*<TextField*/}
        {/*  onChange={(e) => claimIdDebounce(() => useClaimsQueueStore.setState({ claimId: e.target.value.trim() }))}*/}
        {/*  size="small"*/}
        {/*  fullWidth*/}
        {/*  label="Claim ID"*/}
        {/*  placeholder="CID"*/}
        {/*  InputProps={{*/}
        {/*    endAdornment: (*/}
        {/*      <InputAdornment position="end">*/}
        {/*        <SearchIcon fontSize="small" />*/}
        {/*      </InputAdornment>*/}
        {/*    ),*/}
        {/*  }}*/}
        {/*/>*/}

        <VirtualizedAutocomplete
          value={currentTeamMember}
          onChange={(employee) => useClaimsQueueStore.setState({ teamMember: employee?.profile })}
          options={employees}
          clearable
          label="Team member"
          renderRow={(employee) => {
            if (employee.firstName && employee.lastName) return [employee.lastName, employee.firstName].join(', ');
            else if (employee.name) return employee.name;
            else return '-';
          }}
        />

        {/*<FormControl size="small" fullWidth>*/}
        {/*  <InputLabel>Queue</InputLabel>*/}
        {/*  <Select value={10} label="Queue">*/}
        {/*    <MenuItem value={10}>In Person</MenuItem>*/}
        {/*    <MenuItem value={20}>Telemedicine</MenuItem>*/}
        {/*  </Select>*/}
        {/*</FormControl>*/}

        {/*<FormControl size="small" fullWidth>*/}
        {/*  <InputLabel>Day in the queue</InputLabel>*/}
        {/*  <Select*/}
        {/*    value={claimsQueueState.dayInQueue}*/}
        {/*    onChange={(e) => useClaimsQueueStore.setState({ dayInQueue: e.target.value as number })}*/}
        {/*    label="Day in the queue"*/}
        {/*  >*/}
        {/*    <MenuItem value={1}>1 day</MenuItem>*/}
        {/*    <MenuItem value={2}>2 days</MenuItem>*/}
        {/*    <MenuItem value={3}>3 days</MenuItem>*/}
        {/*  </Select>*/}
        {/*</FormControl>*/}

        {/*<StatusFilter*/}
        {/*  value={claimsQueueState.status}*/}
        {/*  onChange={(value) => useClaimsQueueStore.setState({ status: value })}*/}
        {/*/>*/}
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        {/*<StateFilter*/}
        {/*  value={claimsQueueState.state}*/}
        {/*  onChange={(value) => useClaimsQueueStore.setState({ state: value })}*/}
        {/*/>*/}

        <VirtualizedAutocomplete
          value={currentGroup}
          onChange={(org) => useClaimsQueueStore.setState({ facilityGroup: org?.id })}
          options={allFacilityGroups}
          clearable
          label="Facility group"
          renderRow={(org) => org.name || ''}
        />

        <VirtualizedAutocomplete
          value={currentFacility}
          onChange={(facility) => useClaimsQueueStore.setState({ facility: facility?.id })}
          options={allFacilities}
          clearable
          label="Facility"
          renderRow={(facility) => facility.name || ''}
        />

        <VirtualizedAutocomplete
          value={currentInsurancePlan}
          onChange={(insurance) => useClaimsQueueStore.setState({ insurance: insurance?.name })}
          options={insurancePlans}
          clearable
          label="Insurance"
          renderRow={(insurance) => insurance.name || ''}
        />

        {/*<TextField*/}
        {/*  onChange={(e) => balanceDebounce(() => useClaimsQueueStore.setState({ balance: +e.target.value }))}*/}
        {/*  inputProps={{ type: 'number' }}*/}
        {/*  size="small"*/}
        {/*  fullWidth*/}
        {/*  label="Balance due, more than $... "*/}
        {/*/>*/}

        {/*<LocalizationProvider dateAdapter={AdapterLuxon}>*/}
        {/*  <DatePicker*/}
        {/*    label="DOS - from"*/}
        {/*    onChange={(value) => useClaimsQueueStore.setState({ dosFrom: value?.toISO() || undefined })}*/}
        {/*    inputFormat="MM.dd.yyyy"*/}
        {/*    value={dosFrom ? DateTime.fromISO(dosFrom || '') || null : null}*/}
        {/*    renderInput={(params) => (*/}
        {/*      <TextField*/}
        {/*        fullWidth*/}
        {/*        size="small"*/}
        {/*        {...params}*/}
        {/*        error={false}*/}
        {/*        inputProps={{*/}
        {/*          ...params.inputProps,*/}
        {/*          placeholder: 'MM.DD.YYYY',*/}
        {/*        }}*/}
        {/*      />*/}
        {/*    )}*/}
        {/*  />*/}

        {/*  <DatePicker*/}
        {/*    label="DOS - to"*/}
        {/*    onChange={(value) => useClaimsQueueStore.setState({ dosTo: value?.toISO() || undefined })}*/}
        {/*    inputFormat="MM.dd.yyyy"*/}
        {/*    value={dosTo ? DateTime.fromISO(dosTo || '') || null : null}*/}
        {/*    renderInput={(params) => (*/}
        {/*      <TextField*/}
        {/*        fullWidth*/}
        {/*        size="small"*/}
        {/*        {...params}*/}
        {/*        error={false}*/}
        {/*        inputProps={{*/}
        {/*          ...params.inputProps,*/}
        {/*          placeholder: 'MM.DD.YYYY',*/}
        {/*        }}*/}
        {/*      />*/}
        {/*    )}*/}
        {/*  />*/}
        {/*</LocalizationProvider>*/}
      </Box>
    </Box>
  );
};
