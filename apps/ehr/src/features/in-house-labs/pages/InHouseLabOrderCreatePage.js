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
exports.InHouseLabOrderCreatePage = void 0;
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
var appointment_store_1 = require("../../../telemed/state/appointment/appointment.store");
var InHouseLabsNotesCard_1 = require("../components/details/InHouseLabsNotesCard");
var InHouseLabsBreadcrumbs_1 = require("../components/InHouseLabsBreadcrumbs");
var InHouseLabOrderCreatePage = function () {
    var theme = (0, material_1.useTheme)();
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var location = (0, react_router_dom_1.useLocation)();
    var _a = (0, react_1.useState)(false), loading = _a[0], setLoading = _a[1];
    var _b = (0, react_1.useState)([]), availableTests = _b[0], setAvailableTests = _b[1];
    var _c = (0, react_1.useState)(null), selectedTest = _c[0], setSelectedTest = _c[1];
    var _d = (0, react_1.useState)(''), relatedCptCode = _d[0], setRelatedCptCode = _d[1];
    var _e = (0, react_1.useState)(''), notes = _e[0], setNotes = _e[1];
    var _f = (0, react_1.useState)(''), providerName = _f[0], setProviderName = _f[1];
    var _g = (0, react_1.useState)(undefined), error = _g[0], setError = _g[1];
    var _h = (0, react_1.useState)(false), repeatTest = _h[0], setRepeatTest = _h[1];
    var prefillData = location.state;
    var _j = (0, getSelectors_1.getSelectors)(appointment_store_1.useAppointmentStore, [
        'chartData',
        'encounter',
        'appointment',
        'setPartialChartData',
    ]), chartData = _j.chartData, encounter = _j.encounter, appointment = _j.appointment, setPartialChartData = _j.setPartialChartData;
    var _k = (chartData || {}).diagnosis, diagnosis = _k === void 0 ? [] : _k;
    var didPrimaryDiagnosisInit = (0, react_1.useRef)(false);
    // already added diagnoses may have "added via in-house lab order" flag with true and false values
    // so, the "select dx" dropdown will show all diagnoses that are displayed on the Assessment page regardless of their source
    var _l = (0, react_1.useState)([]), selectedAssessmentDiagnoses = _l[0], setSelectedAssessmentDiagnoses = _l[1];
    // new diagnoses, the will have "added via in-house lab order" flag with true value,
    // and they will be linked to appointment resources in the create-in-house-lab-order zambda
    var _m = (0, react_1.useState)([]), selectedNewDiagnoses = _m[0], setSelectedNewDiagnoses = _m[1];
    // init selectedAssessmentDiagnoses with primary diagnosis
    (0, react_1.useEffect)(function () {
        var _a;
        if (didPrimaryDiagnosisInit.current) {
            return;
        }
        var primaryDiagnosis = [(_a = chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis) === null || _a === void 0 ? void 0 : _a.find(function (d) { return d.isPrimary; })].filter(function (d) { return !!d; });
        if (primaryDiagnosis.length && !selectedAssessmentDiagnoses.length) {
            setSelectedAssessmentDiagnoses(primaryDiagnosis);
            didPrimaryDiagnosisInit.current = true;
        }
    }, [chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis, selectedAssessmentDiagnoses]);
    // used to fetch dx icd10 codes
    var _o = (0, react_1.useState)(''), debouncedSearchTerm = _o[0], setDebouncedSearchTerm = _o[1];
    var _p = (0, telemed_1.useGetIcd10Search)({ search: debouncedSearchTerm, sabs: 'ICD10CM' }), isSearching = _p.isFetching, data = _p.data;
    var icdSearchOptions = (data === null || data === void 0 ? void 0 : data.codes) || [];
    var debounce = (0, telemed_1.useDebounce)(800).debounce;
    var debouncedHandleInputChange = function (data) {
        debounce(function () {
            setDebouncedSearchTerm(data);
        });
    };
    var attendingPractitionerId = (0, utils_1.getAttendingPractitionerId)(encounter);
    (0, react_1.useEffect)(function () {
        if (!oystehrZambda) {
            return;
        }
        var fetchLabs = function () { return __awaiter(void 0, void 0, void 0, function () {
            var response, testItems, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, 3, 4]);
                        setLoading(true);
                        return [4 /*yield*/, (0, api_1.getCreateInHouseLabOrderResources)(oystehrZambda, {
                                encounterId: encounter.id,
                            })];
                    case 1:
                        response = _a.sent();
                        testItems = Object.values(response.labs || {});
                        setAvailableTests(testItems.sort(function (a, b) { return a.name.localeCompare(b.name); }));
                        setProviderName(response.providerName);
                        return [3 /*break*/, 4];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Error fetching labs:', error_1);
                        return [3 /*break*/, 4];
                    case 3:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        if (encounter.id) {
            void fetchLabs();
        }
    }, [oystehrZambda, encounter === null || encounter === void 0 ? void 0 : encounter.id]);
    (0, react_1.useEffect)(function () {
        if (prefillData) {
            var testItemName_1 = prefillData.testItemName, diagnoses = prefillData.diagnoses;
            if (testItemName_1) {
                var found = availableTests.find(function (test) { return test.name === testItemName_1; });
                console.log('found', found);
                if (found) {
                    setSelectedTest(found);
                    setRepeatTest(true);
                    setRelatedCptCode(found.cptCode[0]); // we dont have any tests with more than one
                }
            }
            if (diagnoses) {
                setSelectedAssessmentDiagnoses(diagnoses);
            }
        }
    }, [prefillData, availableTests]);
    var handleBack = function () {
        navigate(-1);
    };
    var canBeSubmitted = !!((encounter === null || encounter === void 0 ? void 0 : encounter.id) && selectedTest && relatedCptCode);
    var handleSubmit = function (e_1) {
        var args_1 = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args_1[_i - 1] = arguments[_i];
        }
        return __awaiter(void 0, __spreadArray([e_1], args_1, true), void 0, function (e, shouldPrintLabel) {
            var GENERIC_ERROR_MSG, res, savedDiagnoses, labelPdfs, labelPdf, e_2, sdkError, errorMessage;
            var _a, _b, _c;
            if (shouldPrintLabel === void 0) { shouldPrintLabel = false; }
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        e.preventDefault();
                        setLoading(true);
                        GENERIC_ERROR_MSG = 'There was an error creating in-house lab order';
                        if (!(oystehrZambda && canBeSubmitted)) return [3 /*break*/, 8];
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 5, 6, 7]);
                        return [4 /*yield*/, (0, api_1.createInHouseLabOrder)(oystehrZambda, {
                                encounterId: encounter.id,
                                testItem: selectedTest,
                                cptCode: relatedCptCode,
                                diagnosesAll: __spreadArray(__spreadArray([], selectedAssessmentDiagnoses, true), selectedNewDiagnoses, true),
                                diagnosesNew: selectedNewDiagnoses,
                                isRepeatTest: repeatTest,
                                notes: notes,
                            })];
                    case 2:
                        res = _d.sent();
                        savedDiagnoses = [];
                        try {
                            savedDiagnoses = ((_c = (_b = (_a = res === null || res === void 0 ? void 0 : res.saveChartDataResponse) === null || _a === void 0 ? void 0 : _a.output) === null || _b === void 0 ? void 0 : _b.chartData) === null || _c === void 0 ? void 0 : _c.diagnosis) || [];
                        }
                        catch (error) {
                            console.error('Failed to extract diagnosis from response:', error);
                        }
                        // update chart data local state with new diagnoses after successful creation to see actual diagnoses in the Assessment page
                        setPartialChartData({
                            diagnosis: __spreadArray(__spreadArray([], ((chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis) || []), true), savedDiagnoses, true),
                        });
                        if (!shouldPrintLabel) return [3 /*break*/, 4];
                        return [4 /*yield*/, (0, api_1.getOrCreateVisitLabel)(oystehrZambda, { encounterId: encounter.id })];
                    case 3:
                        labelPdfs = _d.sent();
                        if (labelPdfs.length !== 1) {
                            setError(['Expected 1 label pdf, received unexpected number']);
                        }
                        labelPdf = labelPdfs[0];
                        window.open(labelPdf.presignedURL, '_blank');
                        _d.label = 4;
                    case 4:
                        if (res.serviceRequestId) {
                            navigate("/in-person/".concat(appointment === null || appointment === void 0 ? void 0 : appointment.id, "/in-house-lab-orders/").concat(res.serviceRequestId, "/order-details"));
                        }
                        return [3 /*break*/, 7];
                    case 5:
                        e_2 = _d.sent();
                        sdkError = e_2;
                        console.error('error creating in house lab order', sdkError.code, sdkError.message);
                        if ((0, utils_1.isApiError)(sdkError)) {
                            console.log('is api error');
                            setError([sdkError.message || GENERIC_ERROR_MSG]);
                        }
                        else {
                            setError([GENERIC_ERROR_MSG]);
                        }
                        return [3 /*break*/, 7];
                    case 6:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        if (!canBeSubmitted) {
                            errorMessage = [];
                            if (!selectedTest)
                                errorMessage.push('Please select a test to order');
                            if (!attendingPractitionerId)
                                errorMessage.push('No attending practitioner has been assigned to this encounter');
                            if (errorMessage.length === 0)
                                errorMessage.push(GENERIC_ERROR_MSG);
                            setError(errorMessage);
                            setLoading(false);
                        }
                        _d.label = 9;
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    var handleTestSelection = function (selectedTest) {
        if (!(availableTests === null || availableTests === void 0 ? void 0 : availableTests.length)) {
            return;
        }
        var foundEntry = availableTests.find(function (test) { return test.name === selectedTest; });
        if (!foundEntry) {
            return;
        }
        setSelectedTest(foundEntry);
        setRelatedCptCode(foundEntry.cptCode[0]); // we dont have any tests with more than one
    };
    return (<DetailPageContainer_1.default>
      <InHouseLabsBreadcrumbs_1.InHouseLabsBreadcrumbs pageName="Order In-House Lab">
        <material_1.Typography variant="h4" color="primary.dark" sx={{ mb: 3 }}>
          Order In-house Lab
        </material_1.Typography>

        <material_1.Paper sx={{ p: 4 }}>
          {loading ? (<material_1.Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <material_1.CircularProgress />
            </material_1.Box>) : (<form onSubmit={handleSubmit}>
              <material_1.Grid container spacing={3}>
                <material_1.Grid item xs={12}>
                  <material_1.FormControl fullWidth required sx={{
                '& .MuiInputBase-root': {
                    height: '40px',
                },
                '& .MuiSelect-select': {
                    display: 'flex',
                    alignItems: 'center',
                    paddingTop: 0,
                    paddingBottom: 0,
                },
            }}>
                    <material_1.InputLabel id="test-type-label" sx={{
                transform: 'translate(14px, 10px) scale(1)',
                '&.MuiInputLabel-shrink': {
                    transform: 'translate(14px, -9px) scale(0.75)',
                },
            }}>
                      Test
                    </material_1.InputLabel>
                    <material_1.Select labelId="test-type-label" id="test-type" value={(selectedTest === null || selectedTest === void 0 ? void 0 : selectedTest.name) || ''} label="Test" onChange={function (e) { return handleTestSelection(e.target.value); }}>
                      {availableTests.map(function (test) { return (<material_1.MenuItem key={test.name} value={test.name}>
                          {test.name}
                        </material_1.MenuItem>); })}
                    </material_1.Select>
                  </material_1.FormControl>
                </material_1.Grid>

                {relatedCptCode && (<>
                    <material_1.Grid item xs={(selectedTest === null || selectedTest === void 0 ? void 0 : selectedTest.repeatable) ? 8.5 : 12}>
                      <material_1.TextField InputProps={{
                    readOnly: true,
                    sx: {
                        '& input': {
                            cursor: 'default',
                        },
                        height: '40px',
                    },
                }} fullWidth label="CPT Code" focused={false} value={relatedCptCode} sx={{
                    '& .MuiOutlinedInput-root': {
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(0, 0, 0, 0.23)',
                        },
                    },
                }}/>
                    </material_1.Grid>
                    {(selectedTest === null || selectedTest === void 0 ? void 0 : selectedTest.repeatable) && (<material_1.Grid item xs={3.5}>
                        <material_1.FormControlLabel sx={{
                        backgroundColor: 'transparent',
                        pr: 0,
                    }} control={<material_1.Checkbox size="small" checked={repeatTest} onChange={function () { return setRepeatTest(!repeatTest); }}/>} label={<material_1.Typography variant="body1">Run as Repeat</material_1.Typography>}/>
                      </material_1.Grid>)}
                  </>)}

                {repeatTest && (<>
                    <material_1.Grid item xs={10}>
                      <material_1.TextField InputProps={{
                    readOnly: true,
                    sx: {
                        '& input': {
                            cursor: 'default',
                        },
                        height: '40px',
                    },
                }} fullWidth label="CPT Code Modifier" focused={false} value={'91'} sx={{
                    '& .MuiOutlinedInput-root': {
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(0, 0, 0, 0.23)',
                        },
                    },
                }}/>
                    </material_1.Grid>
                    {/* indicates that the test is “CLIA waived”, should just be hardcoded for repeats */}
                    <material_1.Grid item xs={2} sx={{ display: 'flex', alignItems: 'center' }}>
                      <material_1.Typography variant="body1">QW</material_1.Typography>
                    </material_1.Grid>
                  </>)}

                <material_1.Grid item xs={12}>
                  <material_1.FormControl fullWidth sx={{
                '& .MuiInputBase-root': {
                    height: '40px',
                },
                '& .MuiSelect-select': {
                    display: 'flex',
                    alignItems: 'center',
                    paddingTop: 0,
                    paddingBottom: 0,
                },
            }}>
                    <material_1.InputLabel id="diagnosis-label" sx={{
                transform: 'translate(14px, 10px) scale(1)',
                '&.MuiInputLabel-shrink': {
                    transform: 'translate(14px, -9px) scale(0.75)',
                },
            }}>
                      Select Dx
                    </material_1.InputLabel>
                    <material_1.Select labelId="diagnosis-label" id="diagnosis" multiple value={selectedAssessmentDiagnoses.map(function (dx) { return dx.code; })} label="Select Dx" onChange={function (e) {
                var dxCodesFromSelect = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                var diagnosesFomSelect = dxCodesFromSelect
                    .map(function (code) { return diagnosis.find(function (dx) { return dx.code === code; }); })
                    .filter(function (dx) { return Boolean(dx); });
                setSelectedAssessmentDiagnoses(__spreadArray([], diagnosesFomSelect, true));
            }} renderValue={function (selected) {
                if (selected.length === 0) {
                    return <em>Select diagnoses</em>;
                }
                return selected.map(function (code) {
                    var dx = diagnosis.find(function (d) { return d.code === code; });
                    return dx ? <material_1.Chip key={dx.code} size="small" label={"".concat(dx.code, " ").concat(dx.display)}/> : code;
                });
            }}>
                      {diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.map(function (dx) { return (<material_1.MenuItem key={dx.code} value={dx.code}>
                          {dx.code} {dx.display}
                        </material_1.MenuItem>); })}
                    </material_1.Select>
                  </material_1.FormControl>
                </material_1.Grid>

                <material_1.Grid item xs={12}>
                  <material_1.Autocomplete blurOnSelect id="select-additional-dx" size="small" fullWidth filterOptions={function (x) { return x; }} noOptionsText={debouncedSearchTerm && icdSearchOptions.length === 0
                ? 'Nothing found for this search criteria'
                : 'Start typing to load results'} value={null} isOptionEqualToValue={function (option, value) { return value.code === option.code; }} onChange={function (_event, selectedDx) {
                if (!selectedDx) {
                    return;
                }
                var alreadySelected = selectedNewDiagnoses.find(function (tempDx) { return tempDx.code === (selectedDx === null || selectedDx === void 0 ? void 0 : selectedDx.code); }) ||
                    selectedAssessmentDiagnoses.find(function (tempDx) { return tempDx.code === (selectedDx === null || selectedDx === void 0 ? void 0 : selectedDx.code); });
                if (!alreadySelected) {
                    setSelectedNewDiagnoses(function (diagnoses) { return __spreadArray(__spreadArray([], diagnoses, true), [
                        __assign(__assign({}, selectedDx), { addedViaLabOrder: true, isPrimary: false }),
                    ], false); });
                }
                else {
                    (0, notistack_1.enqueueSnackbar)('This Dx is already added to the order', {
                        variant: 'error',
                    });
                }
            }} loading={isSearching} options={icdSearchOptions} getOptionLabel={function (option) {
                return typeof option === 'string' ? option : "".concat(option.code, " ").concat(option.display);
            }} renderInput={function (params) { return (<material_1.TextField {...params} onChange={function (e) { return debouncedHandleInputChange(e.target.value); }} label="Additional Dx" placeholder="Search for Dx if not on list above" InputLabelProps={{ shrink: true }}/>); }}/>
                </material_1.Grid>

                {(selectedAssessmentDiagnoses.length > 0 || selectedNewDiagnoses.length > 0) && (<material_1.Grid item xs={12}>
                    <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <telemed_1.ActionsList data={selectedAssessmentDiagnoses} getKey={function (value, index) { return value.resourceId || index; }} renderItem={function (value) { return (<material_1.Typography>
                            {value.display} {value.code}
                          </material_1.Typography>); }} renderActions={function (value) { return (<telemed_1.DeleteIconButton onClick={function () {
                        return setSelectedAssessmentDiagnoses(function (diagnoses) {
                            return diagnoses.filter(function (dxVal) { return dxVal.code !== value.code; });
                        });
                    }}/>); }}/>
                      <telemed_1.ActionsList data={selectedNewDiagnoses} getKey={function (value, index) { return value.resourceId || index; }} renderItem={function (value) { return (<material_1.Typography>
                            {value.display} {value.code}
                          </material_1.Typography>); }} renderActions={function (value) { return (<telemed_1.DeleteIconButton onClick={function () {
                        return setSelectedNewDiagnoses(function (diagnoses) {
                            return diagnoses.filter(function (dxVal) { return dxVal.code !== value.code; });
                        });
                    }}/>); }}/>
                    </material_1.Box>
                  </material_1.Grid>)}

                {/* <Grid item xs={12}>
              <TextField
                fullWidth
                id="notes"
                label="Notes (optional)"
                multiline
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Grid> */}

                <material_1.Grid item xs={12}>
                  <InHouseLabsNotesCard_1.InHouseLabsNotesCard notes={notes} notesLabel={'Notes (optional)'} readOnly={false} additionalBoxSxProps={{ mb: 3 }} additionalTextFieldProps={{ minRows: 4 }} handleNotesUpdate={function (newNote) { return setNotes(newNote); }}/>
                </material_1.Grid>

                {providerName && (<material_1.Grid item xs={12}>
                    <material_1.Typography variant="body1" sx={{ mt: 2 }}>
                      Ordering provider: {providerName}
                    </material_1.Typography>
                  </material_1.Grid>)}

                <material_1.Grid item xs={12} sx={{ mt: 3 }}>
                  <material_1.Stack direction="row" spacing={2} justifyContent="space-between">
                    <material_1.Button variant="outlined" onClick={handleBack} sx={{
                borderRadius: '50px',
                px: 4,
                py: 1,
            }}>
                      Cancel
                    </material_1.Button>
                    <material_1.Box>
                      <material_1.Button variant="contained" onClick={function (e) { return handleSubmit(e, true); }} disabled={!canBeSubmitted} sx={{
                borderRadius: '50px',
                px: 4,
                py: 1,
                mr: 2,
            }}>
                        Order & Print Label
                      </material_1.Button>
                      <material_1.Button variant="contained" type="submit" disabled={!canBeSubmitted} sx={{
                borderRadius: '50px',
                px: 4,
                py: 1,
            }}>
                        Order
                      </material_1.Button>
                    </material_1.Box>
                  </material_1.Stack>
                </material_1.Grid>
                {error &&
                error.length > 0 &&
                error.map(function (msg, idx) { return (<material_1.Grid item xs={12} sx={{ textAlign: 'right', paddingTop: 1 }} key={idx}>
                      <material_1.Typography sx={{ color: theme.palette.error.main }}>
                        {typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}
                      </material_1.Typography>
                    </material_1.Grid>); })}
              </material_1.Grid>
            </form>)}
        </material_1.Paper>
      </InHouseLabsBreadcrumbs_1.InHouseLabsBreadcrumbs>
    </DetailPageContainer_1.default>);
};
exports.InHouseLabOrderCreatePage = InHouseLabOrderCreatePage;
//# sourceMappingURL=InHouseLabOrderCreatePage.js.map