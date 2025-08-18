"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimsQueueFilters = void 0;
var Search_1 = require("@mui/icons-material/Search");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_query_1 = require("react-query");
var utils_1 = require("utils");
var api_1 = require("../../../api/api");
var useAppClients_1 = require("../../../hooks/useAppClients");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var state_1 = require("../../state");
var components_1 = require("../claim/modals/components");
var ClaimsQueueFilters = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useClaimsQueueStore, [
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
    ]), employees = _a.employees, teamMember = _a.teamMember, facilities = _a.facilities, facility = _a.facility, facilityGroup = _a.facilityGroup, organizations = _a.organizations, patient = _a.patient, visitId = _a.visitId, insurance = _a.insurance, insurancePlans = _a.insurancePlans;
    var _b = (0, react_1.useState)(patient || ''), patientValue = _b[0], setPatientValue = _b[1];
    var _c = (0, react_1.useState)(visitId || ''), visitIdValue = _c[0], setVisitIdValue = _c[1];
    var patientDebounce = (0, telemed_1.useDebounce)().debounce;
    var visitIdDebounce = (0, telemed_1.useDebounce)().debounce;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    (0, react_1.useEffect)(function () {
        if (!patient) {
            setPatientValue('');
        }
    }, [patient, setPatientValue]);
    (0, react_1.useEffect)(function () {
        if (!visitId) {
            setVisitIdValue('');
        }
    }, [visitId, setVisitIdValue]);
    (0, react_query_1.useQuery)(['rcm-get-employees', { oystehrZambda: oystehrZambda }], function () { return (oystehrZambda ? (0, api_1.getEmployees)(oystehrZambda) : null); }, {
        onSuccess: function (response) {
            console.log('Employees', response === null || response === void 0 ? void 0 : response.employees);
            state_1.useClaimsQueueStore.setState({ employees: (response === null || response === void 0 ? void 0 : response.employees) || [] });
        },
        enabled: !!oystehrZambda,
    });
    (0, state_1.useGetOrganizations)(function (data) {
        console.log('Organizations', data);
        state_1.useClaimsQueueStore.setState({ organizations: data });
    });
    (0, state_1.useGetFacilities)(function (data) {
        console.log('Facilities', data);
        state_1.useClaimsQueueStore.setState({ facilities: data });
    });
    (0, state_1.useGetInsurancePlans)(function (data) {
        console.log('Insurance plans', data);
        state_1.useClaimsQueueStore.setState({ insurancePlans: data });
    });
    var currentTeamMember = (0, react_1.useMemo)(function () { return employees.find(function (employee) { return employee.profile === teamMember; }); }, [employees, teamMember]);
    var currentFacility = (0, react_1.useMemo)(function () { return facilities.find(function (f) { return f.id === facility; }); }, [facilities, facility]);
    var allFacilities = (0, react_1.useMemo)(function () {
        return facilities.filter(function (facility) {
            var _a;
            return facility.managingOrganization &&
                ((_a = facility.extension) === null || _a === void 0 ? void 0 : _a.find(function (extension) {
                    var _a;
                    return extension.url === utils_1.FHIR_EXTENSION.Location.locationFormPreRelease.url &&
                        ((_a = extension.valueCoding) === null || _a === void 0 ? void 0 : _a.code) === 'vi';
                }));
        });
    }, [facilities]);
    var currentGroup = (0, react_1.useMemo)(function () { return organizations.find(function (o) { return o.id === facilityGroup; }); }, [organizations, facilityGroup]);
    var allFacilityGroups = (0, react_1.useMemo)(function () {
        return organizations.filter(function (organization) {
            var _a;
            return (_a = organization.type) === null || _a === void 0 ? void 0 : _a.find(function (type) {
                var _a;
                return (_a = type.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === utils_1.FHIR_EXTENSION.Organization.organizationType.url && coding.code === 'prov'; });
            });
        });
    }, [organizations]);
    var currentInsurancePlan = (0, react_1.useMemo)(function () { return insurancePlans.find(function (i) { return i.name === insurance; }); }, [insurancePlans, insurance]);
    return (<material_1.Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <material_1.Box sx={{ display: 'flex', gap: 1 }}>
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

        <material_1.TextField value={patientValue} onChange={function (e) {
            setPatientValue(e.target.value);
            patientDebounce(function () { return state_1.useClaimsQueueStore.setState({ patient: e.target.value.trim() }); });
        }} size="small" fullWidth label="Patient ID" placeholder="PID" InputProps={{
            endAdornment: (<material_1.InputAdornment position="end">
                <Search_1.default fontSize="small"/>
              </material_1.InputAdornment>),
        }}/>

        <material_1.TextField value={visitIdValue} onChange={function (e) {
            setVisitIdValue(e.target.value);
            visitIdDebounce(function () { return state_1.useClaimsQueueStore.setState({ visitId: e.target.value.trim() }); });
        }} size="small" fullWidth label="Visit ID" placeholder="VID" InputProps={{
            endAdornment: (<material_1.InputAdornment position="end">
                <Search_1.default fontSize="small"/>
              </material_1.InputAdornment>),
        }}/>

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

        <components_1.VirtualizedAutocomplete value={currentTeamMember} onChange={function (employee) { return state_1.useClaimsQueueStore.setState({ teamMember: employee === null || employee === void 0 ? void 0 : employee.profile }); }} options={employees} clearable label="Team member" renderRow={function (employee) {
            if (employee.firstName && employee.lastName)
                return [employee.lastName, employee.firstName].join(', ');
            else if (employee.name)
                return employee.name;
            else
                return '-';
        }}/>

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
      </material_1.Box>

      <material_1.Box sx={{ display: 'flex', gap: 1 }}>
        {/*<StateFilter*/}
        {/*  value={claimsQueueState.state}*/}
        {/*  onChange={(value) => useClaimsQueueStore.setState({ state: value })}*/}
        {/*/>*/}

        <components_1.VirtualizedAutocomplete value={currentGroup} onChange={function (org) { return state_1.useClaimsQueueStore.setState({ facilityGroup: org === null || org === void 0 ? void 0 : org.id }); }} options={allFacilityGroups} clearable label="Facility group" renderRow={function (org) { return org.name || ''; }}/>

        <components_1.VirtualizedAutocomplete value={currentFacility} onChange={function (facility) { return state_1.useClaimsQueueStore.setState({ facility: facility === null || facility === void 0 ? void 0 : facility.id }); }} options={allFacilities} clearable label="Facility" renderRow={function (facility) { return facility.name || ''; }}/>

        <components_1.VirtualizedAutocomplete value={currentInsurancePlan} onChange={function (insurance) { return state_1.useClaimsQueueStore.setState({ insurance: insurance === null || insurance === void 0 ? void 0 : insurance.name }); }} options={insurancePlans} clearable label="Insurance" renderRow={function (insurance) { return insurance.name || ''; }}/>

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
      </material_1.Box>
    </material_1.Box>);
};
exports.ClaimsQueueFilters = ClaimsQueueFilters;
//# sourceMappingURL=ClaimsQueueFilters.js.map