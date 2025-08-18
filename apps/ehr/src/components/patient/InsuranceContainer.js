"use strict";
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsuranceContainer = exports.STATUS_TO_STYLE_MAP = void 0;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var react_query_1 = require("react-query");
var useAppClients_1 = require("src/hooks/useAppClients");
var utils_1 = require("utils");
var form_1 = require("../../components/form");
var constants_1 = require("../../constants");
var constants_2 = require("../../constants");
var constants_3 = require("../../constants");
var data_test_ids_1 = require("../../constants/data-test-ids");
var patient_store_1 = require("../../state/patient.store");
var layout_1 = require("../layout");
var RefreshableStatusWidget_1 = require("../RefreshableStatusWidget");
var CopayWidget_1 = require("./CopayWidget");
var ShowMoreButton_1 = require("./ShowMoreButton");
exports.STATUS_TO_STYLE_MAP = {
    ELIGIBLE: {
        bgColor: '#C8E6C9',
        textColor: '#1B5E20',
    },
    'NOT ELIGIBLE': {
        bgColor: '#FECDD2',
        textColor: '#B71C1C',
    },
    UNKNOWN: {
        bgColor: '#FECDD2',
        textColor: '#B71C1C',
    },
};
function mapInitialStatus(initialCheckResult) {
    if (initialCheckResult) {
        var status_1 = (0, utils_1.mapEligibilityCheckResultToSimpleStatus)(initialCheckResult);
        return {
            status: status_1.status,
            dateISO: status_1.dateISO,
            copay: initialCheckResult.copay,
        };
    }
    return undefined;
}
var InsuranceContainer = function (_a) {
    var _b;
    var ordinal = _a.ordinal, patientId = _a.patientId, removeInProgress = _a.removeInProgress, initialEligibilityCheck = _a.initialEligibilityCheck, handleRemoveClick = _a.handleRemoveClick;
    //console.log('insuranceId', insuranceId);
    var theme = (0, material_1.useTheme)();
    var insurancePlans = (0, patient_store_1.usePatientStore)().insurancePlans;
    var _c = (0, react_1.useState)(false), showMoreInfo = _c[0], setShowMoreInfo = _c[1];
    var _d = (0, react_1.useState)(mapInitialStatus(initialEligibilityCheck)), eligibilityStatus = _d[0], setEligibilityStatus = _d[1];
    var _e = (0, react_hook_form_1.useFormContext)(), control = _e.control, setValue = _e.setValue, watch = _e.watch;
    var _f = (0, react_1.useMemo)(function () {
        var FormFields = constants_3.FormFields.insurance[ordinal - 1];
        var LocalAddressFields = [
            FormFields.streetAddress.key,
            FormFields.addressLine2.key,
            FormFields.city.key,
            FormFields.state.key,
            FormFields.zip.key,
        ];
        var LocalIdentifyingFields = [
            FormFields.firstName.key,
            FormFields.middleName.key,
            FormFields.lastName.key,
            FormFields.birthDate.key,
            FormFields.birthSex.key,
        ];
        return { FormFields: FormFields, LocalAddressFields: LocalAddressFields, LocalIdentifyingFields: LocalIdentifyingFields };
    }, [ordinal]), FormFields = _f.FormFields, LocalAddressFields = _f.LocalAddressFields, LocalIdentifyingFields = _f.LocalIdentifyingFields;
    var patientAddressData = watch(constants_2.PatientAddressFields);
    var patientIdentifyingData = watch(constants_1.PatientIdentifyingFields);
    var localAddressData = watch(LocalAddressFields);
    var localIdentifyingData = watch(LocalIdentifyingFields);
    var selfSelected = watch(FormFields.relationship.key) === 'Self';
    var insurancePriority = watch(FormFields.insurancePriority.key);
    var sameAsPatientAddress = watch(FormFields.policyHolderAddressAsPatient.key, false);
    (0, react_1.useEffect)(function () {
        if (sameAsPatientAddress || selfSelected) {
            for (var i = 0; i < localAddressData.length; i++) {
                if (patientAddressData[i] && localAddressData[i] !== patientAddressData[i]) {
                    setValue(LocalAddressFields[i], patientAddressData[i]);
                }
            }
            if (selfSelected) {
                for (var i = 0; i < localIdentifyingData.length; i++) {
                    if (patientIdentifyingData[i] && localIdentifyingData[i] !== patientIdentifyingData[i]) {
                        setValue(LocalIdentifyingFields[i], patientIdentifyingData[i]);
                    }
                }
            }
        }
    }, [
        LocalAddressFields,
        LocalIdentifyingFields,
        localAddressData,
        localIdentifyingData,
        patientAddressData,
        patientIdentifyingData,
        sameAsPatientAddress,
        selfSelected,
        setValue,
    ]);
    var toggleMoreInfo = function () {
        setShowMoreInfo(function (prev) { return !prev; });
    };
    var handleRemoveInsurance = function () {
        handleRemoveClick === null || handleRemoveClick === void 0 ? void 0 : handleRemoveClick();
    };
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var recheckEligibility = (0, react_query_1.useMutation)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var coverageToCheck;
        return __generator(this, function (_a) {
            coverageToCheck = insurancePriority === null || insurancePriority === void 0 ? void 0 : insurancePriority.toLowerCase();
            try {
                return [2 /*return*/, oystehrZambda === null || oystehrZambda === void 0 ? void 0 : oystehrZambda.zambda.execute({
                        id: 'get-eligibility',
                        patientId: patientId,
                        coverageToCheck: coverageToCheck,
                    }).then(function (res) {
                        console.log('eligibility check result');
                        var json = (0, utils_1.chooseJson)(res);
                        if (coverageToCheck === 'secondary') {
                            return (0, utils_1.mapEligibilityCheckResultToSimpleStatus)(json.secondary);
                        }
                        else {
                            return (0, utils_1.mapEligibilityCheckResultToSimpleStatus)(json.primary);
                        }
                    })];
            }
            catch (error) {
                throw new Error(error.message);
            }
            return [2 /*return*/];
        });
    }); });
    var handleRecheckEligibility = function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('recheck eligibility', recheckEligibility);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, recheckEligibility.mutateAsync()];
                case 2:
                    result = _a.sent();
                    if (result) {
                        setEligibilityStatus(result);
                    }
                    else {
                        console.error('Error rechecking eligibility:', 'No result returned');
                    }
                    console.log('Eligibility check result:', result);
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error('Error rechecking eligibility:', error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var TitleWidget = function () {
        var _a, _b;
        return (<RefreshableStatusWidget_1.RefreshableStatusChip status={(_a = eligibilityStatus === null || eligibilityStatus === void 0 ? void 0 : eligibilityStatus.status) !== null && _a !== void 0 ? _a : 'UNKNOWN'} lastRefreshISO={(_b = eligibilityStatus === null || eligibilityStatus === void 0 ? void 0 : eligibilityStatus.dateISO) !== null && _b !== void 0 ? _b : ''} styleMap={exports.STATUS_TO_STYLE_MAP} isRefreshing={recheckEligibility.isLoading} handleRefresh={handleRecheckEligibility}/>);
    };
    var copayBenefits = (_b = eligibilityStatus === null || eligibilityStatus === void 0 ? void 0 : eligibilityStatus.copay) !== null && _b !== void 0 ? _b : [];
    return (<layout_1.Section title="Insurance information" dataTestId="insuranceContainer" titleWidget={<TitleWidget />}>
      <material_1.Box sx={{
            marginLeft: '12px',
            marginTop: 2,
        }}>
        <CopayWidget_1.CopayWidget copay={copayBenefits}/>
      </material_1.Box>
      <layout_1.Row label="Type" required dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.type}>
        <form_1.FormSelect name={FormFields.insurancePriority.key} control={control} defaultValue={ordinal === 1 ? 'Primary' : 'Secondary'} options={constants_1.INSURANCE_COVERAGE_OPTIONS} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            validate: function (value, context) {
                // todo: this validation concept would be good to lift into the paperwork validation engine
                var otherGroupKey = constants_1.InsurancePriorityOptions.find(function (key) { return key !== FormFields.insurancePriority.key; });
                var otherGroupValue;
                if (otherGroupKey) {
                    otherGroupValue = context[otherGroupKey];
                }
                if (otherGroupValue === value) {
                    return "Account may not have two ".concat(value.toLowerCase(), " insurance plans");
                }
                return true;
            },
        }}/>
      </layout_1.Row>
      <layout_1.Row label="Insurance carrier" required dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.insuranceCarrier}>
        <react_hook_form_1.Controller name={FormFields.insuranceCarrier.key} control={control} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            validate: function (value) { return insurancePlans.some(function (option) { return "Organization/".concat(option.id) === (value === null || value === void 0 ? void 0 : value.reference); }); },
        }} render={function (_a) {
            var value = _a.field.value, error = _a.fieldState.error;
            var isLoading = insurancePlans.length === 0;
            var selectedOption = insurancePlans.find(function (option) { return "Organization/".concat(option.id) === (value === null || value === void 0 ? void 0 : value.reference); });
            return (<material_1.Autocomplete options={insurancePlans} loading={isLoading} loadingText={'Loading...'} value={selectedOption !== null && selectedOption !== void 0 ? selectedOption : {}} isOptionEqualToValue={function (option, value) {
                    return (option === null || option === void 0 ? void 0 : option.id) === (value === null || value === void 0 ? void 0 : value.id);
                }} getOptionLabel={function (option) { return option.name || ''; }} onChange={function (_, newValue) {
                    if (newValue) {
                        setValue(FormFields.insuranceCarrier.key, { reference: "Organization/".concat(newValue.id), display: newValue.name }, { shouldDirty: true });
                    }
                    else {
                        setValue(FormFields.insuranceCarrier.key, null);
                    }
                }} disableClearable fullWidth renderInput={function (params) { return (<material_1.TextField {...params} variant="standard" error={!!error} required helperText={error === null || error === void 0 ? void 0 : error.message}/>); }}/>);
        }}/>
      </layout_1.Row>
      <layout_1.Row label="Member ID" required inputId={FormFields.memberId.key} dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.memberId}>
        <form_1.FormTextField id={FormFields.memberId.key} name={FormFields.memberId.key} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }}/>
      </layout_1.Row>
      <material_1.Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ShowMoreButton_1.default onClick={toggleMoreInfo} isOpen={showMoreInfo} dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.showMoreButton}/>
      </material_1.Box>
      {showMoreInfo && (<>
          <layout_1.Row label="Policy holder's first name" required inputId={FormFields.firstName.key} dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersFirstName}>
            <form_1.FormTextField id={FormFields.firstName.key} name={FormFields.firstName.key} disabled={selfSelected} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }}/>
          </layout_1.Row>
          <layout_1.Row label="Policy holder's middle name" inputId={FormFields.middleName.key} dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersMiddleName}>
            <form_1.FormTextField id={FormFields.middleName.key} name={FormFields.middleName.key} control={control} disabled={selfSelected}/>
          </layout_1.Row>
          <layout_1.Row label="Policy holder's last name" required inputId={FormFields.lastName.key} dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersLastName}>
            <form_1.FormTextField id={FormFields.lastName.key} name={FormFields.lastName.key} disabled={selfSelected} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }}/>
          </layout_1.Row>
          <layout_1.Row label="Policy holder's date of birth" required dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersDateOfBirth}>
            <form_1.BasicDatePicker name={FormFields.birthDate.key} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }} disabled={selfSelected}/>
          </layout_1.Row>
          <layout_1.Row label="Policy holder's sex" required dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersSex}>
            <form_1.FormSelect name={FormFields.birthSex.key} control={control} options={constants_1.SEX_OPTIONS} disabled={selfSelected} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }}/>
          </layout_1.Row>
          <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
            <material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
              <react_hook_form_1.Controller key={sameAsPatientAddress} name={FormFields.policyHolderAddressAsPatient.key} control={control} render={function (_a) {
                var _b = _a.field, value = _b.value, field = __rest(_b, ["value"]);
                return (<material_1.FormControlLabel control={<material_1.Checkbox {...field} data-testid={data_test_ids_1.dataTestIds.insuranceContainer.policyHolderAddressCheckbox} checked={value} onChange={function (e) {
                            var checked = e.target.checked;
                            setValue(FormFields.policyHolderAddressAsPatient.key, checked, { shouldDirty: true });
                        }} disabled={selfSelected}/>} label={<material_1.Typography>Policy holder address is the same as patient's address</material_1.Typography>}/>);
            }}/>
            </material_1.Box>
          </material_1.Box>
          <layout_1.Row label="Street address" inputId={FormFields.streetAddress.key} required dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.streetAddress}>
            <form_1.FormTextField id={FormFields.streetAddress.key} name={FormFields.streetAddress.key} disabled={(sameAsPatientAddress || selfSelected) && Boolean(patientAddressData[0])} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }}/>
          </layout_1.Row>
          <layout_1.Row label="Address line 2" inputId={FormFields.addressLine2.key} dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.addressLine2}>
            <form_1.FormTextField id={FormFields.addressLine2.key} name={FormFields.addressLine2.key} disabled={sameAsPatientAddress || selfSelected} control={control}/>
          </layout_1.Row>
          <layout_1.Row label="City, State, ZIP" required>
            <material_1.Box sx={{ display: 'flex', gap: 2 }}>
              <form_1.FormTextField data-testid={data_test_ids_1.dataTestIds.insuranceContainer.city} name={FormFields.city.key} disabled={(sameAsPatientAddress || selfSelected) && Boolean(patientAddressData[2])} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }}/>
              <react_hook_form_1.Controller name={FormFields.state.key} control={control} rules={{
                required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            }} render={function (_a) {
                var value = _a.field.value, error = _a.fieldState.error;
                return (<material_1.Autocomplete options={constants_1.STATE_OPTIONS.map(function (option) { return option.value; })} disabled={(sameAsPatientAddress || selfSelected) && Boolean(patientAddressData[3])} value={value !== null && value !== void 0 ? value : ''} onChange={function (_, newValue) {
                        if (newValue) {
                            setValue(FormFields.state.key, newValue);
                        }
                        else {
                            setValue(FormFields.state.key, '');
                        }
                    }} disableClearable fullWidth renderInput={function (params) { return (<material_1.TextField data-testid={data_test_ids_1.dataTestIds.insuranceContainer.state} {...params} variant="standard" error={!!error} required helperText={error === null || error === void 0 ? void 0 : error.message}/>); }}/>);
            }}/>
              <form_1.FormTextField data-testid={data_test_ids_1.dataTestIds.insuranceContainer.zip} name={FormFields.zip.key} control={control} disabled={(sameAsPatientAddress || selfSelected) && Boolean(patientAddressData[4])} rules={{
                validate: function (value) { return (0, utils_1.isPostalCodeValid)(value) || 'Must be 5 digits'; },
                required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            }}/>
            </material_1.Box>
          </layout_1.Row>
          <layout_1.Row label="Patient’s relationship to insured" required dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.relationship}>
            <form_1.FormSelect name={FormFields.relationship.key} control={control} options={constants_1.RELATIONSHIP_TO_INSURED_OPTIONS} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }}/>
          </layout_1.Row>
          <layout_1.Row label="Additional insurance information" inputId={FormFields.additionalInformation.key} dataTestId={data_test_ids_1.dataTestIds.insuranceContainer.additionalInformation}>
            <form_1.FormTextField id={FormFields.additionalInformation.key} name={FormFields.additionalInformation.key} control={control}/>
          </layout_1.Row>
          <lab_1.LoadingButton data-testid={data_test_ids_1.dataTestIds.insuranceContainer.removeButton} onClick={handleRemoveInsurance} variant="text" loading={removeInProgress} sx={{
                color: theme.palette.error.main,
                textTransform: 'none',
                fontSize: '13px',
                fontWeight: 500,
                display: handleRemoveClick !== undefined ? 'flex' : 'none',
                alignItems: 'center',
                justifyContent: 'flex-start',
                padding: '0',
                width: 'fit-content',
            }}>
            Remove This Insurance
          </lab_1.LoadingButton>
        </>)}
    </layout_1.Section>);
};
exports.InsuranceContainer = InsuranceContainer;
//# sourceMappingURL=InsuranceContainer.js.map