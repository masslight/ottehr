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
exports.PatientsMergeSelect = void 0;
var Close_1 = require("@mui/icons-material/Close");
var Search_1 = require("@mui/icons-material/Search");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var utils_1 = require("utils");
var formatDateTime_1 = require("../../helpers/formatDateTime");
var telemed_1 = require("../../telemed");
var RoundedButton_1 = require("../RoundedButton");
var queries_1 = require("./queries");
var PatientsMergeSelect = function (props) {
    var open = props.open, close = props.close, next = props.next, patientIds = props.patientIds;
    var isFetching = (0, queries_1.useGetPatientsForMerge)({ patientIds: patientIds }, function (data) {
        setPatients(data);
    }).isFetching;
    var getPatientById = (0, queries_1.useGetPatientById)();
    var _a = (0, react_1.useState)([]), patients = _a[0], setPatients = _a[1];
    var _b = (0, react_1.useState)(''), value = _b[0], setValue = _b[1];
    var patientRows = (0, react_1.useMemo)(function () {
        return patients.map(function (patient) {
            var _a, _b, _c, _d, _e, _f, _g;
            var fillingOutAs = (_b = (_a = patient === null || patient === void 0 ? void 0 : patient.extension) === null || _a === void 0 ? void 0 : _a.find(function (extension) { return extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/form-user'; })) === null || _b === void 0 ? void 0 : _b.valueString;
            var patientNumber = (_d = (_c = patient === null || patient === void 0 ? void 0 : patient.telecom) === null || _c === void 0 ? void 0 : _c.find(function (obj) { return obj.system === 'phone'; })) === null || _d === void 0 ? void 0 : _d.value;
            var parentNumber = (_g = (_f = (_e = patient === null || patient === void 0 ? void 0 : patient.contact) === null || _e === void 0 ? void 0 : _e[0].telecom) === null || _f === void 0 ? void 0 : _f.find(function (obj) { return (obj === null || obj === void 0 ? void 0 : obj.system) === 'phone'; })) === null || _g === void 0 ? void 0 : _g.value;
            var isPatientNumberPrimary = fillingOutAs === 'Patient (Self)';
            return {
                pid: patient.id,
                name: (0, utils_1.getFullName)(patient),
                dob: (0, formatDateTime_1.formatDateUsingSlashes)(patient.birthDate),
                primaryNumber: (0, utils_1.standardizePhoneNumber)(isPatientNumberPrimary ? patientNumber : parentNumber),
                secondaryNumber: (0, utils_1.standardizePhoneNumber)(isPatientNumberPrimary ? parentNumber : patientNumber),
            };
        });
    }, [patients]);
    var removePatient = function (id) {
        setPatients(function (prevState) { return prevState.filter(function (patient) { return patient.id !== id; }); });
    };
    var addPatient = function (id) { return __awaiter(void 0, void 0, void 0, function () {
        var bundle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getPatientById.mutateAsync(id)];
                case 1:
                    bundle = _a.sent();
                    if (bundle.length === 1) {
                        setPatients(function (prevState) { return __spreadArray(__spreadArray([], prevState, true), [bundle[0]], false); });
                        setValue('');
                    }
                    else {
                        (0, notistack_1.enqueueSnackbar)('Patient not found. Please try again', { variant: 'error' });
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var disabled = isFetching || getPatientById.isLoading;
    return (<material_1.Dialog open={open} onClose={close} maxWidth="lg" fullWidth>
      <material_1.IconButton size="small" onClick={close} sx={{ position: 'absolute', right: 16, top: 16 }}>
        <Close_1.default fontSize="small"/>
      </material_1.IconButton>

      <material_1.Stack spacing={2} sx={{ p: 3 }}>
        <material_1.Stack spacing={1}>
          <material_1.Typography variant="h4" color="primary.dark">
            Merge Patients
          </material_1.Typography>
          <material_1.Typography>
            Select duplicated patients profiles. On the next step you will select which information should carry over to
            the remaining patient record after merge.
          </material_1.Typography>
        </material_1.Stack>

        <material_1.TextField value={value} onChange={function (e) { return setValue(e.target.value); }} onKeyDown={function (event) {
            if (event.key === 'Enter') {
                void addPatient(value);
            }
        }} disabled={disabled} size="small" label="PID" InputProps={{
            endAdornment: (<material_1.InputAdornment position="end">
                {getPatientById.isLoading ? <material_1.CircularProgress size={24} color="inherit"/> : <Search_1.default />}
              </material_1.InputAdornment>),
        }}/>

        <material_1.Table>
          <material_1.TableHead>
            <material_1.TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold', textAlign: 'left' } }}>
              <material_1.TableCell>PID</material_1.TableCell>
              <material_1.TableCell>Name</material_1.TableCell>
              <material_1.TableCell>DOB</material_1.TableCell>
              <material_1.TableCell>Phone</material_1.TableCell>
              <material_1.TableCell />
            </material_1.TableRow>
          </material_1.TableHead>
          {isFetching ? (<material_1.TableRow>
              <material_1.TableCell>
                <material_1.Skeleton />
              </material_1.TableCell>
              <material_1.TableCell>
                <material_1.Skeleton />
              </material_1.TableCell>
              <material_1.TableCell>
                <material_1.Skeleton />
              </material_1.TableCell>
              <material_1.TableCell>
                <material_1.Skeleton />
              </material_1.TableCell>
              <material_1.TableCell />
            </material_1.TableRow>) : (<material_1.TableBody>
              {patientRows.map(function (row) { return (<material_1.TableRow key={row.pid}>
                  <material_1.TableCell>{row.pid}</material_1.TableCell>
                  <material_1.TableCell>{row.name}</material_1.TableCell>
                  <material_1.TableCell>{row.dob}</material_1.TableCell>
                  <material_1.TableCell>
                    {row.primaryNumber && <b>{row.primaryNumber}</b>}
                    {row.primaryNumber && row.secondaryNumber && ', '}
                    {row.secondaryNumber}
                  </material_1.TableCell>
                  <material_1.TableCell align="right">
                    <telemed_1.DeleteIconButton onClick={function () { return removePatient(row.pid); }}/>
                  </material_1.TableCell>
                </material_1.TableRow>); })}
            </material_1.TableBody>)}
        </material_1.Table>

        <material_1.Stack direction="row" spacing={2} justifyContent="space-between">
          <RoundedButton_1.RoundedButton onClick={close}>Cancel</RoundedButton_1.RoundedButton>
          <material_1.Stack direction="row" spacing={2}>
            <telemed_1.ConfirmationDialog title="Not duplicates" description={<material_1.Stack spacing={2}>
                  <material_1.Typography>Confirm the patients as not duplicates and dismiss the alert.</material_1.Typography>
                  <material_1.Stack>
                    <material_1.Typography fontWeight={600}>PIDs:</material_1.Typography>
                    {patientRows.map(function (_a) {
                var pid = _a.pid;
                return (<material_1.Typography key={pid}>{pid}</material_1.Typography>);
            })}
                  </material_1.Stack>
                </material_1.Stack>} response={close} actionButtons={{
            proceed: {
                color: 'error',
                text: 'Dismiss Alert',
            },
            back: {
                text: 'Keep',
            },
            reverse: true,
        }}>
              {function (showDialog) { return (<RoundedButton_1.RoundedButton disabled={disabled} variant="contained" color="error" onClick={showDialog}>
                  Mark all as not duplicates
                </RoundedButton_1.RoundedButton>); }}
            </telemed_1.ConfirmationDialog>

            <RoundedButton_1.RoundedButton disabled={disabled} variant="contained" onClick={function () { return next(patientRows.map(function (_a) {
        var pid = _a.pid;
        return pid;
    })); }}>
              Continue
            </RoundedButton_1.RoundedButton>
          </material_1.Stack>
        </material_1.Stack>
      </material_1.Stack>
    </material_1.Dialog>);
};
exports.PatientsMergeSelect = PatientsMergeSelect;
//# sourceMappingURL=PatientsMergeSelect.js.map