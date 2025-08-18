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
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../telemed");
var useOystehrAPIClient_1 = require("../../../../telemed/hooks/useOystehrAPIClient");
var NavigationContext_1 = require("../../context/NavigationContext");
var useChartData_1 = require("../../hooks/useChartData");
var AskThePatientComponent = function () {
    var _a, _b, _c;
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var theme = (0, material_1.useTheme)();
    var _d = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, [
        'chartData',
        'updateObservation',
        'encounter',
    ]), chartData = _d.chartData, updateObservation = _d.updateObservation, encounter = _d.encounter;
    var _e = (0, useChartData_1.useChartData)({
        encounterId: (encounter === null || encounter === void 0 ? void 0 : encounter.id) || '',
        requestedFields: {
            observations: {
                _tag: utils_1.ADDITIONAL_QUESTIONS_META_SYSTEM,
                _search_by: 'encounter',
            },
        },
        enabled: false,
    }), refetchChartData = _e.refetch, isChartDataLoading = _e.isLoading;
    var deleteChartData = (0, telemed_1.useDeleteChartData)().mutate;
    var debounce = (0, telemed_1.useDebounce)(1000).debounce;
    var _f = (0, react_1.useState)(''), recentVisitKey = _f[0], setRecentVisitKey = _f[1];
    var _g = (0, react_1.useState)(null), patientVaccinationKey = _g[0], setPatientVaccinationKey = _g[1];
    var _h = (0, react_1.useState)(''), vaccinationNotes = _h[0], setVaccinationNotes = _h[1];
    var _j = (0, react_1.useState)(''), historySourceKey = _j[0], setHistorySourceKey = _j[1];
    var _k = (0, react_1.useState)(''), otherReason = _k[0], setOtherReason = _k[1];
    var _l = (0, react_1.useState)(false), historySourceUpdating = _l[0], setHistorySourceUpdating = _l[1];
    var _m = (0, react_1.useState)(false), patientVaccinationUpdating = _m[0], setPatientVaccinationUpdating = _m[1];
    var _o = (0, react_1.useState)(false), vaccinationNotesUpdating = _o[0], setVaccinationNotesUpdating = _o[1];
    var _p = (0, react_1.useState)(false), recentVisitUpdating = _p[0], setRecentVisitUpdating = _p[1];
    var setNavigationDisable = (0, NavigationContext_1.useNavigationContext)().setNavigationDisable;
    setNavigationDisable({ isAskPatientFieldsUpdating: recentVisitUpdating || historySourceUpdating });
    var currentSeenInLastThreeYearsObs = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _a === void 0 ? void 0 : _a.find(function (obs) { return obs.field === utils_1.SEEN_IN_LAST_THREE_YEARS_FIELD; });
    var currentHistoryObtainedFromObs = (_b = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _b === void 0 ? void 0 : _b.find(function (obs) { return obs.field === utils_1.HISTORY_OBTAINED_FROM_FIELD; });
    var currentPatientVaccinationFromObs = (_c = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _c === void 0 ? void 0 : _c.find(function (obs) { return obs.field === utils_1.PATIENT_VACCINATION_STATUS; });
    (0, react_1.useEffect)(function () {
        var _a, _b, _c;
        var seenInLastThreeYearsObs = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _a === void 0 ? void 0 : _a.find(function (obs) { return obs.field === utils_1.SEEN_IN_LAST_THREE_YEARS_FIELD; });
        var historyObtainedFromObs = (_b = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _b === void 0 ? void 0 : _b.find(function (obs) { return obs.field === utils_1.HISTORY_OBTAINED_FROM_FIELD; });
        var patientVaccinationFromObs = (_c = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _c === void 0 ? void 0 : _c.find(function (obs) { return obs.field === utils_1.PATIENT_VACCINATION_STATUS; });
        if (seenInLastThreeYearsObs === null || seenInLastThreeYearsObs === void 0 ? void 0 : seenInLastThreeYearsObs.value) {
            setRecentVisitKey(seenInLastThreeYearsObs.value);
        }
        if (historyObtainedFromObs === null || historyObtainedFromObs === void 0 ? void 0 : historyObtainedFromObs.value) {
            setHistorySourceKey(historyObtainedFromObs.value);
            if (historyObtainedFromObs.value === utils_1.HistorySourceKeys.NotObtainedOther) {
                setOtherReason(historyObtainedFromObs.note);
            }
        }
        if (patientVaccinationFromObs === null || patientVaccinationFromObs === void 0 ? void 0 : patientVaccinationFromObs.value) {
            setPatientVaccinationKey(patientVaccinationFromObs.value);
        }
        if (patientVaccinationFromObs === null || patientVaccinationFromObs === void 0 ? void 0 : patientVaccinationFromObs.note) {
            setVaccinationNotes(patientVaccinationFromObs === null || patientVaccinationFromObs === void 0 ? void 0 : patientVaccinationFromObs.note);
        }
    }, [chartData]);
    var handleSaveObservation = function (observation, setIsLoading) { return __awaiter(void 0, void 0, void 0, function () {
        var result, _a;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    setIsLoading(true);
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, ((_b = apiClient === null || apiClient === void 0 ? void 0 : apiClient.saveChartData) === null || _b === void 0 ? void 0 : _b.call(apiClient, {
                            encounterId: (encounter === null || encounter === void 0 ? void 0 : encounter.id) || '',
                            observations: [observation],
                        }))];
                case 2:
                    result = _e.sent();
                    if ((_d = (_c = result === null || result === void 0 ? void 0 : result.chartData) === null || _c === void 0 ? void 0 : _c.observations) === null || _d === void 0 ? void 0 : _d[0]) {
                        updateObservation(result.chartData.observations[0]);
                    }
                    return [3 /*break*/, 5];
                case 3:
                    _a = _e.sent();
                    (0, notistack_1.enqueueSnackbar)('An error occurred while saving the information. Please try again.', {
                        variant: 'error',
                    });
                    return [3 /*break*/, 5];
                case 4:
                    setIsLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleRecentVisitChange = function (value) {
        setRecentVisitKey(value);
        void handleSaveObservation(currentSeenInLastThreeYearsObs
            ? __assign(__assign({}, currentSeenInLastThreeYearsObs), { value: value }) : {
            field: utils_1.SEEN_IN_LAST_THREE_YEARS_FIELD,
            value: value,
        }, setRecentVisitUpdating);
    };
    var handleHistorySourceChange = function (value) {
        if (value === utils_1.HistorySourceKeys.NotObtainedOther) {
            setHistorySourceKey(utils_1.HistorySourceKeys.NotObtainedOther);
        }
        else {
            void handleSaveObservation(currentHistoryObtainedFromObs
                ? __assign(__assign({}, currentHistoryObtainedFromObs), { value: value }) : {
                field: utils_1.HISTORY_OBTAINED_FROM_FIELD,
                value: value,
            }, setHistorySourceUpdating);
        }
    };
    var handlePatientVaccinationStatusChange = function (value) {
        setPatientVaccinationKey(value);
        var curValues = {
            field: utils_1.PATIENT_VACCINATION_STATUS,
            value: value,
        };
        if (vaccinationNotes) {
            curValues['note'] = vaccinationNotes;
        }
        void handleSaveObservation(currentPatientVaccinationFromObs
            ? __assign(__assign({}, currentPatientVaccinationFromObs), { value: value }) : __assign({}, curValues), setPatientVaccinationUpdating);
    };
    var handleVaccinationNotesChange = function (vaccinationNoteInput) {
        debounce(function () {
            if (!patientVaccinationKey) {
                (0, notistack_1.enqueueSnackbar)('Please select a vaccination status above', { variant: 'error' });
                return;
            }
            var curValues = {
                field: utils_1.PATIENT_VACCINATION_STATUS,
                value: patientVaccinationKey,
            };
            if (vaccinationNoteInput) {
                void handleSaveObservation(__assign(__assign(__assign({}, currentPatientVaccinationFromObs), curValues), { note: vaccinationNoteInput }), setVaccinationNotesUpdating);
            }
            else if (currentPatientVaccinationFromObs) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var note = currentPatientVaccinationFromObs.note, patientVaccinationFromObsNoNote = __rest(currentPatientVaccinationFromObs, ["note"]); // remove the note
                void handleSaveObservation(__assign(__assign({}, patientVaccinationFromObsNoNote), curValues), setVaccinationNotesUpdating);
            }
            else {
                void handleSaveObservation(__assign({}, curValues), setVaccinationNotesUpdating);
            }
        });
    };
    var handleOtherReasonChange = function (value) {
        debounce(function () {
            if (value) {
                void handleSaveObservation(__assign(__assign({}, currentHistoryObtainedFromObs), { field: utils_1.HISTORY_OBTAINED_FROM_FIELD, value: utils_1.HistorySourceKeys.NotObtainedOther, note: value }), setHistorySourceUpdating);
            }
            else if (currentHistoryObtainedFromObs) {
                setHistorySourceUpdating(true);
                // TODO check if onError cb works correctly
                deleteChartData({ observations: [currentHistoryObtainedFromObs] }, {
                    onSuccess: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, refetchChartData()];
                                case 1:
                                    _a.sent();
                                    setHistorySourceUpdating(false);
                                    return [2 /*return*/];
                            }
                        });
                    }); },
                    onError: function () {
                        setHistorySourceUpdating(false);
                    },
                });
            }
        });
    };
    return (<material_1.Paper elevation={3} sx={{ p: 3, mt: 3, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <material_1.Grid container>
        <material_1.Grid item xs={12}>
          <material_1.Typography variant="subtitle2" sx={{ color: colors_1.otherColors.orange700, mb: 2 }}>
            ASK THE PATIENT
          </material_1.Typography>
        </material_1.Grid>

        <material_1.Grid item xs={12}>
          <material_1.Grid item xs={6}>
            <material_1.Typography sx={{
            color: theme.palette.primary.dark,
            mb: 1,
            fontWeight: 'bold',
        }}>
              Has the patient been seen in one of our offices / telemed in last 3 years?
            </material_1.Typography>

            <material_1.FormControl component="fieldset" disabled={recentVisitUpdating || isChartDataLoading}>
              <material_1.RadioGroup row value={recentVisitKey} onChange={function (e) { return handleRecentVisitChange(e.target.value); }}>
                {Object.values(utils_1.RecentVisitKeys).map(function (key) { return (<material_1.FormControlLabel key={key} value={key} control={<material_1.Radio />} label={utils_1.recentVisitLabels[key]}/>); })}
              </material_1.RadioGroup>
            </material_1.FormControl>
          </material_1.Grid>
          <material_1.Grid item xs={6}>
            <material_1.Typography sx={{
            color: theme.palette.primary.dark,
            mt: 2,
            mb: 1,
            fontWeight: 'bold',
        }}>
              Has the patient received vaccinations?
            </material_1.Typography>

            <material_1.FormControl component="fieldset" disabled={patientVaccinationUpdating || isChartDataLoading}>
              <material_1.RadioGroup row value={patientVaccinationKey} onChange={function (e) { return handlePatientVaccinationStatusChange(e.target.value); }}>
                {Object.values(utils_1.PatientVaccinationKeys).map(function (key) { return (<material_1.FormControlLabel key={key} value={key} control={<material_1.Radio />} label={utils_1.patientVaccinationLabels[key]}/>); })}
              </material_1.RadioGroup>
            </material_1.FormControl>

            <material_1.TextField fullWidth label="Vaccination notes" variant="outlined" sx={{ mt: 2 }} value={vaccinationNotes} onChange={function (e) {
            setVaccinationNotes(e.target.value);
            handleVaccinationNotesChange(e.target.value);
        }} disabled={vaccinationNotesUpdating || isChartDataLoading}/>
          </material_1.Grid>
          <material_1.Grid item xs={6}>
            <material_1.Typography sx={{
            color: theme.palette.primary.dark,
            mt: 2,
            mb: 1,
            fontWeight: 'bold',
        }}>
              History obtained from
            </material_1.Typography>

            <material_1.FormControl fullWidth>
              <material_1.Select value={historySourceKey} onChange={function (e) { return handleHistorySourceChange(e.target.value); }} displayEmpty disabled={historySourceUpdating || isChartDataLoading} renderValue={function (selected) {
            return selected ? utils_1.historySourceLabels[selected] : 'Select an option';
        }}>
                <material_1.MenuItem value="">
                  <em>Select an option</em>
                </material_1.MenuItem>
                {Object.values(utils_1.HistorySourceKeys).map(function (key) { return (<material_1.MenuItem key={key} value={key}>
                    {utils_1.historySourceLabels[key]}
                  </material_1.MenuItem>); })}
              </material_1.Select>
            </material_1.FormControl>

            {historySourceKey === utils_1.HistorySourceKeys.NotObtainedOther && (<material_1.TextField fullWidth placeholder="Please specify*" variant="outlined" sx={{ mt: 2 }} value={otherReason} onChange={function (e) {
                setOtherReason(e.target.value);
                handleOtherReasonChange(e.target.value);
            }} disabled={historySourceUpdating || isChartDataLoading}/>)}
          </material_1.Grid>
        </material_1.Grid>
      </material_1.Grid>
    </material_1.Paper>);
};
exports.default = AskThePatientComponent;
//# sourceMappingURL=AskThePatient.js.map