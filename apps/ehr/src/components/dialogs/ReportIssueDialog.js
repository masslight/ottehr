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
exports.default = ReportIssueDialog;
var LoadingButton_1 = require("@mui/lab/LoadingButton");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var utils_1 = require("utils");
var useEvolveUser_1 = require("../../hooks/useEvolveUser");
function ReportIssueDialog(_a) {
    var _this = this;
    var open = _a.open, handleClose = _a.handleClose, oystehr = _a.oystehr, patient = _a.patient, appointment = _a.appointment, encounter = _a.encounter, location = _a.location, setToastMessage = _a.setToastMessage, setToastType = _a.setToastType, setSnackbarOpen = _a.setSnackbarOpen;
    var _b = (0, react_1.useState)(false), reportIssueLoading = _b[0], setReportIssueLoading = _b[1];
    var _c = (0, react_1.useState)(''), issueDetails = _c[0], setIssueDetails = _c[1];
    var _d = (0, react_1.useState)(false), error = _d[0], setError = _d[1];
    var buttonSx = {
        fontWeight: 500,
        textTransform: 'none',
        borderRadius: 6,
    };
    var user = (0, useEvolveUser_1.default)();
    var handleReportIssue = function (event) { return __awaiter(_this, void 0, void 0, function () {
        var issueCommunication, about, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event.preventDefault();
                    setError(false);
                    setReportIssueLoading(true);
                    issueCommunication = {
                        resourceType: 'Communication',
                        status: 'in-progress',
                        category: [
                            {
                                coding: [utils_1.COMMUNICATION_ISSUE_REPORT_CODE],
                            },
                        ],
                        encounter: {
                            type: 'Encounter',
                            reference: "Encounter/".concat(encounter.id),
                        },
                        sent: luxon_1.DateTime.now().toISO() || '',
                        payload: [
                            {
                                contentString: issueDetails,
                            },
                        ],
                    };
                    if (user === null || user === void 0 ? void 0 : user.profile) {
                        issueCommunication.sender = {
                            type: 'Practitioner',
                            reference: user.profile,
                        };
                    }
                    if (patient === null || patient === void 0 ? void 0 : patient.id) {
                        issueCommunication.subject = {
                            type: 'Patient',
                            reference: "Patient/".concat(patient.id),
                        };
                    }
                    about = [];
                    if (appointment === null || appointment === void 0 ? void 0 : appointment.id) {
                        about.push({
                            type: 'Appointment',
                            reference: "Appointment/".concat(appointment.id),
                        });
                    }
                    if (location === null || location === void 0 ? void 0 : location.id) {
                        about.push({
                            type: 'Location',
                            reference: "Location/".concat(location.id),
                        });
                    }
                    if (about.length > 0) {
                        issueCommunication.about = about;
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.create(issueCommunication))];
                case 2:
                    _a.sent();
                    setToastMessage('Issue submitted successfully!');
                    setToastType('success');
                    setSnackbarOpen(true);
                    handleClose();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    console.log('error', e_1);
                    setError(true);
                    return [3 /*break*/, 4];
                case 4:
                    setReportIssueLoading(false);
                    setIssueDetails('');
                    return [2 /*return*/];
            }
        });
    }); };
    var handleDialogClose = function () {
        handleClose();
        setIssueDetails('');
        setError(false);
    };
    return (<material_1.Dialog open={open} onClose={handleClose} disableScrollLock sx={{
            '.MuiPaper-root': {
                padding: 1,
                width: '444px',
                maxWidth: 'initial',
            },
        }}>
      <form onSubmit={function (e) { return handleReportIssue(e); }}>
        <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Report Issue
        </material_1.DialogTitle>
        <material_1.DialogContent>
          <div>
            <material_1.Typography>
              Did you or the patient have an issue interacting with the software? Please let us know what you
              experienced. This feedback will be submitted directly to the development team.
            </material_1.Typography>
            <material_1.TextField required multiline minRows={3} placeholder={'Enter issue details here...'} value={issueDetails} onChange={function (e) { return setIssueDetails(e.target.value); }} sx={{ marginTop: 1, width: '100%' }}/>
          </div>
        </material_1.DialogContent>
        <material_1.DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <LoadingButton_1.default loading={reportIssueLoading} disabled={issueDetails.trim() === ''} type="submit" variant="contained" color="primary" size="medium" sx={buttonSx}>
            Submit Issue
          </LoadingButton_1.default>
          <material_1.Button variant="text" onClick={handleDialogClose} size="medium" sx={buttonSx}>
            Cancel
          </material_1.Button>
        </material_1.DialogActions>
        {error && (<material_1.Typography color="error" variant="body2" my={1} mx={2}>
            There was an error sending this issue report, please try again.
          </material_1.Typography>)}
      </form>
    </material_1.Dialog>);
}
//# sourceMappingURL=ReportIssueDialog.js.map