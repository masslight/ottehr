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
exports.default = CancellationReasonDialog;
var LoadingButton_1 = require("@mui/lab/LoadingButton");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var utils_1 = require("utils");
var api_1 = require("../../api/api");
var data_test_ids_1 = require("../../constants/data-test-ids");
var useAppClients_1 = require("../../hooks/useAppClients");
function CancellationReasonDialog(_a) {
    var _this = this;
    var handleClose = _a.handleClose, getResourceBundle = _a.getResourceBundle, appointment = _a.appointment, encounter = _a.encounter, open = _a.open, getAndSetResources = _a.getAndSetResources;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var _b = (0, react_1.useState)(''), cancellationReason = _b[0], setCancellationReason = _b[1];
    var _c = (0, react_1.useState)(false), cancelLoading = _c[0], setCancelLoading = _c[1];
    var _d = (0, react_1.useState)(false), error = _d[0], setError = _d[1];
    var buttonSx = {
        fontWeight: 500,
        textTransform: 'none',
        borderRadius: 6,
    };
    var ITEM_HEIGHT = 34;
    var ITEM_PADDING_Y = 16;
    var MenuProps = {
        PaperProps: {
            style: {
                maxHeight: ITEM_HEIGHT * 8 + ITEM_PADDING_Y,
                width: 350,
            },
        },
    };
    var handleCancel = function (event) { return __awaiter(_this, void 0, void 0, function () {
        var zambdaParams, response, apiErr, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event.preventDefault();
                    setCancelLoading(true);
                    if (!(cancellationReason && encounter && encounter.id && encounter.statusHistory)) {
                        console.error('one of cancellationReason, encounter, encounter.id, or encounter.statusHistory is null or undefined');
                        return [2 /*return*/];
                    }
                    zambdaParams = {
                        appointmentID: appointment.id || '',
                        cancellationReason: cancellationReason,
                    };
                    apiErr = false;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 9]);
                    if (!oystehrZambda)
                        throw new Error('Zambda client not found');
                    return [4 /*yield*/, (0, api_1.cancelAppointment)(oystehrZambda, zambdaParams)];
                case 2:
                    response = _a.sent();
                    return [3 /*break*/, 9];
                case 3:
                    error_1 = _a.sent();
                    console.log("Failed to cancel appointment: ".concat(error_1));
                    apiErr = true;
                    return [3 /*break*/, 9];
                case 4:
                    if (!(response && !apiErr)) return [3 /*break*/, 7];
                    return [4 /*yield*/, getResourceBundle()];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, getAndSetResources({ logs: true }).catch(function (error) {
                            console.log('error getting activity logs after cancellation', error);
                        })];
                case 6:
                    _a.sent();
                    (0, notistack_1.enqueueSnackbar)('An error getting updated activity logs. Please try refreshing the page.', {
                        variant: 'error',
                    });
                    handleClose();
                    setError(false);
                    return [3 /*break*/, 8];
                case 7:
                    setError(true);
                    _a.label = 8;
                case 8:
                    setCancelLoading(false);
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    }); };
    var handleChange = function (event) {
        var value = event.target.value;
        if (value && setCancellationReason) {
            setCancellationReason(value);
        }
    };
    var handleDialogClose = function () {
        handleClose();
        setError(false);
    };
    return (<material_1.Dialog open={open} onClose={handleDialogClose} disableScrollLock sx={{
            '.MuiPaper-root': {
                padding: 1,
                width: '444px',
                maxWidth: 'initial',
            },
        }}>
      <form onSubmit={function (e) { return handleCancel(e); }}>
        <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Patient's cancelation reason
        </material_1.DialogTitle>
        <material_1.DialogContent>
          <div>
            <material_1.FormControl required sx={{ mt: 2, width: '100%' }}>
              <material_1.InputLabel id="select-label">Cancelation reason</material_1.InputLabel>
              <material_1.Select data-testid={data_test_ids_1.dataTestIds.visitDetailsPage.cancelationReasonDropdown} labelId="select-label" id="select" label="Cancelation reason" value={cancellationReason} onChange={handleChange} renderValue={function (selected) { return selected; }} MenuProps={MenuProps}>
                {Object.keys(utils_1.CancellationReasonOptionsInPerson).map(function (reason) { return (<material_1.MenuItem key={reason} value={reason}>
                    <material_1.ListItemText primary={reason}/>
                  </material_1.MenuItem>); })}
              </material_1.Select>
            </material_1.FormControl>
          </div>
        </material_1.DialogContent>
        <material_1.DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <LoadingButton_1.default data-testid={data_test_ids_1.dataTestIds.visitDetailsPage.cancelVisitDialogue} loading={cancelLoading} type="submit" variant="contained" color="primary" size="medium" sx={buttonSx}>
            Cancel visit
          </LoadingButton_1.default>
          <material_1.Button variant="text" onClick={handleDialogClose} size="medium" sx={buttonSx}>
            Keep
          </material_1.Button>
        </material_1.DialogActions>
        {error && (<material_1.Typography color="error" variant="body2" my={1} mx={2}>
            There was an error cancelling this appointment, please try again.
          </material_1.Typography>)}
      </form>
    </material_1.Dialog>);
}
//# sourceMappingURL=CancellationReasonDialog.js.map