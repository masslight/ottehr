"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var colors_1 = require("@ehrTheme/colors");
var Close_1 = require("@mui/icons-material/Close");
var WarningAmber_1 = require("@mui/icons-material/WarningAmber");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var react_query_1 = require("react-query");
var react_router_dom_1 = require("react-router-dom");
var data_test_ids_1 = require("src/constants/data-test-ids");
var utils_1 = require("utils");
var CustomBreadcrumbs_1 = require("../components/CustomBreadcrumbs");
var dialogs_1 = require("../components/dialogs");
var LoadingScreen_1 = require("../components/LoadingScreen");
var patient_1 = require("../components/patient");
var AddInsuranceModal_1 = require("../components/patient/AddInsuranceModal");
var constants_1 = require("../constants");
var qr_structure_1 = require("../helpers/qr-structure");
var useGetPatient_1 = require("../hooks/useGetPatient");
var patient_store_1 = require("../state/patient.store");
var useOystehrAPIClient_1 = require("../telemed/hooks/useOystehrAPIClient");
var getAnyAnswer = function (item) {
    var _a;
    var index = 0;
    var answer;
    var types = ['String', 'Boolean', 'Reference', 'Attachment'];
    do {
        answer = (0, utils_1.extractFirstValueFromAnswer)((_a = item.answer) !== null && _a !== void 0 ? _a : [], types[index]);
        index++;
    } while (answer === undefined && index < types.length);
    return answer;
};
var getEligibilityCheckDetailsForCoverage = function (coverage, coverageChecks) {
    return coverageChecks.find(function (check) {
        return (0, utils_1.checkCoverageMatchesDetails)(coverage, check);
    });
};
var makeFormDefaults = function (currentItemValues) {
    var flattened = (0, utils_1.flattenItems)(currentItemValues);
    return flattened.reduce(function (acc, item) {
        var value = getAnyAnswer(item);
        acc[item.linkId] = value;
        return acc;
    }, {});
};
var clearPCPFieldsIfInactive = function (values) {
    return Object.fromEntries(Object.entries(values).map(function (_a) {
        var key = _a[0], value = _a[1];
        return [
            key,
            !values['pcp-active'] && key.startsWith('pcp-') && key !== 'pcp-active' ? '' : value,
        ];
    }));
};
var PatientInformationPage = function () {
    var _a;
    var theme = (0, material_1.useTheme)();
    var id = (0, react_router_dom_1.useParams)().id;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var setInsurancePlans = (0, patient_store_1.usePatientStore)().setInsurancePlans;
    // data queries
    var _b = (0, useGetPatient_1.useGetPatientAccount)({ apiClient: apiClient, patientId: id !== null && id !== void 0 ? id : null }), accountFetching = _b.isFetching, accountData = _b.data;
    var _c = (0, useGetPatient_1.useGetPatientDetailsUpdateForm)(), questionnaireFetching = _c.isFetching, questionnaire = _c.data;
    // data mutations
    var queryClient = (0, react_query_1.useQueryClient)();
    var submitQR = (0, useGetPatient_1.useUpdatePatientAccount)(function () {
        void queryClient.invalidateQueries('patient-account-get');
    });
    var removeCoverage = (0, useGetPatient_1.useRemovePatientCoverage)();
    (0, useGetPatient_1.useGetInsurancePlans)(function (data) {
        var bundleEntries = data.entry;
        if (bundleEntries) {
            var organizations = bundleEntries
                .filter(function (bundleEntry) { var _a; return ((_a = bundleEntry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Organization'; })
                .map(function (bundleEntry) { return bundleEntry.resource; });
            var transformedInsurancePlans = organizations
                .map(function (organization) {
                try {
                    return (0, patient_store_1.createInsurancePlanDto)(organization);
                }
                catch (err) {
                    console.error(err);
                    console.log('Could not add insurance org due to incomplete data:', JSON.stringify(organization));
                    return {};
                }
            })
                .filter(function (insurancePlan) { return insurancePlan.id !== undefined; })
                .sort(function (a, b) {
                if (a.name < b.name)
                    return -1;
                if (a.name > b.name)
                    return 1;
                return 0;
            });
            var insurancePlanMap_1 = {};
            transformedInsurancePlans.forEach(function (insurancePlan) {
                var _a;
                insurancePlanMap_1[(_a = insurancePlan.name) !== null && _a !== void 0 ? _a : ''] = insurancePlan;
            });
            var uniquePlans = Object.values(insurancePlanMap_1);
            setInsurancePlans(uniquePlans);
        }
    });
    var _d = (0, react_1.useMemo)(function () {
        var _a, _b;
        var patient = accountData === null || accountData === void 0 ? void 0 : accountData.patient;
        var coverages = [];
        if ((_a = accountData === null || accountData === void 0 ? void 0 : accountData.coverages) === null || _a === void 0 ? void 0 : _a.primary) {
            coverages.push({ resource: accountData.coverages.primary, startingPriority: 1 });
        }
        if ((_b = accountData === null || accountData === void 0 ? void 0 : accountData.coverages) === null || _b === void 0 ? void 0 : _b.secondary) {
            coverages.push({ resource: accountData.coverages.secondary, startingPriority: 2 });
        }
        var isFetching = accountFetching || questionnaireFetching;
        var defaultFormVals;
        if (!isFetching && accountData && questionnaire) {
            var prepopulatedForm = (0, utils_1.makePrepopulatedItemsFromPatientRecord)(__assign(__assign({}, accountData), { questionnaire: questionnaire }));
            defaultFormVals = makeFormDefaults(prepopulatedForm);
        }
        return { patient: patient, coverages: coverages, isFetching: isFetching, defaultFormVals: defaultFormVals };
    }, [accountData, questionnaire, questionnaireFetching, accountFetching]), patient = _d.patient, coverages = _d.coverages, isFetching = _d.isFetching, defaultFormVals = _d.defaultFormVals;
    var _e = (0, useGetPatient_1.useGetPatient)(id), otherPatientsWithSameName = _e.otherPatientsWithSameName, setOtherPatientsWithSameName = _e.setOtherPatientsWithSameName;
    var _f = (0, react_1.useState)(false), openConfirmationDialog = _f[0], setOpenConfirmationDialog = _f[1];
    var _g = (0, react_1.useState)(false), openAddInsuranceModal = _g[0], setOpenAddInsuranceModal = _g[1];
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: defaultFormVals,
        values: defaultFormVals,
        mode: 'onBlur',
        reValidateMode: 'onChange',
    });
    var handleSubmit = methods.handleSubmit, watch = methods.watch, formState = methods.formState;
    var dirtyFields = formState.dirtyFields;
    (0, react_1.useEffect)(function () {
        if (defaultFormVals && formState.isSubmitSuccessful && submitQR.isSuccess) {
            methods.reset();
        }
    }, [defaultFormVals, methods, formState.isSubmitSuccessful, submitQR.isSuccess]);
    var handleDiscardChanges = function () {
        methods.reset();
        setOpenConfirmationDialog(false);
        navigate(-1);
    };
    var handleCloseConfirmationDialog = function () {
        setOpenConfirmationDialog(false);
    };
    var handleBackClickWithConfirmation = function () {
        if (Object.keys(dirtyFields).length > 0) {
            setOpenConfirmationDialog(true);
        }
        else {
            navigate(-1);
        }
    };
    var handleSaveForm = function (values) { return __awaiter(void 0, void 0, void 0, function () {
        var filteredValues, qr;
        return __generator(this, function (_a) {
            if (!questionnaire || !(patient === null || patient === void 0 ? void 0 : patient.id)) {
                (0, notistack_1.enqueueSnackbar)('Something went wrong. Please reload the page.', { variant: 'error' });
                return [2 /*return*/];
            }
            filteredValues = clearPCPFieldsIfInactive(values);
            qr = (0, utils_1.pruneEmptySections)((0, qr_structure_1.structureQuestionnaireResponse)(questionnaire, filteredValues, patient.id));
            submitQR.mutate(qr);
            return [2 /*return*/];
        });
    }); };
    var handleRemoveCoverage = function (coverageId) {
        if (patient === null || patient === void 0 ? void 0 : patient.id) {
            removeCoverage.mutate({
                patientId: patient.id,
                coverageId: coverageId,
            }, {
                onSuccess: function () {
                    (0, notistack_1.enqueueSnackbar)('Coverage removed from patient account', {
                        variant: 'success',
                    });
                    void queryClient.invalidateQueries('patient-account-get');
                },
                onError: function () {
                    (0, notistack_1.enqueueSnackbar)('Save operation failed. The server encountered an error while processing your request.', {
                        variant: 'error',
                    });
                },
            });
        }
    };
    if ((isFetching || questionnaireFetching) && !patient) {
        return <LoadingScreen_1.LoadingScreen />;
    }
    else {
        if (!patient)
            return null;
    }
    var currentlyAssignedPriorities = watch(constants_1.InsurancePriorityOptions);
    return (<div>
      {isFetching ? <LoadingScreen_1.LoadingScreen /> : null}
      <react_hook_form_1.FormProvider {...methods}>
        <material_1.Box>
          <patient_1.Header handleDiscard={handleBackClickWithConfirmation} id={id}/>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', padding: theme.spacing(3) }}>
            <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <CustomBreadcrumbs_1.default chain={[
            { link: '/patients', children: 'Patients' },
            {
                link: "/patient/".concat(patient === null || patient === void 0 ? void 0 : patient.id),
                children: patient ? (0, utils_1.getFullName)(patient) : '',
            },
            {
                link: '#',
                children: "Patient Information",
            },
        ]}/>
              <material_1.Typography variant="h3" color="primary.main">
                Patient Information
              </material_1.Typography>
              {otherPatientsWithSameName && (<material_1.Box sx={{
                marginTop: 1,
                padding: 1,
                background: colors_1.otherColors.dialogNote,
                borderRadius: '4px',
            }} display="flex">
                  <WarningAmber_1.default sx={{ marginTop: 1, color: colors_1.otherColors.warningIcon }}/>
                  <material_1.Typography variant="body2" color={colors_1.otherColors.closeCross} sx={{ m: 1.25, maxWidth: 850, fontWeight: 500 }}>
                    There are other patients with this name in our database. Please confirm by the DOB that you are
                    viewing the right patient.
                  </material_1.Typography>
                  <Close_1.default onClick={function () { return setOtherPatientsWithSameName(false); }} sx={{ marginLeft: 'auto', marginRight: 0, marginTop: 1, color: colors_1.otherColors.closeCross }}/>
                </material_1.Box>)}
              <material_1.Box sx={{ display: 'flex', gap: 3 }}>
                <material_1.Box sx={{ flex: '1 1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <patient_1.AboutPatientContainer />
                  <patient_1.ContactContainer />
                  <patient_1.PatientDetailsContainer patient={patient}/>
                  <patient_1.PrimaryCareContainer />
                </material_1.Box>
                <material_1.Box sx={{ flex: '1 1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {coverages.map(function (coverage) {
            var _a, _b;
            return (<patient_1.InsuranceContainer key={coverage.resource.id} patientId={(_a = patient.id) !== null && _a !== void 0 ? _a : ''} ordinal={coverage.startingPriority} initialEligibilityCheck={getEligibilityCheckDetailsForCoverage(coverage.resource, (_b = accountData === null || accountData === void 0 ? void 0 : accountData.coverageChecks) !== null && _b !== void 0 ? _b : [])} removeInProgress={removeCoverage.isLoading} handleRemoveClick={coverage.resource.id !== undefined
                    ? function () {
                        handleRemoveCoverage(coverage.resource.id);
                    }
                    : undefined}/>);
        })}
                  {coverages.length < 2 && (<material_1.Button data-testid={data_test_ids_1.dataTestIds.patientInformationPage.addInsuranceButton} variant="outlined" color="primary" onClick={function () { return setOpenAddInsuranceModal(true); }} sx={{
                borderRadius: 25,
                textTransform: 'none',
                fontWeight: 'bold',
                width: 'fit-content',
            }}>
                      + Add Insurance
                    </material_1.Button>)}
                  <patient_1.ResponsibleInformationContainer />
                </material_1.Box>
              </material_1.Box>
            </material_1.Box>
          </material_1.Box>
          <patient_1.ActionBar handleDiscard={handleBackClickWithConfirmation} handleSave={handleSubmit(handleSaveForm, function () {
            (0, notistack_1.enqueueSnackbar)('Please fix all field validation errors and try again', { variant: 'error' });
        })} loading={submitQR.isLoading} hidden={false} submitDisabled={Object.keys(dirtyFields).length === 0}/>
        </material_1.Box>
        <dialogs_1.CustomDialog open={openConfirmationDialog} handleClose={handleCloseConfirmationDialog} title="Discard Changes?" description="You have unsaved changes. Are you sure you want to discard them and go back?" closeButtonText="Cancel" handleConfirm={handleDiscardChanges} confirmText="Discard Changes"/>
      </react_hook_form_1.FormProvider>
      <AddInsuranceModal_1.AddInsuranceModal open={openAddInsuranceModal} onClose={function () { return setOpenAddInsuranceModal(false); }} questionnaire={questionnaire !== null && questionnaire !== void 0 ? questionnaire : { resourceType: 'Questionnaire', status: 'draft' }} patientId={(_a = patient.id) !== null && _a !== void 0 ? _a : ''} priorityOptions={constants_1.INSURANCE_COVERAGE_OPTIONS.filter(function (option) { return !currentlyAssignedPriorities.includes(option.value); })}/>
    </div>);
};
exports.default = PatientInformationPage;
//# sourceMappingURL=PatientInformationPage.js.map