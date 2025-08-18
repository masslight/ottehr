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
exports.CreateRadiologyOrder = void 0;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var helpers_1 = require("src/features/css-module/routing/helpers");
var api_1 = require("../../../api/api");
var useAppClients_1 = require("../../../hooks/useAppClients");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var RadiologyBreadcrumbs_1 = require("../components/RadiologyBreadcrumbs");
var defaultStudies = [
    { code: '71045', display: 'X-ray of chest, 1 view' },
    { code: '71046', display: 'X-ray of chest, 2 views' },
    { code: '74018', display: 'X-ray of abdomen, 1 view' },
    { code: '74019', display: 'X-ray of abdomen, 2 views' },
    { code: '76010', display: 'X-ray from nose to rectum' },
    { code: '73000', display: 'X-ray of collar bone' },
    { code: '73010', display: 'X-ray of shoulder blade' },
    { code: '73020', display: 'X-ray of shoulder, 1 view' },
    { code: '73060', display: 'X-ray of upper arm, minimum of 2 views' },
    { code: '73070', display: 'X-ray of elbow, 2 views' },
    { code: '73090', display: 'X-ray of forearm, 2 views' },
    { code: '73100', display: 'X-ray of wrist, 2 views' },
    { code: '73120', display: 'X-ray of hand, 2 views' },
    { code: '73140', display: 'X-ray of finger, minimum of 2 views' },
    { code: '72170', display: 'X-ray of pelvis, 1-2 views' },
    { code: '73552', display: 'X-ray of thigh bone, minimum 2 views' },
    { code: '73560', display: 'X-ray of knee, 1-2 views' },
    { code: '73590', display: 'X-ray of lower leg, 2 views' },
    { code: '73600', display: 'X-ray of ankle, 2 views' },
    { code: '73610', display: 'X-ray of ankle, minimum of 3 views' },
    { code: '73620', display: 'X-ray of foot, 2 views' },
    { code: '73630', display: 'X-ray of foot, minimum of 3 views' },
    { code: '73660', display: 'X-ray of toe, minimum of 2 views' },
];
var CreateRadiologyOrder = function () {
    var theme = (0, material_1.useTheme)();
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, react_1.useState)(undefined), error = _a[0], setError = _a[1];
    var _b = (0, react_1.useState)(false), submitting = _b[0], setSubmitting = _b[1];
    var saveChartData = (0, telemed_1.useSaveChartData)().mutate;
    var _c = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, [
        'chartData',
        'encounter',
        'appointment',
        'setPartialChartData',
    ]), chartData = _c.chartData, encounter = _c.encounter, appointment = _c.appointment, setPartialChartData = _c.setPartialChartData;
    var diagnosis = (chartData || {}).diagnosis;
    var primaryDiagnosis = diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.find(function (d) { return d.isPrimary; });
    var _d = (0, react_1.useState)(primaryDiagnosis ? primaryDiagnosis : undefined), orderDx = _d[0], setOrderDx = _d[1];
    var _e = (0, react_1.useState)(), orderCpt = _e[0], setOrderCpt = _e[1];
    var _f = (0, react_1.useState)(false), stat = _f[0], setStat = _f[1];
    var _g = (0, react_1.useState)(), clinicalHistory = _g[0], setClinicalHistory = _g[1];
    // used to fetch dx icd10 codes
    var _h = (0, react_1.useState)(''), dxDebouncedSearchTerm = _h[0], setDxDebouncedSearchTerm = _h[1];
    var _j = (0, telemed_1.useGetIcd10Search)({
        search: dxDebouncedSearchTerm,
        sabs: 'ICD10CM',
    }), isSearchingDx = _j.isFetching, dxData = _j.data;
    var icdSearchOptions = dxDebouncedSearchTerm === '' && diagnosis ? diagnosis : (dxData === null || dxData === void 0 ? void 0 : dxData.codes) || [];
    var debounceDx = (0, telemed_1.useDebounce)(800).debounce;
    var debouncedDxHandleInputChange = function (data) {
        debounceDx(function () {
            setDxDebouncedSearchTerm(data);
        });
    };
    // used to fetch cpt codes
    var _k = (0, react_1.useState)(''), cptDebouncedSearchTerm = _k[0], setCptDebouncedSearchTerm = _k[1];
    var _l = (0, telemed_1.useGetIcd10Search)({
        search: cptDebouncedSearchTerm,
        sabs: 'CPT',
        radiologyOnly: true, // Only fetch CPT codes related to radiology
    }), isSearchingCpt = _l.isFetching, cptData = _l.data;
    var cptSearchOptions = (cptData === null || cptData === void 0 ? void 0 : cptData.codes) || defaultStudies;
    var debounce = (0, telemed_1.useDebounce)(800).debounce;
    var debouncedCptHandleInputChange = function (data) {
        debounce(function () {
            setCptDebouncedSearchTerm(data);
        });
    };
    var handleSubmit = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var paramsSatisfied, e_1, error_1, errorMessage, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    setSubmitting(true);
                    paramsSatisfied = orderDx && orderCpt && encounter.id && clinicalHistory && clinicalHistory.length <= 255;
                    if (!(oystehrZambda && paramsSatisfied && encounter.id)) return [3 /*break*/, 6];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, addAdditionalDxToEncounter()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, api_1.createRadiologyOrder)(oystehrZambda, {
                            diagnosisCode: orderDx.code,
                            cptCode: orderCpt.code,
                            encounterId: encounter.id,
                            stat: stat,
                            clinicalHistory: clinicalHistory,
                        })];
                case 3:
                    _a.sent();
                    navigate((0, helpers_1.getRadiologyUrl)((appointment === null || appointment === void 0 ? void 0 : appointment.id) || ''));
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _a.sent();
                    error_1 = e_1;
                    console.log('error', JSON.stringify(error_1));
                    errorMessage = ['There was an error completing the order'];
                    setError(errorMessage);
                    return [3 /*break*/, 5];
                case 5: return [3 /*break*/, 7];
                case 6:
                    if (!paramsSatisfied) {
                        errorMessage = [];
                        if (!orderDx)
                            errorMessage.push('Please enter a diagnosis to continue');
                        if (!orderCpt)
                            errorMessage.push('Please select a study type (CPT code) to continue');
                        if (!clinicalHistory)
                            errorMessage.push('Please enter clinical history to continue');
                        if (clinicalHistory && clinicalHistory.length > 255)
                            errorMessage.push('Clinical history must be 255 characters or less');
                        if (errorMessage.length === 0)
                            errorMessage.push('There was an error completing the order');
                        setError(errorMessage);
                    }
                    _a.label = 7;
                case 7:
                    setSubmitting(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var addAdditionalDxToEncounter = function () { return __awaiter(void 0, void 0, void 0, function () {
        var alreadyExistsOnEncounter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (orderDx === undefined)
                        return [2 /*return*/];
                    alreadyExistsOnEncounter = diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.find(function (d) { return d.code === orderDx.code; });
                    if (alreadyExistsOnEncounter) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            saveChartData({
                                diagnosis: [orderDx],
                            }, {
                                onSuccess: function (data) {
                                    var returnedDiagnosis = data.chartData.diagnosis || [];
                                    var allDx = __spreadArray(__spreadArray([], returnedDiagnosis, true), (diagnosis || []), true);
                                    if (allDx) {
                                        setPartialChartData({
                                            diagnosis: __spreadArray([], allDx, true),
                                        });
                                    }
                                    resolve();
                                },
                                onError: function (error) {
                                    reject(error);
                                },
                            });
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    return (<RadiologyBreadcrumbs_1.WithRadiologyBreadcrumbs sectionName="Order Radiology">
      <material_1.Stack spacing={1}>
        <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <material_1.Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
            Order Radiology
          </material_1.Typography>
        </material_1.Box>

        <form onSubmit={handleSubmit}>
          <material_1.Paper sx={{ p: 3 }}>
            <material_1.Grid container sx={{ width: '100%' }} spacing={1} rowSpacing={2}>
              <material_1.Grid item xs={12}>
                <material_1.Autocomplete blurOnSelect id="select-dx" size="small" fullWidth filterOptions={function (x) { return x; }} noOptionsText={dxDebouncedSearchTerm && icdSearchOptions.length === 0
            ? 'Nothing found for this search criteria'
            : 'Start typing to load results'} value={orderDx || null} isOptionEqualToValue={function (option, value) { return value.code === option.code; }} onChange={function (_event, selectedDx) {
            setOrderDx(selectedDx);
        }} loading={isSearchingDx} options={icdSearchOptions} getOptionLabel={function (option) {
            return typeof option === 'string' ? option : "".concat(option.code, " ").concat(option.display);
        }} renderInput={function (params) { return (<material_1.TextField {...params} onChange={function (e) { return debouncedDxHandleInputChange(e.target.value); }} label="Diagnosis" placeholder="Select diagnosis from list or search" multiline InputLabelProps={{ shrink: true }}/>); }}/>
              </material_1.Grid>
              <material_1.Grid item xs={12}>
                <material_1.Autocomplete blurOnSelect id="select-cpt" size="small" fullWidth filterOptions={function (x) { return x; }} noOptionsText={cptDebouncedSearchTerm && cptSearchOptions.length === 0
            ? 'Nothing found for this search criteria'
            : 'Start typing to load results'} value={orderCpt || null} isOptionEqualToValue={function (option, value) { return value.code === option.code; }} onChange={function (_event, selectedCpt) {
            setOrderCpt(selectedCpt);
        }} loading={isSearchingCpt} options={cptSearchOptions} getOptionLabel={function (option) {
            return typeof option === 'string' ? option : "".concat(option.code, " ").concat(option.display);
        }} renderInput={function (params) { return (<material_1.TextField {...params} onChange={function (e) { return debouncedCptHandleInputChange(e.target.value); }} label="Study Type" placeholder="Search for CPT Code" multiline InputLabelProps={{ shrink: true }}/>); }}/>
              </material_1.Grid>
              <material_1.Grid item xs={12}>
                <material_1.TextField id="clinical-history" label="Clinical History" placeholder="Enter clinical history for the radiology order" fullWidth multiline size="small" value={clinicalHistory} onChange={function (e) {
            var value = e.target.value;
            if (value.length <= 255) {
                setClinicalHistory(value);
            }
        }} error={clinicalHistory !== undefined && clinicalHistory.length > 255} helperText={clinicalHistory !== undefined && clinicalHistory.length > 255
            ? 'Clinical history must be 255 characters or less'
            : "".concat((clinicalHistory === null || clinicalHistory === void 0 ? void 0 : clinicalHistory.length) || 0, "/255 characters")}/>
              </material_1.Grid>
              <material_1.Grid item xs={12}>
                <material_1.FormControlLabel sx={{ fontSize: '14px' }} control={<material_1.Switch checked={stat} onChange={function () { return setStat(!stat); }}/>} label={<material_1.Typography variant="body2">STAT</material_1.Typography>}/>
              </material_1.Grid>
              <material_1.Grid item xs={6}>
                <material_1.Button variant="outlined" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }} onClick={function () {
            navigate("/in-person/".concat(appointment === null || appointment === void 0 ? void 0 : appointment.id, "/radiology"));
        }}>
                  Cancel
                </material_1.Button>
              </material_1.Grid>
              <material_1.Grid item xs={6} display="flex" justifyContent="flex-end">
                <lab_1.LoadingButton loading={submitting} type="submit" variant="contained" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}>
                  Order
                </lab_1.LoadingButton>
              </material_1.Grid>
              {error &&
            error.length > 0 &&
            error.map(function (msg, idx) { return (<material_1.Grid item xs={12} sx={{ textAlign: 'right', paddingTop: 1 }} key={idx}>
                    <material_1.Typography sx={{ color: theme.palette.error.main }}>
                      {typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}
                    </material_1.Typography>
                  </material_1.Grid>); })}
            </material_1.Grid>
          </material_1.Paper>
        </form>
      </material_1.Stack>
    </RadiologyBreadcrumbs_1.WithRadiologyBreadcrumbs>);
};
exports.CreateRadiologyOrder = CreateRadiologyOrder;
//# sourceMappingURL=CreateRadiologyOrder.js.map