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
exports.default = PatientFollowupForm;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var x_date_pickers_1 = require("@mui/x-date-pickers");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var x_date_pickers_pro_1 = require("@mui/x-date-pickers-pro");
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var api_1 = require("../../api/api");
var useAppClients_1 = require("../../hooks/useAppClients");
var LocationSelect_1 = require("../LocationSelect");
function PatientFollowupForm(_a) {
    var _this = this;
    var patient = _a.patient, followupDetails = _a.followupDetails, followupStatus = _a.followupStatus, setFollowupStatus = _a.setFollowupStatus;
    var theme = (0, material_1.useTheme)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var patientId = patient === null || patient === void 0 ? void 0 : patient.id;
    var _b = (0, react_1.useState)(false), loading = _b[0], setLoading = _b[1];
    var storedLocation = localStorage === null || localStorage === void 0 ? void 0 : localStorage.getItem('selectedLocation');
    var parsedStoredLocation = storedLocation ? JSON.parse(storedLocation) : undefined;
    var _c = (0, react_1.useState)((followupDetails === null || followupDetails === void 0 ? void 0 : followupDetails.location) ? followupDetails === null || followupDetails === void 0 ? void 0 : followupDetails.location : parsedStoredLocation), selectedLocation = _c[0], setSelectedLocation = _c[1];
    var _d = (0, react_1.useState)((followupDetails === null || followupDetails === void 0 ? void 0 : followupDetails.followupType)
        ? followupDetails.followupType === 'Non-Billable'
            ? __spreadArray([], utils_1.NON_BILLABLE_REASONS, true) : __spreadArray([], utils_1.TELEPHONE_REASONS, true)
        : []), reasonOptions = _d[0], setReasonOptions = _d[1];
    var _e = (0, react_1.useState)([]), providers = _e[0], setProviders = _e[1];
    var _f = (0, react_1.useState)((followupDetails === null || followupDetails === void 0 ? void 0 : followupDetails.followupType) || null), followupType = _f[0], setFollowupType = _f[1];
    var _g = (0, react_1.useState)((followupDetails === null || followupDetails === void 0 ? void 0 : followupDetails.reason) || null), followupReason = _g[0], setFollowupReason = _g[1];
    var _h = (0, react_1.useState)((followupDetails === null || followupDetails === void 0 ? void 0 : followupDetails.answered) || ''), answered = _h[0], setAnswered = _h[1];
    var _j = (0, react_1.useState)((followupDetails === null || followupDetails === void 0 ? void 0 : followupDetails.caller) || ''), caller = _j[0], setCaller = _j[1];
    var _k = (0, react_1.useState)((followupDetails === null || followupDetails === void 0 ? void 0 : followupDetails.start) ? luxon_1.DateTime.fromISO(followupDetails.start) : luxon_1.DateTime.now()), followupDate = _k[0], setFollowupDate = _k[1];
    var _l = (0, react_1.useState)((followupDetails === null || followupDetails === void 0 ? void 0 : followupDetails.provider) || null), provider = _l[0], setProvider = _l[1];
    var _m = (0, react_1.useState)(false), resolved = _m[0], setResolved = _m[1];
    var _o = (0, react_1.useState)((followupDetails === null || followupDetails === void 0 ? void 0 : followupDetails.message) || ''), message = _o[0], setMessage = _o[1];
    (0, react_1.useEffect)(function () {
        var _a, _b, _c;
        var locationSlug = (_b = (_a = selectedLocation === null || selectedLocation === void 0 ? void 0 : selectedLocation.identifier) === null || _a === void 0 ? void 0 : _a.find(function (identifierTemp) { return identifierTemp.system === utils_1.SLUG_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value;
        var locationState = (_c = selectedLocation === null || selectedLocation === void 0 ? void 0 : selectedLocation.address) === null || _c === void 0 ? void 0 : _c.state;
        if (!locationSlug || !locationState) {
            console.log('show some toast: location is missing slug or address.state', selectedLocation, locationSlug, locationState);
            return;
        }
    }, [selectedLocation]);
    (0, react_1.useEffect)(function () {
        var getAndSetProviders = function (client) { return __awaiter(_this, void 0, void 0, function () {
            var getEmployeesRes, providers, formattedProviders;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, api_1.getEmployees)(client)];
                    case 1:
                        getEmployeesRes = _a.sent();
                        providers = getEmployeesRes.employees.filter(function (employee) { return employee.isProvider; });
                        formattedProviders = providers.map(function (prov) {
                            var id = prov.profile.split('/')[1];
                            return {
                                practitionerId: id,
                                name: "".concat(prov.firstName, " ").concat(prov.lastName),
                            };
                        });
                        setProviders(formattedProviders);
                        return [2 /*return*/];
                }
            });
        }); };
        if (oystehrZambda && providers.length === 0) {
            void getAndSetProviders(oystehrZambda);
        }
    }, [oystehrZambda, providers]);
    var handleTypeChange = function (event, newValue) {
        var type = newValue;
        if (!type) {
            setReasonOptions([]);
            setFollowupReason(null);
        }
        else {
            setReasonOptions(type === 'Telephone Encounter' ? __spreadArray([], utils_1.TELEPHONE_REASONS, true) : __spreadArray([], utils_1.NON_BILLABLE_REASONS, true));
            if (followupType && type !== followupType)
                setFollowupReason(null);
        }
        setFollowupType(type);
    };
    var handleReasonChange = function (event, newValue) {
        var selectedReason = newValue;
        setFollowupReason(selectedReason);
    };
    var handleFormSubmit = function (event) { return __awaiter(_this, void 0, void 0, function () {
        var apiErr, errorMessage, encounterDetails, res, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event.preventDefault();
                    setLoading(true);
                    apiErr = false;
                    errorMessage = '';
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    if (!oystehrZambda)
                        throw new Error('Zambda client not found');
                    if (!followupType || !patientId) {
                        errorMessage = "Required input fields are missing: ".concat(!followupType ? 'Type, ' : '', " ").concat(!patientId ? 'Patient Id, ' : '');
                        throw new Error(errorMessage);
                    }
                    encounterDetails = {
                        encounterId: followupDetails === null || followupDetails === void 0 ? void 0 : followupDetails.encounterId,
                        followupType: followupType,
                        patientId: patientId,
                        reason: followupReason || undefined,
                        answered: answered,
                        caller: caller,
                        resolved: resolved,
                        message: message,
                        start: followupDate.toISO() || '',
                        end: resolved ? luxon_1.DateTime.now().toISO() : undefined,
                        location: selectedLocation,
                        provider: provider || undefined,
                    };
                    return [4 /*yield*/, (0, api_1.saveFollowup)(oystehrZambda, { encounterDetails: encounterDetails })];
                case 2:
                    res = _a.sent();
                    if (res.encounterId && resolved && setFollowupStatus) {
                        setFollowupStatus('RESOLVED');
                    }
                    navigate("/patient/".concat(patientId), { state: { defaultTab: 'followups' } });
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    console.error("Failed to add patient followup: ".concat(error_1));
                    if (!errorMessage)
                        errorMessage = "Failed to add patient followup: ".concat(error_1);
                    (0, notistack_1.enqueueSnackbar)(errorMessage, { variant: 'error' });
                    apiErr = true;
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    if (!apiErr) {
                        (0, notistack_1.enqueueSnackbar)('Followup saved successfully!', { variant: 'success' });
                    }
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleCancel = function () {
        if (patientId) {
            navigate("/patient/".concat(patientId), { state: { defaultTab: 'followups' } });
        }
        else {
            navigate('/visits');
        }
    };
    return (<material_1.Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <form onSubmit={function (e) { return handleFormSubmit(e); }}>
        <material_1.Grid container spacing={2} columns={10}>
          <material_1.Grid item xs={5}>
            <material_1.Autocomplete disabled={followupStatus === 'RESOLVED'} options={utils_1.FOLLOWUP_TYPES} onChange={handleTypeChange} value={followupType} fullWidth renderInput={function (params) { return (<material_1.TextField required placeholder="Select type" name="type" {...params} label="Type"/>); }}/>
          </material_1.Grid>
          <material_1.Grid item xs={5}>
            <material_1.Autocomplete disabled={followupStatus === 'RESOLVED'} options={reasonOptions} onChange={handleReasonChange} fullWidth value={followupReason} noOptionsText="Please select a type" renderInput={function (params) { return (<material_1.TextField placeholder="Select reason" name="reason" {...params} label="Reason"/>); }}/>
          </material_1.Grid>
          <material_1.Grid item xs={5}>
            <material_1.TextField disabled={followupStatus !== 'NEW'} fullWidth id="answered" label="Answered" variant="outlined" value={answered} onChange={function (e) { return setAnswered(e.target.value); }}/>
          </material_1.Grid>
          <material_1.Grid item xs={5}>
            <material_1.TextField disabled={followupStatus === 'RESOLVED'} fullWidth id="caller" label="Caller" variant="outlined" value={caller} onChange={function (e) { return setCaller(e.target.value); }}/>
          </material_1.Grid>
          <material_1.Grid item xs={5}>
            <x_date_pickers_pro_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
              <x_date_pickers_1.DatePicker disabled={followupStatus !== 'NEW'} onChange={function (val) { return val && setFollowupDate(val); }} label="Date" format="MM/dd/yyyy" value={followupDate} slotProps={{ textField: { id: 'followup-date', label: 'Date', fullWidth: true } }}/>
            </x_date_pickers_pro_1.LocalizationProvider>
          </material_1.Grid>
          <material_1.Grid item xs={5}>
            <x_date_pickers_pro_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
              <x_date_pickers_1.TimePicker disabled={followupStatus !== 'NEW'} onChange={function (val) { return val && setFollowupDate(val); }} value={followupDate} label="Time" slotProps={{
            textField: {
                fullWidth: true,
            },
        }}></x_date_pickers_1.TimePicker>
            </x_date_pickers_pro_1.LocalizationProvider>
          </material_1.Grid>
          <material_1.Grid item xs={5}>
            <LocationSelect_1.default location={selectedLocation} setLocation={setSelectedLocation} updateURL={false} renderInputProps={{ disabled: followupStatus === 'RESOLVED' }}/>
          </material_1.Grid>
          <material_1.Grid item xs={5}>
            <material_1.Autocomplete disabled={followupStatus === 'RESOLVED'} options={providers} fullWidth getOptionLabel={function (option) { return "".concat(option.name); }} isOptionEqualToValue={function (option, value) { return option.practitionerId === value.practitionerId; }} value={provider} onChange={function (_, newVal) {
            setProvider(newVal);
        }} renderOption={function (props, option) {
            return (<li {...props} key={option.practitionerId}>
                    {option.name}
                  </li>);
        }} renderInput={function (params) { return (<material_1.TextField placeholder="Select provider" name="provider" {...params} label="Provider"/>); }}/>
          </material_1.Grid>
          <material_1.Grid item xs={10}>
            <material_1.TextField disabled={followupStatus === 'RESOLVED'} fullWidth id="message" label="Message" variant="outlined" value={message} onChange={function (e) { return setMessage(e.target.value); }} multiline/>
          </material_1.Grid>
          <material_1.Grid item xs={10}>
            <material_1.Divider sx={{ ml: -3, mr: -3 }}/>
          </material_1.Grid>
          <material_1.Grid item xs={10}>
            <material_1.Box display="flex" flexDirection="row" justifyContent="space-between" gap={2}>
              <material_1.Button sx={{
            minWidth: 80,
            border: 1,
            borderRadius: 100,
            textTransform: 'none',
            fontWeight: 600,
        }} onClick={handleCancel}>
                Cancel
              </material_1.Button>
              {followupStatus !== 'RESOLVED' && (<material_1.Box display="flex" flexDirection="row">
                  <material_1.FormControlLabel sx={{
                backgroundColor: 'transparent',
                pr: 0,
            }} control={<material_1.Checkbox size="small" sx={{
                    color: theme.palette.primary.main,
                    '&.Mui-checked': {
                        color: theme.palette.primary.main,
                    },
                    '&.Mui-disabled': {
                        color: (0, material_1.lighten)(theme.palette.primary.main, 0.4),
                    },
                }} checked={resolved} onChange={function (e) { return setResolved(e.target.checked); }}/>} label={<material_1.Typography sx={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: theme.palette.text.primary,
                }}>
                        Mark as resolved
                      </material_1.Typography>}/>

                  <lab_1.LoadingButton variant="contained" type="submit" loading={loading} sx={{
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 600,
                marginRight: 1,
            }}>
                    Save
                  </lab_1.LoadingButton>
                </material_1.Box>)}
            </material_1.Box>
          </material_1.Grid>
        </material_1.Grid>
      </form>
    </material_1.Paper>);
}
//# sourceMappingURL=PatientFollowupForm.js.map