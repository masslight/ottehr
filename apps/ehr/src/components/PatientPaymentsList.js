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
exports.default = PatientPaymentList;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_query_1 = require("react-query");
var useAppClients_1 = require("src/hooks/useAppClients");
var useGetPatientPaymentsList_1 = require("src/hooks/useGetPatientPaymentsList");
var utils_1 = require("utils");
var PaymentDialog_1 = require("./dialogs/PaymentDialog");
var RefreshableStatusWidget_1 = require("./RefreshableStatusWidget");
var idForPaymentDTO = function (payment) {
    var _a;
    if (payment.paymentMethod === 'card') {
        return payment.fhirPaymentNotificationId;
    }
    else {
        return (_a = payment.fhirPaymentNotificationId) !== null && _a !== void 0 ? _a : 'unknown-payment-id'; //todo: should get something from candid
    }
};
function PatientPaymentList(_a) {
    var _this = this;
    var _b, _c;
    var loading = _a.loading, patient = _a.patient, encounterId = _a.encounterId;
    var theme = (0, material_1.useTheme)();
    var _d = (0, react_1.useState)(false), paymentDialogOpen = _d[0], setPaymentDialogOpen = _d[1];
    var _e = (0, useGetPatientPaymentsList_1.useGetPatientPaymentsList)({
        patientId: (_b = patient.id) !== null && _b !== void 0 ? _b : '',
        encounterId: encounterId,
        disabled: !encounterId || !patient.id,
    }), paymentData = _e.data, refetchPaymentList = _e.refetch, isRefetching = _e.isRefetching;
    var payments = (_c = paymentData === null || paymentData === void 0 ? void 0 : paymentData.payments) !== null && _c !== void 0 ? _c : []; // Replace with actual payments when available
    var oystehr = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var getLabelForPayment = function (payment) {
        var _a;
        if (payment.paymentMethod === 'card') {
            if (payment.cardLast4) {
                return "XXXX - XXXX - XXXX - ".concat(payment.cardLast4);
            }
            else {
                return (<RefreshableStatusWidget_1.RefreshableStatusChip status={'processing...'} styleMap={_a = {},
                        _a['processing...'] = {
                            textSX: {
                                fontSize: '16px',
                                fontWeight: 'normal',
                                color: theme.palette.primary.dark,
                            },
                            bgColor: 'transparent',
                            textColor: theme.palette.primary.dark,
                        },
                        _a} lastRefreshISO={''} handleRefresh={refetchPaymentList} isRefreshing={isRefetching} flexDirection="row"/>);
            }
        }
        else {
            return (0, material_1.capitalize)(payment.paymentMethod);
        }
    };
    var createNewPayment = (0, react_query_1.useMutation)({
        mutationFn: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (oystehr && input) {
                    return [2 /*return*/, oystehr.zambda
                            .execute(__assign({ id: 'patient-payments-post' }, input))
                            .then(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, refetchPaymentList()];
                                    case 1:
                                        _a.sent();
                                        setPaymentDialogOpen(false);
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                }
                return [2 /*return*/];
            });
        }); },
        retry: 0,
    });
    var errorMessage = (function () {
        var networkError = createNewPayment.error;
        if (networkError) {
            if ((0, utils_1.isApiError)(networkError)) {
                return networkError.message;
            }
            return 'Something went wrong. Payment was not completed.';
        }
        return null;
    })();
    return (<material_1.Paper sx={{
            marginTop: 2,
            padding: 3,
        }}>
      <material_1.Typography variant="h4" color="primary.dark">
        Patient Payments
      </material_1.Typography>
      <material_1.Table size="small" style={{ tableLayout: 'fixed' }}>
        <material_1.TableBody>
          {payments.map(function (payment) {
            var paymentDateString = luxon_1.DateTime.fromISO(payment.dateISO).toLocaleString(luxon_1.DateTime.DATE_SHORT);
            return (<react_1.Fragment key={idForPaymentDTO(payment)}>
                <material_1.TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <>
                    <material_1.TableCell sx={{
                    width: '50%',
                    color: theme.palette.primary.dark,
                    paddingLeft: 0,
                }}>
                      <material_1.Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                        {getLabelForPayment(payment)}
                      </material_1.Box>
                    </material_1.TableCell>

                    <material_1.TableCell colSpan={2} sx={{
                    textAlign: 'center',
                    wordWrap: 'break-word',
                    paddingRight: 0,
                    paddingTop: 0,
                    fontSize: '12px',
                }}>
                      {paymentDateString}
                    </material_1.TableCell>

                    <material_1.TableCell sx={{
                    textAlign: 'right',
                    wordWrap: 'break-word',
                    paddingRight: 0,
                }}>
                      <material_1.Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {loading ? (<material_1.Skeleton aria-busy="true" width={200}/>) : (<material_1.Typography variant="body1">{"$".concat(payment.amountInCents / 100)}</material_1.Typography>)}
                      </material_1.Box>
                    </material_1.TableCell>
                  </>
                </material_1.TableRow>
              </react_1.Fragment>);
        })}
        </material_1.TableBody>
      </material_1.Table>
      <material_1.Button sx={{ marginTop: 2 }} onClick={function () { return setPaymentDialogOpen(true); }} variant="contained" color="primary">
        $ Add Payment
      </material_1.Button>
      <PaymentDialog_1.default open={paymentDialogOpen} patient={patient} handleClose={function () { return setPaymentDialogOpen(false); }} isSubmitting={createNewPayment.isLoading} submitPayment={function (data) { return __awaiter(_this, void 0, void 0, function () {
            var postInput;
            var _a;
            return __generator(this, function (_b) {
                postInput = {
                    patientId: (_a = patient.id) !== null && _a !== void 0 ? _a : '',
                    encounterId: encounterId,
                    paymentDetails: data,
                };
                createNewPayment.mutate(postInput);
                return [2 /*return*/];
            });
        }); }}/>
      <material_1.Snackbar 
    // anchorOrigin={{ vertical: snackbarOpen.vertical, horizontal: snackbarOpen.horizontal }}
    open={errorMessage !== null} autoHideDuration={6000} onClose={function () { return createNewPayment.reset(); }}>
        <material_1.Alert severity="error" onClose={function () { return createNewPayment.reset(); }} sx={{ width: '100%' }}>
          {errorMessage}
        </material_1.Alert>
      </material_1.Snackbar>
    </material_1.Paper>);
}
//# sourceMappingURL=PatientPaymentsList.js.map