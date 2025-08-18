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
exports.CreateExternalLabOrder = void 0;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var DetailPageContainer_1 = require("src/features/common/DetailPageContainer");
var utils_1 = require("utils");
var api_1 = require("../../../api/api");
var useAppClients_1 = require("../../../hooks/useAppClients");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var LabBreadcrumbs_1 = require("../components/labs-orders/LabBreadcrumbs");
var LabOrderLoading_1 = require("../components/labs-orders/LabOrderLoading");
var LabsAutocomplete_1 = require("../components/LabsAutocomplete");
var CreateExternalLabOrder = function () {
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
        'patient',
        'setPartialChartData',
    ]), chartData = _c.chartData, encounter = _c.encounter, appointment = _c.appointment, patient = _c.patient, setPartialChartData = _c.setPartialChartData;
    var diagnosis = (chartData || {}).diagnosis;
    var primaryDiagnosis = diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.find(function (d) { return d.isPrimary; });
    var attendingPractitionerId = (0, utils_1.getAttendingPractitionerId)(encounter);
    var patientId = (patient === null || patient === void 0 ? void 0 : patient.id) || '';
    var _d = (0, react_1.useState)(primaryDiagnosis ? [primaryDiagnosis] : []), orderDx = _d[0], setOrderDx = _d[1];
    var _e = (0, react_1.useState)(null), selectedLab = _e[0], setSelectedLab = _e[1];
    var _f = (0, react_1.useState)(false), psc = _f[0], setPsc = _f[1];
    // used to fetch dx icd10 codes
    var _g = (0, react_1.useState)(''), debouncedDxSearchTerm = _g[0], setDebouncedDxSearchTerm = _g[1];
    var _h = (0, telemed_1.useGetIcd10Search)({ search: debouncedDxSearchTerm, sabs: 'ICD10CM' }), isSearching = _h.isFetching, data = _h.data;
    var icdSearchOptions = (data === null || data === void 0 ? void 0 : data.codes) || [];
    var debounce = (0, telemed_1.useDebounce)(800).debounce;
    var debouncedHandleDxInputChange = function (searchValue) {
        debounce(function () {
            setDebouncedDxSearchTerm(searchValue);
        });
    };
    var _j = (0, telemed_1.useGetCreateExternalLabResources)({
        patientId: patientId,
    }), dataLoading = _j.isFetching, createExternalLabResources = _j.data, isError = _j.isError, resourceFetchError = _j.error;
    var coverageName = createExternalLabResources === null || createExternalLabResources === void 0 ? void 0 : createExternalLabResources.coverageName;
    var handleSubmit = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var paramsSatisfied, e_1, sdkError, errorMessage, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    setSubmitting(true);
                    paramsSatisfied = orderDx.length && selectedLab;
                    if (!(oystehrZambda && paramsSatisfied)) return [3 /*break*/, 6];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, addAdditionalDxToEncounter()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, api_1.createExternalLabOrder)(oystehrZambda, {
                            dx: orderDx,
                            encounter: encounter,
                            orderableItem: selectedLab,
                            psc: psc,
                        })];
                case 3:
                    _a.sent();
                    navigate("/in-person/".concat(appointment === null || appointment === void 0 ? void 0 : appointment.id, "/external-lab-orders"));
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _a.sent();
                    sdkError = e_1;
                    console.log('error creating external lab order', sdkError.code, sdkError.message);
                    errorMessage = [sdkError.message];
                    setError(errorMessage);
                    return [3 /*break*/, 5];
                case 5: return [3 /*break*/, 7];
                case 6:
                    if (!paramsSatisfied) {
                        errorMessage = [];
                        if (!orderDx.length)
                            errorMessage.push('Please enter at least one dx');
                        if (!selectedLab)
                            errorMessage.push('Please select a lab to order');
                        if (!attendingPractitionerId)
                            errorMessage.push('No attending practitioner has been assigned to this encounter');
                        if (errorMessage.length === 0)
                            errorMessage.push('There was an error creating this external lab order');
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
        var dxToAdd;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dxToAdd = [];
                    orderDx.forEach(function (dx) {
                        var alreadyExistsOnEncounter = diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.find(function (d) { return d.code === dx.code; });
                        if (!alreadyExistsOnEncounter) {
                            dxToAdd.push(__assign(__assign({}, dx), { isPrimary: false, addedViaLabOrder: true }));
                        }
                    });
                    if (!(dxToAdd.length > 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            saveChartData({
                                diagnosis: dxToAdd,
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
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); };
    if (isError || resourceFetchError) {
        return (<DetailPageContainer_1.default>
        <LabBreadcrumbs_1.LabBreadcrumbs sectionName="Order External Lab">
          <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <material_1.Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
              Order External Lab
            </material_1.Typography>
          </material_1.Box>
          <material_1.Paper sx={{ p: 3 }}>
            {resourceFetchError && (<material_1.Grid item xs={12} sx={{ paddingTop: 1 }}>
                <material_1.Typography sx={{ color: theme.palette.error.main }}>
                  {(resourceFetchError === null || resourceFetchError === void 0 ? void 0 : resourceFetchError.message) || 'error'}
                </material_1.Typography>
              </material_1.Grid>)}
          </material_1.Paper>
        </LabBreadcrumbs_1.LabBreadcrumbs>
      </DetailPageContainer_1.default>);
    }
    return (<DetailPageContainer_1.default>
      <LabBreadcrumbs_1.LabBreadcrumbs sectionName="Order External Lab">
        <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <material_1.Typography variant="h4" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
            Order External Lab
          </material_1.Typography>
        </material_1.Box>

        {dataLoading ? (<LabOrderLoading_1.LabOrderLoading />) : (<form onSubmit={handleSubmit}>
            <material_1.Paper sx={{ p: 3 }}>
              <material_1.Grid container sx={{ width: '100%' }} spacing={1} rowSpacing={2}>
                <material_1.Grid item xs={12}>
                  <material_1.Typography variant="h6" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
                    Dx
                  </material_1.Typography>
                </material_1.Grid>
                <material_1.Grid item xs={12}>
                  <material_1.FormControl fullWidth>
                    <material_1.InputLabel id="select-dx-label" shrink>
                      Dx
                    </material_1.InputLabel>
                    <material_1.Select notched fullWidth id="select-dx" label="Dx" onChange={function (e) {
                var selectedDxCode = e.target.value;
                var selectedDx = diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.find(function (tempDx) { return tempDx.code === selectedDxCode; });
                if (selectedDx) {
                    var alreadySelected = orderDx.find(function (tempDx) { return tempDx.code === selectedDx.code; });
                    if (!alreadySelected) {
                        setOrderDx(__spreadArray(__spreadArray([], orderDx, true), [selectedDx], false));
                    }
                    else {
                        (0, notistack_1.enqueueSnackbar)('This Dx is already added to the order', {
                            variant: 'error',
                        });
                    }
                }
            }} displayEmpty value="" sx={{
                '& .MuiInputLabel-root': {
                    top: -8,
                },
            }} size="small">
                      <material_1.MenuItem value="" disabled>
                        <material_1.Typography sx={{ color: '#9E9E9E' }}>Add a Dx to Order</material_1.Typography>
                      </material_1.MenuItem>
                      {diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.map(function (d) { return (<material_1.MenuItem id={d.resourceId} key={d.resourceId} value={d.code}>
                          {d.code} {d.display}
                        </material_1.MenuItem>); })}
                    </material_1.Select>
                  </material_1.FormControl>
                </material_1.Grid>
                <material_1.Grid item xs={12}>
                  <material_1.Autocomplete blurOnSelect id="select-additional-dx" size="small" fullWidth noOptionsText={debouncedDxSearchTerm && icdSearchOptions.length === 0
                ? 'Nothing found for this search criteria'
                : 'Start typing to load results'} value={null} isOptionEqualToValue={function (option, value) { return value.code === option.code; }} onChange={function (event, selectedDx) {
                var alreadySelected = orderDx.find(function (tempDx) { return tempDx.code === selectedDx.code; });
                if (!alreadySelected) {
                    setOrderDx(__spreadArray(__spreadArray([], orderDx, true), [selectedDx], false));
                }
                else {
                    (0, notistack_1.enqueueSnackbar)('This Dx is already added to the order', {
                        variant: 'error',
                    });
                }
            }} loading={isSearching} options={icdSearchOptions} getOptionLabel={function (option) {
                return typeof option === 'string' ? option : "".concat(option.code, " ").concat(option.display);
            }} renderInput={function (params) { return (<material_1.TextField {...params} onChange={function (e) { return debouncedHandleDxInputChange(e.target.value); }} label="Additional Dx" placeholder="Search for Dx if not on list above" InputLabelProps={{ shrink: true }}/>); }}/>
                </material_1.Grid>
                {orderDx.length > 0 && (<material_1.Grid item xs={12}>
                    <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <telemed_1.ActionsList data={orderDx} getKey={function (value, index) { return value.resourceId || index; }} renderItem={function (value) { return (<material_1.Typography>
                            {value.display} {value.code}
                          </material_1.Typography>); }} renderActions={function (value) { return (<telemed_1.DeleteIconButton onClick={function () { return setOrderDx(function () { return orderDx.filter(function (dxVal) { return dxVal.code !== value.code; }); }); }}/>); }}/>
                    </material_1.Box>
                  </material_1.Grid>)}
                <material_1.Grid item xs={12}>
                  <material_1.Typography variant="h6" sx={{ fontWeight: '600px', color: theme.palette.primary.dark }}>
                    Patient insurance
                  </material_1.Typography>
                  <material_1.Typography variant="body2" sx={{ paddingTop: '8px' }}>
                    {coverageName || 'unknown'}
                  </material_1.Typography>
                </material_1.Grid>
                <material_1.Grid item xs={12}>
                  <material_1.Typography variant="h6" sx={{ fontWeight: '600px', color: theme.palette.primary.dark, marginBottom: '8px' }}>
                    Lab
                  </material_1.Typography>
                  <LabsAutocomplete_1.LabsAutocomplete selectedLab={selectedLab} setSelectedLab={setSelectedLab}></LabsAutocomplete_1.LabsAutocomplete>
                </material_1.Grid>
                <material_1.Grid item xs={12}>
                  <material_1.FormControlLabel sx={{ fontSize: '14px' }} control={<material_1.Switch checked={psc} onChange={function () { return setPsc(function (psc) { return !psc; }); }}/>} label={<material_1.Typography variant="body2">{utils_1.PSC_HOLD_LOCALE}</material_1.Typography>}/>
                </material_1.Grid>
                <material_1.Grid item xs={6}>
                  <material_1.Button variant="outlined" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }} onClick={function () {
                navigate("/in-person/".concat(appointment === null || appointment === void 0 ? void 0 : appointment.id, "/external-lab-orders"));
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
          </form>)}
      </LabBreadcrumbs_1.LabBreadcrumbs>
    </DetailPageContainer_1.default>);
};
exports.CreateExternalLabOrder = CreateExternalLabOrder;
//# sourceMappingURL=CreateExternalLabOrder.js.map