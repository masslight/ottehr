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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosesContainer = void 0;
var colors_1 = require("@ehrTheme/colors");
var InfoOutlined_1 = require("@mui/icons-material/InfoOutlined");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var utils_1 = require("utils");
var CompleteConfiguration_1 = require("../../../../../components/CompleteConfiguration");
var GenericToolTip_1 = require("../../../../../components/GenericToolTip");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var featureFlags_1 = require("../../../../../features/css-module/context/featureFlags");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var components_1 = require("../../../../components");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var AssessmentTitle_1 = require("./AssessmentTitle");
var DiagnosesField_1 = require("./DiagnosesField");
var DiagnosesContainer = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData', 'setPartialChartData']), chartData = _a.chartData, setPartialChartData = _a.setPartialChartData;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var _b = (0, state_1.useSaveChartData)(), saveChartData = _b.mutate, isSaveLoading = _b.isLoading;
    var _c = (0, state_1.useDeleteChartData)(), deleteChartData = _c.mutateAsync, isDeleteLoading = _c.isLoading;
    var icdSearchError = (0, state_1.useGetIcd10Search)({ search: 'E11', sabs: 'ICD10CM' }).error;
    var nlmApiKeyMissing = (icdSearchError === null || icdSearchError === void 0 ? void 0 : icdSearchError.code) === utils_1.APIErrorCode.MISSING_NLM_API_KEY_ERROR;
    var isLoading = isSaveLoading || isDeleteLoading;
    var diagnoses = (chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis) || [];
    var primaryDiagnosis = diagnoses.find(function (item) { return item.isPrimary; });
    var otherDiagnoses = diagnoses.filter(function (item) { return !item.isPrimary; });
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    var onAdd = function (value) {
        var preparedValue = __assign(__assign({}, value), { isPrimary: !primaryDiagnosis });
        saveChartData({
            diagnosis: [preparedValue],
        }, {
            onSuccess: function (data) {
                var diagnosis = (data.chartData.diagnosis || [])[0];
                if (diagnosis) {
                    setPartialChartData({
                        diagnosis: __spreadArray(__spreadArray([], diagnoses, true), [diagnosis], false),
                    });
                }
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while adding diagnosis. Please try again.', { variant: 'error' });
                setPartialChartData({
                    diagnosis: diagnoses,
                });
            },
        });
        setPartialChartData({ diagnosis: __spreadArray(__spreadArray([], diagnoses, true), [preparedValue], false) });
    };
    var onDelete = function (resourceId) { return __awaiter(void 0, void 0, void 0, function () {
        var localDiagnoses, preparedValue, firstAppropriateDiagnosis, otherDiagnosis_1, prevDiagnoses_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    localDiagnoses = diagnoses;
                    preparedValue = localDiagnoses.find(function (item) { return item.resourceId === resourceId; });
                    return [4 /*yield*/, deleteChartData({
                            diagnosis: [preparedValue],
                        }, {
                            onError: function () {
                                (0, notistack_1.enqueueSnackbar)('An error has occurred while deleting diagnosis. Please try again.', { variant: 'error' });
                            },
                        })];
                case 1:
                    _a.sent();
                    localDiagnoses = localDiagnoses.filter(function (item) { return item.resourceId !== resourceId; });
                    if (preparedValue.isPrimary && otherDiagnoses.length > 0) {
                        firstAppropriateDiagnosis = otherDiagnoses.find(function (diagnosis) { return !diagnosis.code.startsWith('W'); });
                        if (firstAppropriateDiagnosis) {
                            otherDiagnosis_1 = __assign(__assign({}, firstAppropriateDiagnosis), { isPrimary: true });
                            prevDiagnoses_1 = localDiagnoses;
                            saveChartData({
                                diagnosis: [otherDiagnosis_1],
                            }, {
                                onError: function () {
                                    (0, notistack_1.enqueueSnackbar)('An error has occurred while setting primary diagnosis. Please try to set primary diagnosis manually.', { variant: 'error' });
                                    setPartialChartData({
                                        diagnosis: prevDiagnoses_1,
                                    });
                                },
                            });
                            localDiagnoses = localDiagnoses.map(function (item) {
                                return item.resourceId === otherDiagnosis_1.resourceId ? otherDiagnosis_1 : item;
                            });
                        }
                    }
                    setPartialChartData({ diagnosis: localDiagnoses });
                    return [2 /*return*/];
            }
        });
    }); };
    var onMakePrimary = function (resourceId) {
        var value = diagnoses.find(function (item) { return item.resourceId === resourceId; });
        var previousAndNewValues = [];
        previousAndNewValues.push(__assign(__assign({}, value), { isPrimary: true })); // prepared diagnosis
        if (primaryDiagnosis)
            previousAndNewValues.push(__assign(__assign({}, primaryDiagnosis), { isPrimary: false })); // previous diagnosis
        saveChartData({
            diagnosis: previousAndNewValues,
        }, {
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while changing primary diagnosis. Please try again.', {
                    variant: 'error',
                });
                setPartialChartData({
                    diagnosis: diagnoses,
                });
            },
        });
        setPartialChartData({
            diagnosis: diagnoses.map(function (item) {
                if (item.isPrimary) {
                    return __assign(__assign({}, item), { isPrimary: false });
                }
                if (item.resourceId === resourceId) {
                    return __assign(__assign({}, item), { isPrimary: true });
                }
                return item;
            }),
        });
    };
    var handleSetup = function () {
        window.open('https://docs.oystehr.com/ottehr/setup/terminology/', '_blank');
    };
    var addedViaLabOrderInfo = (<GenericToolTip_1.GenericToolTip title="Added during lab order" placement="right">
      <InfoOutlined_1.default style={{ color: colors_1.otherColors.disabled, height: '15px', width: '15px' }}/>
    </GenericToolTip_1.GenericToolTip>);
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} data-testid={data_test_ids_1.dataTestIds.diagnosisContainer.allDiagnosesContainer}>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <AssessmentTitle_1.AssessmentTitle>{css ? 'Dx' : 'Diagnoses'}</AssessmentTitle_1.AssessmentTitle>
        {!isReadOnly && <DiagnosesField_1.DiagnosesField onChange={onAdd} disabled={isLoading} disableForPrimary={!primaryDiagnosis}/>}
      </material_1.Box>

      {isReadOnly && diagnoses.length === 0 && <material_1.Typography color="secondary.light">Not provided</material_1.Typography>}

      {nlmApiKeyMissing && <CompleteConfiguration_1.CompleteConfiguration handleSetup={handleSetup}/>}

      {primaryDiagnosis && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <AssessmentTitle_1.AssessmentTitle>Primary *</AssessmentTitle_1.AssessmentTitle>
          <components_1.ActionsList data={[primaryDiagnosis]} getKey={function (value, index) { return value.resourceId || index; }} renderItem={function (value) { return (<material_1.Typography data-testid={data_test_ids_1.dataTestIds.diagnosisContainer.primaryDiagnosis}>
                {value.display} {value.code} {value.addedViaLabOrder && addedViaLabOrderInfo}
              </material_1.Typography>); }} renderActions={isReadOnly
                ? undefined
                : function (value) { return (<components_1.DeleteIconButton dataTestId={data_test_ids_1.dataTestIds.diagnosisContainer.primaryDiagnosisDeleteButton} disabled={isLoading || !value.resourceId} onClick={function () { return onDelete(value.resourceId); }}/>); }}/>
        </material_1.Box>)}

      {otherDiagnoses.length > 0 && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <AssessmentTitle_1.AssessmentTitle>Secondary (optional)</AssessmentTitle_1.AssessmentTitle>
          <components_1.ActionsList data={otherDiagnoses} getKey={function (value, index) { return value.resourceId || index; }} renderItem={function (value) { return (<material_1.Typography data-testid={data_test_ids_1.dataTestIds.diagnosisContainer.secondaryDiagnosis}>
                {value.display} {value.code} {value.addedViaLabOrder && addedViaLabOrderInfo}
              </material_1.Typography>); }} renderActions={isReadOnly
                ? undefined
                : function (value) { return (<material_1.Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {!value.code.startsWith('W') && (<material_1.Button disabled={isLoading || !value.resourceId} onClick={function () { return onMakePrimary(value.resourceId); }} size="small" data-testid={data_test_ids_1.dataTestIds.diagnosisContainer.makePrimaryButton} sx={{ textTransform: 'none', fontWeight: 500 }}>
                          {utils_1.DIAGNOSIS_MAKE_PRIMARY_BUTTON}
                        </material_1.Button>)}
                      <components_1.DeleteIconButton dataTestId={data_test_ids_1.dataTestIds.diagnosisContainer.secondaryDiagnosisDeleteButton} disabled={isLoading || !value.resourceId} onClick={function () { return onDelete(value.resourceId); }}/>
                    </material_1.Box>); }} divider/>
        </material_1.Box>)}
    </material_1.Box>);
};
exports.DiagnosesContainer = DiagnosesContainer;
//# sourceMappingURL=DiagnosesContainer.js.map