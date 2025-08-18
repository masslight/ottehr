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
exports.SendFaxButton = void 0;
var FaxOutlined_1 = require("@mui/icons-material/FaxOutlined");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var phone_1 = require("phone");
var react_1 = require("react");
var InputMask_1 = require("src/components/InputMask");
var utils_1 = require("utils");
var RoundedButton_1 = require("../../../../components/RoundedButton");
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var components_1 = require("../../../components");
var hooks_1 = require("../../../hooks");
var useOystehrAPIClient_1 = require("../../../hooks/useOystehrAPIClient");
var SendFaxButton = function (_a) {
    var appointment = _a.appointment, encounter = _a.encounter, css = _a.css;
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var _b = (0, react_1.useState)(false), openTooltip = _b[0], setOpenTooltip = _b[1];
    var inPersonStatus = (0, react_1.useMemo)(function () { return appointment && encounter && (0, utils_1.getVisitStatus)(appointment, encounter); }, [appointment, encounter]);
    var appointmentAccessibility = (0, hooks_1.useGetAppointmentAccessibility)();
    var _c = (0, react_1.useState)(''), faxNumber = _c[0], setFaxNumber = _c[1];
    var _d = (0, react_1.useState)(false), faxError = _d[0], setFaxError = _d[1];
    var errorMessage = (0, react_1.useMemo)(function () {
        if ((css && inPersonStatus && !['intake', 'completed'].includes(inPersonStatus)) ||
            appointmentAccessibility.status !== utils_1.TelemedAppointmentStatusEnum.complete) {
            return "Once the visit note has been signed, you will have the option to fax a copy to the patient's Primary Care Physician.";
        }
        return null;
    }, [css, inPersonStatus, appointmentAccessibility.status]);
    var handleSendFax = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (faxError) {
                        (0, notistack_1.enqueueSnackbar)('Please enter a valid fax number.', { variant: 'error' });
                        return [2 /*return*/];
                    }
                    if (!apiClient || !(appointment === null || appointment === void 0 ? void 0 : appointment.id)) {
                        throw new Error('api client not defined or appointment ID is missing');
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, apiClient.sendFax({
                            appointmentId: appointment.id,
                            faxNumber: faxNumber,
                        })];
                case 2:
                    _a.sent();
                    (0, notistack_1.enqueueSnackbar)('Fax sent.', { variant: 'success' });
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error('Error sending fax:', error_1);
                    (0, notistack_1.enqueueSnackbar)('Error sending fax.', { variant: 'error' });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return (<material_1.Box sx={{ display: 'flex', justifyContent: 'end' }}>
      <material_1.Tooltip placement="top" open={openTooltip && errorMessage !== null} onClose={function () { return setOpenTooltip(false); }} onOpen={function () { return setOpenTooltip(true); }} title={<material_1.Typography>{errorMessage !== null && errorMessage}</material_1.Typography>}>
        <material_1.Box>
          <components_1.ConfirmationDialog title="Send Fax" description={<material_1.FormControl variant="outlined" fullWidth error={faxError} sx={{ mt: 2, mb: -2 }}>
                <material_1.InputLabel shrink required htmlFor="fax-number">
                  Fax number
                </material_1.InputLabel>
                <material_1.OutlinedInput id="fax-number" label="Fax number" notched required type="tel" placeholder="(XXX) XXX-XXXX" value={faxNumber} inputMode="numeric" inputComponent={InputMask_1.default} inputProps={{
                mask: '(000) 000-0000',
            }} onChange={function (e) {
                var number = e.target.value.replace(/\D/g, '');
                setFaxNumber(number);
                if ((0, utils_1.isPhoneNumberValid)(number) && (0, phone_1.phone)(number).isValid) {
                    setFaxError(false);
                }
                else {
                    setFaxError(true);
                }
            }}/>
                <material_1.FormHelperText error sx={{ visibility: faxError ? 'visible' : 'hidden' }}>
                  Fax number must be 10 digits in the format (xxx) xxx-xxxx and a valid number
                </material_1.FormHelperText>
              </material_1.FormControl>} response={handleSendFax} actionButtons={{
            proceed: {
                text: 'Send',
                disabled: faxNumber === '' || faxError,
            },
            back: { text: 'Cancel' },
            reverse: true,
        }}>
            {function (showDialog) { return (<RoundedButton_1.RoundedButton disabled={errorMessage !== null} variant="outlined" onClick={showDialog} startIcon={<FaxOutlined_1.default color="inherit"/>} data-testid={data_test_ids_1.dataTestIds.progressNotePage.sendFaxButton}>
                Send Fax
              </RoundedButton_1.RoundedButton>); }}
          </components_1.ConfirmationDialog>
        </material_1.Box>
      </material_1.Tooltip>
    </material_1.Box>);
};
exports.SendFaxButton = SendFaxButton;
//# sourceMappingURL=SendFaxButton.js.map