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
exports.default = ProceduresNew;
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var x_date_pickers_pro_1 = require("@mui/x-date-pickers-pro");
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_query_1 = require("react-query");
var react_router_dom_1 = require("react-router-dom");
var RoundedButton_1 = require("src/components/RoundedButton");
var WithTooltip_1 = require("src/components/WithTooltip");
var constants_1 = require("src/constants");
var useAppClients_1 = require("src/hooks/useAppClients");
var telemed_1 = require("src/telemed");
var PageTitle_1 = require("src/telemed/components/PageTitle");
var AssessmentTab_1 = require("src/telemed/features/appointment/AssessmentTab");
var utils_1 = require("utils");
var InfoAlert_1 = require("../components/InfoAlert");
var featureFlags_1 = require("../context/featureFlags");
var routesCSS_1 = require("../routing/routesCSS");
var OTHER = 'Other';
var PERFORMED_BY = ['Healthcare staff', 'Provider', 'Both'];
var SPECIMEN_SENT = ['Yes', 'No'];
var DOCUMENTED_BY = ['Provider', 'Healthcare staff'];
function ProceduresNew() {
    var _this = this;
    var _a, _b;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var theme = (0, system_1.useTheme)();
    var _c = (0, react_router_dom_1.useParams)(), appointmentId = _c.id, procedureId = _c.procedureId;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var _d = useSelectOptions(oystehr), selectOptions = _d.data, isSelectOptionsLoading = _d.isLoading;
    var _f = (0, utils_1.getSelectors)(telemed_1.useAppointmentStore, [
        'chartData',
        'setPartialChartData',
        'appointment',
        'encounter',
    ]), chartData = _f.chartData, setPartialChartData = _f.setPartialChartData, appointment = _f.appointment, encounter = _f.encounter;
    var inPersonStatus = (0, react_1.useMemo)(function () { return appointment && (0, utils_1.getVisitStatus)(appointment, encounter); }, [appointment, encounter]);
    var appointmentAccessibility = (0, telemed_1.useGetAppointmentAccessibility)();
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    var isReadOnly = (0, react_1.useMemo)(function () {
        if (css) {
            return inPersonStatus === 'completed';
        }
        return appointmentAccessibility.status === utils_1.TelemedAppointmentStatusEnum.complete;
    }, [css, inPersonStatus, appointmentAccessibility.status]);
    var chartCptCodes = (chartData === null || chartData === void 0 ? void 0 : chartData.cptCodes) || [];
    var chartDiagnoses = (chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis) || [];
    var chartProcedures = (chartData === null || chartData === void 0 ? void 0 : chartData.procedures) || [];
    var saveChartData = (0, telemed_1.useSaveChartData)().mutateAsync;
    var deleteChartData = (0, telemed_1.useDeleteChartData)().mutateAsync;
    var _g = (0, react_1.useState)({
        procedureDate: luxon_1.DateTime.now(),
        procedureTime: luxon_1.DateTime.now(),
    }), state = _g[0], setState = _g[1];
    var _h = (0, react_1.useState)(false), saveInProgress = _h[0], setSaveInProgress = _h[1];
    var updateState = function (stateMutator) {
        stateMutator(state);
        setState(__assign({}, state));
    };
    var _j = (0, react_1.useState)(false), initialValuesSet = _j[0], setInitialValuesSet = _j[1];
    (0, react_1.useEffect)(function () {
        var _a;
        var procedure = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.procedures) === null || _a === void 0 ? void 0 : _a.find(function (procedure) { return procedure.resourceId === procedureId; });
        if (procedure == null || initialValuesSet || isSelectOptionsLoading) {
            return;
        }
        var procedureDateTime = procedure.procedureDateTime != null ? luxon_1.DateTime.fromISO(procedure.procedureDateTime) : undefined;
        setState({
            procedureType: procedure.procedureType,
            cptCodes: procedure.cptCodes,
            diagnoses: procedure.diagnoses,
            procedureDate: procedureDateTime,
            procedureTime: procedureDateTime,
            performerType: procedure.performerType,
            medicationUsed: procedure.medicationUsed,
            bodySite: getPredefinedValueOrOther(procedure.bodySite, selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.bodySites),
            otherBodySite: getPredefinedValueIfOther(procedure.bodySite, selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.bodySites),
            bodySide: procedure.bodySide,
            technique: procedure.technique,
            suppliesUsed: getPredefinedValueOrOther(procedure.suppliesUsed, selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.supplies),
            otherSuppliesUsed: getPredefinedValueIfOther(procedure.suppliesUsed, selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.supplies),
            procedureDetails: procedure.procedureDetails,
            specimenSent: procedure.specimenSent,
            complications: getPredefinedValueOrOther(procedure.complications, selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.complications),
            otherComplications: getPredefinedValueIfOther(procedure.complications, selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.complications),
            patientResponse: procedure.patientResponse,
            postInstructions: getPredefinedValueOrOther(procedure.postInstructions, selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.postProcedureInstructions),
            otherPostInstructions: getPredefinedValueIfOther(procedure.postInstructions, selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.postProcedureInstructions),
            timeSpent: procedure.timeSpent,
            documentedBy: procedure.documentedBy,
            consentObtained: procedure.consentObtained,
        });
        setInitialValuesSet(true);
    }, [procedureId, chartData === null || chartData === void 0 ? void 0 : chartData.procedures, setState, initialValuesSet, isSelectOptionsLoading, selectOptions]);
    var onCancel = function () {
        navigate("/in-person/".concat(appointmentId, "/").concat(routesCSS_1.ROUTER_PATH.PROCEDURES));
    };
    var onSave = function () { return __awaiter(_this, void 0, void 0, function () {
        var saveCptAndDiagnosesResponse, savedCptCodes, savedDiagnoses, cptCodesToUse_1, diagnosesToUse_1, saveProcedureResponse, oldProcedure, savedProcedure, _a;
        var _b, _c, _d, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
        return __generator(this, function (_2) {
            switch (_2.label) {
                case 0:
                    setSaveInProgress(true);
                    _2.label = 1;
                case 1:
                    _2.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, saveChartData({
                            cptCodes: (_c = (_b = state.cptCodes) === null || _b === void 0 ? void 0 : _b.filter(function (cptCode) { return cptCode.resourceId == null; })) !== null && _c !== void 0 ? _c : [],
                            diagnosis: (_f = (_d = state.diagnoses) === null || _d === void 0 ? void 0 : _d.filter(function (diagnosis) { return diagnosis.resourceId == null; })) !== null && _f !== void 0 ? _f : [],
                        })];
                case 2:
                    saveCptAndDiagnosesResponse = _2.sent();
                    savedCptCodes = (_g = saveCptAndDiagnosesResponse.chartData) === null || _g === void 0 ? void 0 : _g.cptCodes;
                    if (savedCptCodes) {
                        setPartialChartData({
                            cptCodes: __spreadArray(__spreadArray([], chartCptCodes, true), savedCptCodes, true),
                        });
                    }
                    savedDiagnoses = (_h = saveCptAndDiagnosesResponse.chartData) === null || _h === void 0 ? void 0 : _h.diagnosis;
                    if (savedDiagnoses) {
                        setPartialChartData({
                            diagnosis: __spreadArray(__spreadArray([], chartDiagnoses, true), savedDiagnoses, true),
                        });
                    }
                    cptCodesToUse_1 = __spreadArray(__spreadArray([], (savedCptCodes !== null && savedCptCodes !== void 0 ? savedCptCodes : []), true), ((_k = (_j = state.cptCodes) === null || _j === void 0 ? void 0 : _j.filter(function (cptCode) { return cptCode.resourceId != null; })) !== null && _k !== void 0 ? _k : []), true);
                    diagnosesToUse_1 = __spreadArray(__spreadArray([], (savedDiagnoses !== null && savedDiagnoses !== void 0 ? savedDiagnoses : []), true), ((_m = (_l = state.diagnoses) === null || _l === void 0 ? void 0 : _l.filter(function (diagnosis) { return diagnosis.resourceId != null; })) !== null && _m !== void 0 ? _m : []), true);
                    return [4 /*yield*/, saveChartData({
                            procedures: [
                                {
                                    resourceId: procedureId,
                                    procedureType: state.procedureType,
                                    cptCodes: cptCodesToUse_1,
                                    diagnoses: diagnosesToUse_1,
                                    procedureDateTime: (_s = (_r = (_o = state.procedureDate) === null || _o === void 0 ? void 0 : _o.set({ hour: (_p = state.procedureTime) === null || _p === void 0 ? void 0 : _p.hour, minute: (_q = state.procedureTime) === null || _q === void 0 ? void 0 : _q.minute })) === null || _r === void 0 ? void 0 : _r.toUTC()) === null || _s === void 0 ? void 0 : _s.toString(),
                                    documentedDateTime: luxon_1.DateTime.now().toUTC().toString(),
                                    performerType: state.performerType,
                                    medicationUsed: state.medicationUsed,
                                    bodySite: state.bodySite !== OTHER ? state.bodySite : (_t = state.otherBodySite) === null || _t === void 0 ? void 0 : _t.trim(),
                                    bodySide: state.bodySide,
                                    technique: state.technique,
                                    suppliesUsed: state.suppliesUsed !== OTHER ? state.suppliesUsed : (_u = state.otherSuppliesUsed) === null || _u === void 0 ? void 0 : _u.trim(),
                                    procedureDetails: state.procedureDetails,
                                    specimenSent: state.specimenSent,
                                    complications: state.complications !== OTHER ? state.complications : (_v = state.otherComplications) === null || _v === void 0 ? void 0 : _v.trim(),
                                    patientResponse: state.patientResponse,
                                    postInstructions: state.postInstructions !== OTHER ? state.postInstructions : (_w = state.otherPostInstructions) === null || _w === void 0 ? void 0 : _w.trim(),
                                    timeSpent: state.timeSpent,
                                    documentedBy: state.documentedBy,
                                    consentObtained: state.consentObtained,
                                },
                            ],
                        })];
                case 3:
                    saveProcedureResponse = _2.sent();
                    oldProcedure = (_x = chartData === null || chartData === void 0 ? void 0 : chartData.procedures) === null || _x === void 0 ? void 0 : _x.find(function (procedure) { return procedure.resourceId === procedureId; });
                    if (!(oldProcedure != null)) return [3 /*break*/, 5];
                    return [4 /*yield*/, deleteChartData({
                            cptCodes: (_y = oldProcedure.cptCodes) === null || _y === void 0 ? void 0 : _y.filter(function (cptCode) { return cptCodesToUse_1.find(function (cptCodeToUse) { return cptCodeToUse.resourceId == cptCode.resourceId; }) == null; }),
                            diagnosis: (_z = oldProcedure.diagnoses) === null || _z === void 0 ? void 0 : _z.filter(function (diagnosis) {
                                return diagnosesToUse_1.find(function (diagnosisToUse) { return diagnosisToUse.resourceId == diagnosis.resourceId; }) == null;
                            }),
                        })];
                case 4:
                    _2.sent();
                    _2.label = 5;
                case 5:
                    savedProcedure = (_1 = (_0 = saveProcedureResponse.chartData) === null || _0 === void 0 ? void 0 : _0.procedures) === null || _1 === void 0 ? void 0 : _1[0];
                    if (savedProcedure) {
                        setPartialChartData({
                            procedures: __spreadArray(__spreadArray([], chartProcedures.filter(function (procedure) { return procedure.resourceId !== procedureId; }), true), [
                                __assign(__assign({}, savedProcedure), { cptCodes: cptCodesToUse_1, diagnoses: diagnosesToUse_1 }),
                            ], false),
                        });
                    }
                    setSaveInProgress(false);
                    (0, notistack_1.enqueueSnackbar)('Procedure saved!', { variant: 'success' });
                    navigate("/in-person/".concat(appointmentId, "/").concat(routesCSS_1.ROUTER_PATH.PROCEDURES));
                    return [3 /*break*/, 7];
                case 6:
                    _a = _2.sent();
                    setSaveInProgress(false);
                    (0, notistack_1.enqueueSnackbar)('An error has occurred while saving procedure. Please try again.', { variant: 'error' });
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var _k = (0, react_1.useState)(''), debouncedSearchTerm = _k[0], setDebouncedSearchTerm = _k[1];
    var _l = (0, telemed_1.useGetIcd10Search)({ search: debouncedSearchTerm, sabs: 'CPT' }), isSearching = _l.isFetching, data = _l.data;
    var cptSearchOptions = (data === null || data === void 0 ? void 0 : data.codes) || [];
    var debounce = (0, telemed_1.useDebounce)(800).debounce;
    var debouncedHandleInputChange = function (data) {
        debounce(function () {
            setDebouncedSearchTerm(data);
        });
    };
    var cptWidget = function () {
        var _a;
        return (<>
        <material_1.Autocomplete fullWidth blurOnSelect options={cptSearchOptions} filterOptions={function (x) { return x; }} noOptionsText={debouncedSearchTerm && cptSearchOptions.length === 0
                ? 'Nothing found for this search criteria'
                : 'Start typing to load results'} autoComplete includeInputInList disableClearable value={null} isOptionEqualToValue={function (option, value) { return value.code === option.code; }} loading={isSearching} onChange={function (_e, data) {
                updateState(function (state) {
                    var _a;
                    if (data != null) {
                        state.cptCodes = __spreadArray(__spreadArray([], ((_a = state.cptCodes) !== null && _a !== void 0 ? _a : []), true), [data], false);
                    }
                });
            }} getOptionLabel={function (option) { return (typeof option === 'string' ? option : "".concat(option.code, " ").concat(option.display)); }} renderInput={function (params) { return (<material_1.TextField {...params} size="small" label="CPT code" placeholder="Search CPT code" onChange={function (e) { return debouncedHandleInputChange(e.target.value); }}/>); }} disabled={isReadOnly}/>
        <telemed_1.ActionsList data={(_a = state.cptCodes) !== null && _a !== void 0 ? _a : []} getKey={function (value, index) { return value.resourceId || index; }} renderItem={function (value) { return (<material_1.Typography>
              {value.code} {value.display}
            </material_1.Typography>); }} renderActions={function (value) {
                return !isReadOnly ? (<telemed_1.DeleteIconButton onClick={function () {
                        return updateState(function (state) { var _a; return (state.cptCodes = (_a = state.cptCodes) === null || _a === void 0 ? void 0 : _a.filter(function (cptCode) { return cptCode.code != value.code; })); });
                    }}/>) : undefined;
            }} divider/>
      </>);
    };
    var diagnosesWidget = function () {
        var _a;
        return (<>
        <AssessmentTab_1.DiagnosesField label="Dx" onChange={function (value) {
                var preparedValue = __assign(__assign({}, value), { isPrimary: false });
                updateState(function (state) {
                    var _a;
                    state.diagnoses = __spreadArray(__spreadArray([], ((_a = state.diagnoses) !== null && _a !== void 0 ? _a : []), true), [preparedValue], false);
                });
            }} disableForPrimary={false} disabled={isReadOnly}/>
        <system_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <telemed_1.ActionsList data={(_a = state.diagnoses) !== null && _a !== void 0 ? _a : []} getKey={function (value, index) { return value.resourceId || index; }} renderItem={function (value) { return (<material_1.Typography>
                {value.display} {value.code}
              </material_1.Typography>); }} renderActions={function (value) {
                return !isReadOnly ? (<telemed_1.DeleteIconButton onClick={function () {
                        return updateState(function (state) { var _a; return (state.diagnoses = (_a = state.diagnoses) === null || _a === void 0 ? void 0 : _a.filter(function (diagnosis) { return diagnosis.code != value.code; })); });
                    }}/>) : undefined;
            }} divider/>
        </system_1.Box>
      </>);
    };
    var dropdown = function (label, options, value, stateMutator) {
        return (<material_1.FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small" disabled={isReadOnly}>
        <material_1.InputLabel id={label}>{label}</material_1.InputLabel>
        <material_1.Select label={label} labelId={label} variant="outlined" value={value !== null && value !== void 0 ? value : ''} onChange={function (e) { return updateState(function (state) { return stateMutator(e.target.value, state); }); }}>
          {(options !== null && options !== void 0 ? options : []).map(function (option) {
                return (<material_1.MenuItem key={option} value={option}>
                <material_1.Typography color="textPrimary" sx={{ fontSize: '16px' }}>
                  {option}
                </material_1.Typography>
              </material_1.MenuItem>);
            })}
        </material_1.Select>
      </material_1.FormControl>);
    };
    var otherTextInput = function (parentLabel, parentValue, value, stateMutator) {
        if (parentValue !== 'Other') {
            return <></>;
        }
        return (<material_1.TextField label={'Other ' + parentLabel.toLocaleLowerCase()} size="small" value={value !== null && value !== void 0 ? value : ''} onChange={function (e) { return updateState(function (state) { return stateMutator(e.target.value, state); }); }} disabled={isReadOnly}/>);
    };
    var radio = function (label, options, value, stateMutator, error) {
        if (error === void 0) { error = false; }
        return (<material_1.FormControl error={error} disabled={isReadOnly}>
        <material_1.FormLabel id={label}>{label}</material_1.FormLabel>
        <material_1.RadioGroup row aria-labelledby={label} onChange={function (e) { return updateState(function (state) { return stateMutator(e.target.value, state); }); }} value={value !== null && value !== void 0 ? value : ''}>
          {options.map(function (option) {
                return <material_1.FormControlLabel key={option} value={option} control={<material_1.Radio />} label={option}/>;
            })}
        </material_1.RadioGroup>
        {error ? <material_1.FormHelperText>{utils_1.REQUIRED_FIELD_ERROR_MESSAGE}</material_1.FormHelperText> : undefined}
      </material_1.FormControl>);
    };
    return (<>
      <system_1.Stack spacing={1}>
        <PageTitle_1.PageTitle label="Document Procedure" showIntakeNotesButton={false}/>
        <telemed_1.AccordionCard>
          <system_1.Stack spacing={2} style={{ padding: '24px' }}>
            <system_1.Box style={{ display: 'flex', alignItems: 'center' }}>
              <material_1.Checkbox checked={(_a = state.consentObtained) !== null && _a !== void 0 ? _a : false} onChange={function (_e, checked) { return updateState(function (state) { return (state.consentObtained = checked); }); }} disabled={isReadOnly}/>
              <material_1.Typography>
                I have obtained the{' '}
                <react_router_dom_1.Link target="_blank" to={"/consent_procedure.pdf"} style={{ color: theme.palette.primary.main }}>
                  Consent for Procedure
                </react_router_dom_1.Link>
              </material_1.Typography>
            </system_1.Box>

            <system_1.Box sx={{ marginTop: '16px', color: '#0F347C' }}>
              <WithTooltip_1.TooltipWrapper tooltipProps={WithTooltip_1.CPT_TOOLTIP_PROPS}>
                <material_1.Typography style={{ color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
                  Procedure Type & CPT Code
                </material_1.Typography>
              </WithTooltip_1.TooltipWrapper>
            </system_1.Box>

            {dropdown('Procedure type', selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.procedureTypes.map(function (procedureType) { return procedureType.name; }), state.procedureType, function (value, state) {
            var _a;
            state.procedureType = value;
            var cpt = (_a = selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.procedureTypes.find(function (procedureType) { return procedureType.name === value; })) === null || _a === void 0 ? void 0 : _a.cpt;
            if (cpt != null) {
                state.cptCodes = [cpt];
            }
            else {
                state.cptCodes = [];
            }
        })}
            {cptWidget()}
            <material_1.Typography style={{ marginTop: '8px', color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
              Dx
            </material_1.Typography>
            {diagnosesWidget()}
            <material_1.Typography style={{ marginTop: '8px', color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
              Procedure Details
            </material_1.Typography>
            <system_1.Stack direction="row" spacing={2}>
              <x_date_pickers_pro_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
                <x_date_pickers_pro_1.DatePicker label="Date of the procedure" slotProps={{
            textField: {
                InputLabelProps: { shrink: true },
                InputProps: { size: 'small', placeholder: 'MM/DD/YYYY' },
            },
        }} value={state.procedureDate} onChange={function (date, _e) { return updateState(function (state) { return (state.procedureDate = date); }); }} disabled={isReadOnly}/>
              </x_date_pickers_pro_1.LocalizationProvider>
              <x_date_pickers_pro_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
                <x_date_pickers_pro_1.TimePicker label="Time of the procedure" slotProps={{
            textField: {
                InputLabelProps: { shrink: true },
                InputProps: { size: 'small' },
            },
        }} value={state.procedureTime} onChange={function (time, _e) { return updateState(function (state) { return (state.procedureTime = time); }); }} disabled={isReadOnly}/>
              </x_date_pickers_pro_1.LocalizationProvider>
            </system_1.Stack>
            {radio('Performed by', PERFORMED_BY, state.performerType, function (value, state) { return (state.performerType = value); })}
            <InfoAlert_1.InfoAlert text="Please include body part including laterality, type and quantity anesthesia used, specific materials (type and quantity) used, technique, findings, complications, specimen sent, and after-procedure status."/>
            {dropdown('Anaesthesia / medication used', selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.medicationsUsed, state.medicationUsed, function (value, state) { return (state.medicationUsed = value); })}
            {dropdown('Site/location', selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.bodySites, state.bodySite, function (value, state) {
            state.bodySite = value;
            state.otherBodySite = undefined;
        })}
            {otherTextInput('Site/location', state.bodySite, state.otherBodySite, function (value, state) { return (state.otherBodySite = value); })}
            {dropdown('Side of body', selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.bodySides, state.bodySide, function (value, state) { return (state.bodySide = value); })}
            {dropdown('Technique', selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.techniques, state.technique, function (value, state) { return (state.technique = value); })}
            {dropdown('Instruments / supplies used', selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.supplies, state.suppliesUsed, function (value, state) {
            state.suppliesUsed = value;
            state.otherSuppliesUsed = undefined;
        })}
            {otherTextInput('Instruments / supplies used', state.suppliesUsed, state.otherSuppliesUsed, function (value, state) { return (state.otherSuppliesUsed = value); })}
            <material_1.TextField label="Procedure details" multiline rows={4} value={(_b = state.procedureDetails) !== null && _b !== void 0 ? _b : ''} onChange={function (e) { return updateState(function (state) { return (state.procedureDetails = e.target.value); }); }} disabled={isReadOnly}/>
            {radio('Specimen sent', SPECIMEN_SENT, state.specimenSent != null ? (state.specimenSent ? 'Yes' : 'No') : undefined, function (value, state) { return (state.specimenSent = value === 'Yes'); })}
            {dropdown('Complications', selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.complications, state.complications, function (value, state) {
            state.complications = value;
            state.otherComplications = undefined;
        })}
            {otherTextInput('Complications', state.complications, state.otherComplications, function (value, state) { return (state.otherComplications = value); })}
            {dropdown('Patient response', selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.patientResponses, state.patientResponse, function (value, state) { return (state.patientResponse = value); })}
            {dropdown('Post-procedure Instructions', selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.postProcedureInstructions, state.postInstructions, function (value, state) {
            state.postInstructions = value;
            state.otherPostInstructions = undefined;
        })}
            {otherTextInput('Post-procedure Instructions', state.postInstructions, state.otherPostInstructions, function (value, state) { return (state.otherPostInstructions = value); })}
            {dropdown('Time spent', selectOptions === null || selectOptions === void 0 ? void 0 : selectOptions.timeSpent, state.timeSpent, function (value, state) { return (state.timeSpent = value); })}
            {radio('Documented by', DOCUMENTED_BY, state.documentedBy, function (value, state) { return (state.documentedBy = value); })}
            <material_1.Divider orientation="horizontal"/>
            <system_1.Box style={{ display: 'flex', justifyContent: 'space-between' }}>
              <RoundedButton_1.RoundedButton color="primary" onClick={onCancel}>
                Cancel
              </RoundedButton_1.RoundedButton>
              <RoundedButton_1.RoundedButton color="primary" variant="contained" disabled={isReadOnly} onClick={onSave}>
                Save
              </RoundedButton_1.RoundedButton>
            </system_1.Box>
          </system_1.Stack>
        </telemed_1.AccordionCard>
      </system_1.Stack>
      <material_1.Backdrop sx={function (theme) { return ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 }); }} open={saveInProgress}>
        <material_1.CircularProgress color="inherit"/>
      </material_1.Backdrop>
    </>);
}
function getPredefinedValueOrOther(value, predefinedValues) {
    if (value != null && (predefinedValues === null || predefinedValues === void 0 ? void 0 : predefinedValues.includes(value))) {
        return value;
    }
    return value != null ? OTHER : undefined;
}
function getPredefinedValueIfOther(value, predefinedValues) {
    if (value != null && !(predefinedValues === null || predefinedValues === void 0 ? void 0 : predefinedValues.includes(value))) {
        return value;
    }
    return undefined;
}
function useSelectOptions(oystehr) {
    var _this = this;
    return (0, react_query_1.useQuery)(['procedures-new-dropdown-options'], function () { return __awaiter(_this, void 0, void 0, function () {
        var valueSets;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (oystehr == null) {
                        return [2 /*return*/, []];
                    }
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'ValueSet',
                            params: [
                                {
                                    name: 'url',
                                    value: [
                                        utils_1.PROCEDURE_TYPES_VALUE_SET_URL,
                                        utils_1.MEDICATIONS_USED_VALUE_SET_URL,
                                        utils_1.BODY_SITES_VALUE_SET_URL,
                                        utils_1.BODY_SIDES_VALUE_SET_URL,
                                        utils_1.TECHNIQUES_VALUE_SET_URL,
                                        utils_1.SUPPLIES_VALUE_SET_URL,
                                        utils_1.COMPLICATIONS_VALUE_SET_URL,
                                        utils_1.PATIENT_RESPONSES_VALUE_SET_URL,
                                        utils_1.POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL,
                                        utils_1.TIME_SPENT_VALUE_SET_URL,
                                    ].join(','),
                                },
                            ],
                        })];
                case 1:
                    valueSets = (_a.sent()).unbundle();
                    return [2 /*return*/, {
                            procedureTypes: getProcedureTypes(valueSets),
                            medicationsUsed: getValueSetValues(utils_1.MEDICATIONS_USED_VALUE_SET_URL, valueSets),
                            bodySites: getValueSetValues(utils_1.BODY_SITES_VALUE_SET_URL, valueSets),
                            bodySides: getValueSetValues(utils_1.BODY_SIDES_VALUE_SET_URL, valueSets),
                            techniques: getValueSetValues(utils_1.TECHNIQUES_VALUE_SET_URL, valueSets),
                            supplies: getValueSetValues(utils_1.SUPPLIES_VALUE_SET_URL, valueSets),
                            complications: getValueSetValues(utils_1.COMPLICATIONS_VALUE_SET_URL, valueSets),
                            patientResponses: getValueSetValues(utils_1.PATIENT_RESPONSES_VALUE_SET_URL, valueSets),
                            postProcedureInstructions: getValueSetValues(utils_1.POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL, valueSets),
                            timeSpent: getValueSetValues(utils_1.TIME_SPENT_VALUE_SET_URL, valueSets),
                        }];
            }
        });
    }); }, {
        onError: function (_err) {
            return [];
        },
        keepPreviousData: true,
        staleTime: constants_1.QUERY_STALE_TIME,
    });
}
function getValueSetValues(valueSetUrl, valueSets) {
    var _a, _b, _c;
    var valueSet = valueSets === null || valueSets === void 0 ? void 0 : valueSets.find(function (valueSet) { return valueSet.url === valueSetUrl; });
    return (_c = (_b = (_a = valueSet === null || valueSet === void 0 ? void 0 : valueSet.expansion) === null || _a === void 0 ? void 0 : _a.contains) === null || _b === void 0 ? void 0 : _b.flatMap(function (item) { return (item.display != null ? [item.display] : []); })) !== null && _c !== void 0 ? _c : [];
}
function getProcedureTypes(valueSets) {
    var _a, _b, _c;
    var valueSet = valueSets === null || valueSets === void 0 ? void 0 : valueSets.find(function (valueSet) { return valueSet.url === utils_1.PROCEDURE_TYPES_VALUE_SET_URL; });
    return ((_c = (_b = (_a = valueSet === null || valueSet === void 0 ? void 0 : valueSet.expansion) === null || _a === void 0 ? void 0 : _a.contains) === null || _b === void 0 ? void 0 : _b.flatMap(function (item) {
        var _a, _b, _c, _d;
        var name = item.display;
        if (name == null) {
            return [];
        }
        var cptCodeableConcept = (_b = (_a = item.extension) === null || _a === void 0 ? void 0 : _a.find(function (extension) { return extension.url === utils_1.PROCEDURE_TYPE_CPT_EXTENSION_URL; })) === null || _b === void 0 ? void 0 : _b.valueCodeableConcept;
        var cptCode = (_c = cptCodeableConcept === null || cptCodeableConcept === void 0 ? void 0 : cptCodeableConcept.coding) === null || _c === void 0 ? void 0 : _c[0].code;
        var cptDisplay = (_d = cptCodeableConcept === null || cptCodeableConcept === void 0 ? void 0 : cptCodeableConcept.coding) === null || _d === void 0 ? void 0 : _d[0].display;
        var cpt = cptCode != null && cptDisplay != null ? { code: cptCode, display: cptDisplay } : undefined;
        return [{ name: name, cpt: cpt }];
    })) !== null && _c !== void 0 ? _c : []);
}
//# sourceMappingURL=ProceduresNew.js.map