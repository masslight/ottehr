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
Object.defineProperty(exports, "__esModule", { value: true });
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var telemed_1 = require("../../../../telemed");
var useAppointment_1 = require("../../hooks/useAppointment");
var useChartData_1 = require("../../hooks/useChartData");
var ProfileAvatar_1 = require("../ProfileAvatar");
var getPatientDisplayedName = function (patient) {
    var _a, _b, _c, _d, _e;
    if (!patient) {
        return '';
    }
    var emptyIfUndefined = function (value) { return value !== null && value !== void 0 ? value : ''; };
    var nameEntryOfficial = (_a = patient === null || patient === void 0 ? void 0 : patient.name) === null || _a === void 0 ? void 0 : _a.find(function (nameEntry) { return nameEntry.use === 'official'; });
    var nameEntryNickname = (_b = patient === null || patient === void 0 ? void 0 : patient.name) === null || _b === void 0 ? void 0 : _b.find(function (nameEntry) { return nameEntry.use === 'nickname'; });
    var firstName = (_c = nameEntryOfficial === null || nameEntryOfficial === void 0 ? void 0 : nameEntryOfficial.given) === null || _c === void 0 ? void 0 : _c[0];
    var middleName = (_d = nameEntryOfficial === null || nameEntryOfficial === void 0 ? void 0 : nameEntryOfficial.given) === null || _d === void 0 ? void 0 : _d[1];
    var lastName = nameEntryOfficial === null || nameEntryOfficial === void 0 ? void 0 : nameEntryOfficial.family;
    var preferredName = (_e = nameEntryNickname === null || nameEntryNickname === void 0 ? void 0 : nameEntryNickname.given) === null || _e === void 0 ? void 0 : _e[0];
    var startingPart = lastName ? "".concat(lastName, ",") : '';
    var middlePart = "".concat(emptyIfUndefined(firstName), " ").concat(emptyIfUndefined(middleName)).trim();
    var endingPart = preferredName ? "(".concat(preferredName, ")") : '';
    return "".concat(startingPart, " ").concat(middlePart, " ").concat(endingPart);
};
var GeneralInfoCard = function () {
    var _a;
    var _b, _c;
    var theme = (0, material_1.useTheme)();
    var _d = (0, useAppointment_1.useAppointment)(), telemedData = _d.visitState, resources = _d.resources, mappedData = _d.mappedData;
    var patientData = telemedData.patient;
    var encounterId = resources.encounter.id;
    var fieldName = 'patientInfoConfirmed';
    var requestedFields = (_a = {}, _a[fieldName] = {}, _a);
    var _e = (0, useChartData_1.useChartData)({ encounterId: encounterId, requestedFields: requestedFields }), chartData = _e.chartData, isLoadingChartData = _e.isLoading;
    (0, react_1.useEffect)(function () {
        var _a, _b;
        if (!chartData) {
            return;
        }
        var isPatientInfoConfirmed = (_b = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.patientInfoConfirmed) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : false;
        setVerifiedNameAndDob(isPatientInfoConfirmed);
    }, [chartData]);
    var _f = (0, react_1.useState)(false), isVerifiedNameAndDob = _f[0], setVerifiedNameAndDob = _f[1];
    var _g = (0, telemed_1.useSaveChartData)(), updateVerificationStatusAsync = _g.mutateAsync, isUpdatingVerificationStatus = _g.isLoading;
    var isCheckboxDisabled = isLoadingChartData || chartData === undefined || isUpdatingVerificationStatus;
    var handlePatientInfoVerified = (0, react_1.useCallback)(function (isChecked) { return __awaiter(void 0, void 0, void 0, function () {
        var data, patientInfoConfirmedUpdated, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setVerifiedNameAndDob(isChecked);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, updateVerificationStatusAsync({ patientInfoConfirmed: { value: isChecked } })];
                case 2:
                    data = _c.sent();
                    patientInfoConfirmedUpdated = data.chartData.patientInfoConfirmed;
                    if (patientInfoConfirmedUpdated) {
                        setVerifiedNameAndDob((_b = patientInfoConfirmedUpdated.value) !== null && _b !== void 0 ? _b : false);
                    }
                    return [3 /*break*/, 4];
                case 3:
                    _a = _c.sent();
                    (0, notistack_1.enqueueSnackbar)('An error has occurred while saving patient info verification status. Please try again.', {
                        variant: 'error',
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [updateVerificationStatusAsync]);
    var dateOfBirth = (patientData === null || patientData === void 0 ? void 0 : patientData.birthDate) ? (_b = luxon_1.DateTime.fromISO(patientData === null || patientData === void 0 ? void 0 : patientData.birthDate)) === null || _b === void 0 ? void 0 : _b.toFormat('MM/dd/yyyy') : '';
    return (<material_1.Paper elevation={3} sx={{ p: 3, mt: 3, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <material_1.Grid container>
        <material_1.Grid item xs={6} container>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <material_1.Box sx={{ display: 'flex' }}>
              <ProfileAvatar_1.ProfileAvatar embracingSquareSize={100} hasEditableInfo/>

              <material_1.Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
                <material_1.Typography variant="body1" sx={{
            color: theme.palette.primary.dark,
            fontSize: '18px',
            fontWeight: 500,
        }}>
                  {getPatientDisplayedName(patientData)}
                </material_1.Typography>
                <material_1.Typography variant="body1" color={theme.palette.primary.dark} sx={{ mt: 1 }}>
                  {(_c = mappedData.pronouns) !== null && _c !== void 0 ? _c : ''}
                </material_1.Typography>
                <material_1.Typography variant="body1" color={theme.palette.primary.dark} sx={{ mt: 1 }}>
                  DOB: {dateOfBirth}
                </material_1.Typography>
              </material_1.Box>
            </material_1.Box>

            <material_1.Box>
              <material_1.FormControlLabel sx={{
            mr: 0,
            backgroundColor: (0, material_1.alpha)(theme.palette.primary.main, 0.08),
            borderRadius: 2,
            mt: 2,
            pr: 2,
        }} control={<material_1.Checkbox data-testid={data_test_ids_1.dataTestIds.patientInfoPage.patientInfoVerifiedCheckbox} sx={{
                color: theme.palette.primary.main,
                '&.Mui-checked': {
                    color: theme.palette.primary.main,
                },
                '&.Mui-disabled': {
                    color: (0, material_1.lighten)(theme.palette.primary.main, 0.4),
                },
            }} disabled={isCheckboxDisabled} checked={isVerifiedNameAndDob} onChange={function (e) { return handlePatientInfoVerified(e.target.checked); }}/>} label={<material_1.Typography sx={{
                fontSize: '16px',
                fontWeight: 600,
                color: isCheckboxDisabled ? (0, material_1.lighten)(theme.palette.text.primary, 0.4) : theme.palette.text.primary,
            }}>
                    I verified patient's name and date of birth
                  </material_1.Typography>}/>
            </material_1.Box>
          </material_1.Box>
        </material_1.Grid>
      </material_1.Grid>
    </material_1.Paper>);
};
exports.default = GeneralInfoCard;
//# sourceMappingURL=GeneralInfoCard.js.map