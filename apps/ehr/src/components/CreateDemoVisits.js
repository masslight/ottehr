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
var auth0_react_1 = require("@auth0/auth0-react");
var colors_1 = require("@ehrTheme/colors");
var icons_1 = require("@ehrTheme/icons");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var react_1 = require("react");
var utils_1 = require("utils");
var location_1 = require("utils/lib/fhir/location");
var helpers_1 = require("utils/lib/helpers");
var useAppClients_1 = require("../hooks/useAppClients");
var createAppointmentZambdaId = import.meta.env.VITE_APP_CREATE_APPOINTMENT_ZAMBDA_ID;
var intakeZambdaUrl = import.meta.env.VITE_APP_PROJECT_API_ZAMBDA_URL;
var CreateDemoVisits = function () {
    var _a = (0, react_1.useState)(''), phoneNumber = _a[0], setPhoneNumber = _a[1];
    var _b = (0, react_1.useState)(false), inputError = _b[0], setInputError = _b[1];
    var _c = (0, react_1.useState)(false), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)({
        open: false,
        message: '',
        severity: 'success',
    }), snackbar = _d[0], setSnackbar = _d[1];
    var getAccessTokenSilently = (0, auth0_react_1.useAuth0)().getAccessTokenSilently;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var selectedLocation = JSON.parse(localStorage.getItem('selectedLocation') || '{}');
    var handleCreateSampleAppointments = function (event) { return __awaiter(void 0, void 0, void 0, function () {
        var formattedPhoneNumber, authToken, telemedLocations, telemedLocation, error_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    event.preventDefault();
                    if (!selectedLocation || JSON.stringify(selectedLocation) === '{}') {
                        setSnackbar({
                            open: true,
                            message: 'No location selected in filters, please select a location first',
                            severity: 'error',
                        });
                        return [2 /*return*/];
                    }
                    formattedPhoneNumber = formatPhoneNumber(phoneNumber);
                    if (!formattedPhoneNumber) {
                        setInputError(true);
                        return [2 /*return*/];
                    }
                    else {
                        setInputError(false);
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 5, 6, 7]);
                    setLoading(true);
                    setInputError(false);
                    return [4 /*yield*/, getAccessTokenSilently()];
                case 2:
                    authToken = _c.sent();
                    return [4 /*yield*/, (oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.search({
                            resourceType: 'Location',
                            params: [
                                { name: 'status', value: 'active' },
                                { name: 'address-state:missing', value: 'false' },
                            ],
                        }))];
                case 3:
                    telemedLocations = (_a = (_c.sent())) === null || _a === void 0 ? void 0 : _a.unbundle();
                    telemedLocation = telemedLocations === null || telemedLocations === void 0 ? void 0 : telemedLocations.find(function (loc) { return (0, location_1.isLocationVirtual)(loc); });
                    return [4 /*yield*/, Promise.all([
                            (0, helpers_1.createSampleAppointments)({
                                oystehr: oystehr,
                                authToken: authToken,
                                phoneNumber: formattedPhoneNumber,
                                serviceMode: utils_1.ServiceMode['in-person'],
                                createAppointmentZambdaId: createAppointmentZambdaId,
                                zambdaUrl: intakeZambdaUrl,
                                selectedLocationId: selectedLocation.id,
                                projectId: import.meta.env.VITE_APP_PROJECT_ID,
                                demoData: { numberOfAppointments: 5 },
                            }),
                            telemedLocation
                                ? (0, helpers_1.createSampleAppointments)({
                                    oystehr: oystehr,
                                    serviceMode: utils_1.ServiceMode.virtual,
                                    authToken: authToken,
                                    phoneNumber: formattedPhoneNumber,
                                    createAppointmentZambdaId: createAppointmentZambdaId,
                                    zambdaUrl: intakeZambdaUrl,
                                    selectedLocationId: telemedLocation === null || telemedLocation === void 0 ? void 0 : telemedLocation.id,
                                    projectId: import.meta.env.VITE_APP_PROJECT_ID,
                                    demoData: { numberOfAppointments: 5 },
                                    locationState: (_b = telemedLocation === null || telemedLocation === void 0 ? void 0 : telemedLocation.address) === null || _b === void 0 ? void 0 : _b.state,
                                })
                                : Promise.resolve(),
                        ])];
                case 4:
                    _c.sent();
                    setSnackbar({
                        open: true,
                        message: 'Appointments created successfully!',
                        severity: 'success',
                    });
                    return [3 /*break*/, 7];
                case 5:
                    error_1 = _c.sent();
                    setSnackbar({
                        open: true,
                        message: 'Error creating appointments',
                        severity: 'error',
                    });
                    console.error(error_1);
                    return [3 /*break*/, 7];
                case 6:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var formatPhoneNumber = function (phone) {
        var digitsOnly = phone.replace(/\D/g, '');
        if (digitsOnly.length === 10) {
            return digitsOnly;
        }
        else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
            return digitsOnly.slice(1);
        }
        return null;
    };
    var handleCloseSnackbar = function (event, reason) {
        // cSpell:disable-next clickaway
        if (reason === 'clickaway') {
            return;
        }
        setSnackbar(function (prev) { return (__assign(__assign({}, prev), { open: false })); });
    };
    var handleChange = function (e) {
        var input = e.target.value;
        setPhoneNumber(input);
    };
    return (<system_1.Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            backgroundColor: colors_1.otherColors.lightBlue,
            px: 2.5,
            py: 1.5,
            borderRadius: 2,
            mt: 2,
        }}>
      <system_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
        <material_1.Typography variant="h6" color="primary.main">
          Lack of test data? Create demo visits
        </material_1.Typography>
        <material_1.Typography variant="body2" color="text.secondary">
          Please enter a phone number to create visits for this user
        </material_1.Typography>
      </system_1.Box>
      <system_1.Box sx={{ display: 'flex', flexGrow: 1, gap: 2, alignItems: 'center' }}>
        <material_1.TextField label="Phone Number" value={phoneNumber} onChange={handleChange} size="small" sx={{
            flexGrow: 1,
            '& .MuiOutlinedInput-root': {
                '& fieldset': {
                    borderColor: inputError ? 'error.main' : 'rgba(0, 0, 0, 0.23)',
                },
                '& input': {
                    backgroundColor: 'white',
                },
            },
        }} required error={inputError} helperText={inputError ? 'Please enter a valid phone number' : ''}/>
        <lab_1.LoadingButton loading={loading} onClick={handleCreateSampleAppointments} size="small" type="submit" sx={{
            borderRadius: 10,
            border: '1px solid #2169F5',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 2,
            py: 0.75,
            flexShrink: 0,
            minHeight: 0,
            '& .MuiButton-startIcon': {
                margin: 0,
            },
        }} startIcon={<img src={icons_1.createDemoVisits} alt="create demo visits" style={{ width: 16, height: 16 }}/>}>
          <material_1.Typography variant="button" sx={{ textTransform: 'none', textWrap: 'nowrap' }}>
            Create Demo Visits
          </material_1.Typography>
        </lab_1.LoadingButton>
      </system_1.Box>
      <material_1.Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <material_1.Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </material_1.Alert>
      </material_1.Snackbar>
    </system_1.Box>);
};
exports.default = CreateDemoVisits;
//# sourceMappingURL=CreateDemoVisits.js.map