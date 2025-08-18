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
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var api_1 = require("../../api/api");
var useAppClients_1 = require("../../hooks/useAppClients");
var CancelVisitDialog = function (_a) {
    var onClose = _a.onClose;
    var _b = (0, react_1.useState)(''), reason = _b[0], setReason = _b[1];
    var _c = (0, react_1.useState)(false), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(''), otherReason = _d[0], setOtherReason = _d[1];
    var _e = (0, react_1.useState)(false), isCancelling = _e[0], setIsCancelling = _e[1];
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var appointmentID = (0, react_router_dom_1.useParams)().id;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var cancellationReasons = Object.values(utils_1.CancellationReasonOptionsProviderSideTelemed);
    var handleReasonChange = function (event) {
        setReason(event.target.value);
        if (event.target.value !== 'Other') {
            setOtherReason('');
        }
    };
    var handleOtherReasonChange = function (event) {
        setOtherReason(event.target.value);
    };
    var handleCancelAppointment = function (event) { return __awaiter(void 0, void 0, void 0, function () {
        var typedReason, errorReceived, response, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event.preventDefault();
                    setError(false);
                    if (!reason || (reason === 'Other' && !otherReason)) {
                        return [2 /*return*/];
                    }
                    setIsCancelling(true);
                    if (!oystehrZambda)
                        throw new Error('Zambda client not found');
                    if (cancellationReasons.find(function (r) { return r === reason; }) === undefined) {
                        throw new Error("Invalid cancellation reason: ".concat(reason));
                    }
                    typedReason = reason;
                    errorReceived = false;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, api_1.cancelTelemedAppointment)(oystehrZambda, {
                            appointmentID: appointmentID || '',
                            cancellationReason: typedReason,
                            cancellationReasonAdditional: otherReason,
                        })];
                case 2:
                    response = _a.sent();
                    console.log('Appointment cancelled successfully', response);
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    setError(true);
                    errorReceived = true;
                    console.error('Failed to cancel appointment', error_1);
                    return [3 /*break*/, 5];
                case 4:
                    setIsCancelling(false);
                    if (!errorReceived) {
                        onClose();
                        navigate('/telemed/appointments');
                    }
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var buttonSx = {
        fontWeight: 500,
        textTransform: 'none',
        borderRadius: 6,
        mb: 2,
        ml: 1,
    };
    return (<material_1.Dialog open={true} onClose={onClose} fullWidth disableScrollLock sx={{
            '.MuiPaper-root': {
                padding: 1,
                width: '444px',
                maxWidth: 'initial',
            },
        }}>
      <form onSubmit={function (e) { return handleCancelAppointment(e); }}>
        <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Cancellation reason
        </material_1.DialogTitle>
        <material_1.DialogContent>
          <material_1.FormControl fullWidth required sx={{ mt: 2 }}>
            <material_1.InputLabel id="cancellation-reason-label">Cancellation Reason</material_1.InputLabel>
            <material_1.Select labelId="cancellation-reason-label" id="cancellation-reason" value={reason} label="Cancellation Reason" onChange={handleReasonChange}>
              {cancellationReasons.map(function (reason) { return (<material_1.MenuItem key={reason} value={reason}>
                  {reason}
                </material_1.MenuItem>); })}
            </material_1.Select>
          </material_1.FormControl>
          {reason === 'Other' && (<material_1.FormControl fullWidth required>
              <material_1.TextField id="other-reason" label="Reason" variant="outlined" fullWidth required={true} margin="normal" value={otherReason} onChange={handleOtherReasonChange}/>
            </material_1.FormControl>)}
        </material_1.DialogContent>
        <material_1.DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <lab_1.LoadingButton loading={isCancelling} type="submit" variant="contained" color="primary" size="medium" sx={buttonSx}>
            Cancel visit
          </lab_1.LoadingButton>
          <material_1.Button onClick={onClose} variant="text" color="primary" size="medium" sx={buttonSx}>
            Keep
          </material_1.Button>
        </material_1.DialogActions>
        {error && (<material_1.Typography color="error" variant="body2" my={1} mx={2}>
            There was an error cancelling this appointment, please try again.
          </material_1.Typography>)}
      </form>
    </material_1.Dialog>);
};
exports.default = CancelVisitDialog;
//# sourceMappingURL=CancelVisitDialog.js.map