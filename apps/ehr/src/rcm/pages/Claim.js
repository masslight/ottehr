"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Claim = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var CustomBreadcrumbs_1 = require("../../components/CustomBreadcrumbs");
var getSelectors_1 = require("../../shared/store/getSelectors");
var features_1 = require("../features");
var state_1 = require("../state");
var utils_2 = require("../utils");
var Claim = function () {
    var _a, _b, _c;
    var id = (0, react_router_dom_1.useParams)().id;
    var _d = (0, getSelectors_1.getSelectors)(state_1.useClaimStore, [
        'patientData',
        'coverageData',
        'additionalCoverageData',
        'claimData',
        'setResources',
        'setPlansOwnedBy',
        'plansOwnedBy',
        'additionalCoverage',
    ]), patientData = _d.patientData, coverageData = _d.coverageData, additionalCoverageData = _d.additionalCoverageData, claimData = _d.claimData, setResources = _d.setResources, setPlansOwnedBy = _d.setPlansOwnedBy, plansOwnedBy = _d.plansOwnedBy, additionalCoverage = _d.additionalCoverage;
    var isLoading = (0, state_1.useGetClaim)({ claimId: id }, function (data) {
        console.log(data);
        setResources(data);
    }).isLoading;
    var insurancePlans = (0, state_1.useGetInsurancePlans)(function (data) {
        console.log('Insurance plans', data);
    }).data;
    var organizations = (0, state_1.useGetOrganizations)(function (data) {
        console.log('Organizations', data);
    }).data;
    (0, react_1.useEffect)(function () {
        if (insurancePlans && organizations) {
            setPlansOwnedBy(insurancePlans, organizations);
        }
    }, [insurancePlans, organizations, setPlansOwnedBy]);
    (0, state_1.useGetFacilities)(function (data) {
        console.log('Facilities', data);
        state_1.useClaimStore.setState({ facilities: data });
    });
    (0, react_1.useEffect)(function () {
        state_1.useClaimStore.setState({
            claim: undefined,
            claimData: undefined,
            patient: undefined,
            patientData: undefined,
            appointment: undefined,
            coverage: undefined,
            coverageData: undefined,
            additionalCoverage: undefined,
            additionalCoverageData: undefined,
            encounter: undefined,
            subscriber: undefined,
            additionalSubscriber: undefined,
            insurancePlans: undefined,
            organizations: undefined,
            plansOwnedBy: undefined,
            facilities: undefined,
            visitNoteDocument: undefined,
        });
    }, []);
    var planNamePayerId = (0, react_1.useMemo)(function () {
        var _a, _b, _c;
        if (!plansOwnedBy || !(coverageData === null || coverageData === void 0 ? void 0 : coverageData.organizationId) || !(coverageData === null || coverageData === void 0 ? void 0 : coverageData.planName)) {
            return;
        }
        var plan = plansOwnedBy === null || plansOwnedBy === void 0 ? void 0 : plansOwnedBy.find(function (item) { var _a; return ((_a = item.ownedBy) === null || _a === void 0 ? void 0 : _a.id) === coverageData.organizationId && item.name === coverageData.planName; });
        if (!plan) {
            return;
        }
        var payerId = (_c = (_b = (_a = plan.ownedBy) === null || _a === void 0 ? void 0 : _a.identifier) === null || _b === void 0 ? void 0 : _b.find(function (identifier) {
            var _a, _b;
            return !!((_b = (_a = identifier.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.code === 'XX' && coding.system === utils_1.FHIR_EXTENSION.Organization.v2_0203.url; }));
        })) === null || _c === void 0 ? void 0 : _c.value;
        return "".concat(coverageData.planName, " ").concat(payerId);
    }, [plansOwnedBy, coverageData === null || coverageData === void 0 ? void 0 : coverageData.planName, coverageData === null || coverageData === void 0 ? void 0 : coverageData.organizationId]);
    if (isLoading) {
        return (<material_1.CircularProgress sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}/>);
    }
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
        }}>
      <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            p: 3,
            gap: 3,
        }}>
        <CustomBreadcrumbs_1.default chain={[
            { link: '/rcm/claims?type=registration', children: 'Registration' },
            { link: '#', children: id || <material_1.Skeleton width={150}/> },
        ]}/>

        <features_1.ClaimHeader />

        <material_1.Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            <features_1.ClaimListCard title="Patient information" items={[
            { label: '2.First name', value: patientData === null || patientData === void 0 ? void 0 : patientData.firstName },
            { label: '2.Middle name', value: patientData === null || patientData === void 0 ? void 0 : patientData.middleName },
            { label: '2.Last name', value: patientData === null || patientData === void 0 ? void 0 : patientData.lastName },
            { label: '3.Date of birth', value: (_a = patientData === null || patientData === void 0 ? void 0 : patientData.dob) === null || _a === void 0 ? void 0 : _a.toFormat('MM/dd/yyyy') },
            { label: '3.Birth sex', value: patientData === null || patientData === void 0 ? void 0 : patientData.genderLabel },
            { label: '5.Phone', value: patientData === null || patientData === void 0 ? void 0 : patientData.phone },
            { label: '5.Address line', value: patientData === null || patientData === void 0 ? void 0 : patientData.addressLine },
            { label: '5.City, State, ZIP', value: patientData === null || patientData === void 0 ? void 0 : patientData.cityStateZIP },
            { label: '6.Patient relation to insured', value: coverageData === null || coverageData === void 0 ? void 0 : coverageData.relationship },
        ]} editButton={<features_1.PatientInformationModal />}/>

            <features_1.ClaimListCard title="Additional information" items={[
            { label: '10.Is patient condition related to:', value: claimData === null || claimData === void 0 ? void 0 : claimData.conditionRelatedToMixed },
            { label: '10d.Claim codes (Designated to NUCC)', value: claimData === null || claimData === void 0 ? void 0 : claimData.claimCodes },
            {
                label: '14.Date of current illness, injury, or pregnancy (LMP)',
                value: (_b = claimData === null || claimData === void 0 ? void 0 : claimData.dateOfIllness) === null || _b === void 0 ? void 0 : _b.toFormat('MM/dd/yyyy'),
            },
            {
                label: '16.Dates patient is unable to work in current occupation',
                value: claimData === null || claimData === void 0 ? void 0 : claimData.unableToWorkString,
            },
            {
                label: '18.Hospitalization dates related to current services',
                value: claimData === null || claimData === void 0 ? void 0 : claimData.hospitalizationDatesString,
            },
            { label: '22.Resubmission code', value: claimData === null || claimData === void 0 ? void 0 : claimData.resubmissionCode },
            // { label: '22.Original ref.no.', value: 'TODO' },
            { label: '23.Prior authorization number', value: claimData === null || claimData === void 0 ? void 0 : claimData.priorAuthNumber },
        ]} editButton={<features_1.AdditionalInformationModal />}/>

            <features_1.ClaimListCard title="21. Diagnoses" items={((claimData === null || claimData === void 0 ? void 0 : claimData.diagnoses) || []).map(function (diagnosis, index) { return ({
            label: "".concat(utils_2.DIAGNOSES_SEQUENCE_LETTER[index], " ").concat(diagnosis.code, " ").concat(diagnosis.display),
            hideValue: true,
        }); })} comment={claimData === null || claimData === void 0 ? void 0 : claimData.diagnosesComment} editButton={<features_1.DiagnosesModal />}/>
          </material_1.Box>

          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            <features_1.ClaimListCard title="Insured information" items={[
            {
                label: 'Plan Name and Payer ID *',
                value: planNamePayerId,
            },
            {
                label: '1a.Insured’s ID number *',
                value: coverageData === null || coverageData === void 0 ? void 0 : coverageData.subscriberId,
            },
            {
                label: '4.Insured’s First name',
                value: coverageData === null || coverageData === void 0 ? void 0 : coverageData.firstName,
            },
            {
                label: '4.Insured’s Middle name',
                value: coverageData === null || coverageData === void 0 ? void 0 : coverageData.middleName,
            },
            {
                label: '4.Insured’s Last name',
                value: coverageData === null || coverageData === void 0 ? void 0 : coverageData.lastName,
            },
            {
                label: '7.Phone',
                value: coverageData === null || coverageData === void 0 ? void 0 : coverageData.phone,
            },
            {
                label: '7.Address line',
                value: coverageData === null || coverageData === void 0 ? void 0 : coverageData.addressLine,
            },
            {
                label: '7.City, State, ZIP',
                value: coverageData === null || coverageData === void 0 ? void 0 : coverageData.cityStateZIP,
            },
            {
                label: '11.Insured’s policy group or FECA number',
                value: coverageData === null || coverageData === void 0 ? void 0 : coverageData.policyGroup,
            },
            {
                label: '11a.Date of birth',
                value: (_c = coverageData === null || coverageData === void 0 ? void 0 : coverageData.dob) === null || _c === void 0 ? void 0 : _c.toFormat('MM.dd.yyyy'),
            },
            {
                label: '11a.Birth sex',
                value: coverageData === null || coverageData === void 0 ? void 0 : coverageData.genderLabel,
            },
            // {
            //   label: '11b.Other claim ID (Designated to NUCC) *',
            //   value: 'TODO',
            // },
        ]} editButton={<features_1.InsuredInformationModal />}/>

            <features_1.ClaimListCard title="Additional Insurance" items={[
            {
                label: '9.Other insured’s name',
                value: additionalCoverageData === null || additionalCoverageData === void 0 ? void 0 : additionalCoverageData.firstMiddleLastName,
            },
            {
                label: '9a.Other insured’s policy or group number',
                value: additionalCoverageData === null || additionalCoverageData === void 0 ? void 0 : additionalCoverageData.policyGroup,
            },
            // {
            //   label: '9d.Insured’s plan name or program name',
            //   value: 'TODO',
            // },
        ]} editButton={additionalCoverage && <features_1.AdditionalInsuranceModal />}/>

            <features_1.SLBProviderCard />
          </material_1.Box>
        </material_1.Box>

        <features_1.BillingCard />
      </material_1.Box>

      {/*<AppBar*/}
      {/*  position="sticky"*/}
      {/*  sx={{*/}
      {/*    top: 'auto',*/}
      {/*    bottom: 0,*/}
      {/*    backgroundColor: (theme) => theme.palette.background.paper,*/}
      {/*    zIndex: (theme) => theme.zIndex.drawer + 1,*/}
      {/*    color: 'inherit',*/}
      {/*  }}*/}
      {/*>*/}
      {/*  <Container maxWidth="xl">*/}
      {/*    <Box*/}
      {/*      sx={{*/}
      {/*        py: 2,*/}
      {/*        display: 'flex',*/}
      {/*        justifyContent: 'flex-end',*/}
      {/*        gap: 1,*/}
      {/*      }}*/}
      {/*    >*/}
      {/*      <RoundedButton startIcon={<DoneIcon />} variant="contained">*/}
      {/*        Save*/}
      {/*      </RoundedButton>*/}
      {/*      <RoundedButton startIcon={<LockOutlinedIcon />} variant="contained">*/}
      {/*        Lock*/}
      {/*      </RoundedButton>*/}
      {/*      <RoundedButton disabled startIcon={<CheckCircleOutlineOutlinedIcon />} variant="contained">*/}
      {/*        Done*/}
      {/*      </RoundedButton>*/}
      {/*    </Box>*/}
      {/*  </Container>*/}
      {/*</AppBar>*/}
    </material_1.Box>);
};
exports.Claim = Claim;
//# sourceMappingURL=Claim.js.map