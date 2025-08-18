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
exports.default = default_1;
var yup_1 = require("@hookform/resolvers/yup");
var LoadingButton_1 = require("@mui/lab/LoadingButton");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var yup = require("yup");
var data_test_ids_1 = require("../../constants/data-test-ids");
var SelectCreditCard_1 = require("../SelectCreditCard");
var PatientHeader = function (props) {
    var _a, _b;
    var patient = props.patient;
    var patientFirstName = (0, utils_1.getFirstName)(patient);
    var patientLastName = (0, utils_1.getLastName)(patient);
    var middleName = (0, utils_1.getMiddleName)(patient);
    var nameElements = [patientLastName, patientFirstName, middleName].filter(Boolean);
    var patientDOB = patient.birthDate ? luxon_1.DateTime.fromISO(patient.birthDate).toFormat(utils_1.DOB_DATE_FORMAT) : 'Unknown';
    var dobString = "DOB: ".concat(patientDOB);
    var genderString = (0, material_1.capitalize)((_a = patient.gender) !== null && _a !== void 0 ? _a : '');
    var phoneNumber = (0, utils_1.formatPhoneNumberDisplay)((_b = (0, utils_1.getPhoneNumberForIndividual)(patient)) !== null && _b !== void 0 ? _b : '');
    return (<material_1.Grid container direction="column" sx={{ marginBottom: 2 }} spacing={0.5}>
      <material_1.Grid item xs={12}>
        <material_1.Typography variant="body1" color="rgba(0, 0, 0, 0.87)" fontWeight={500}>
          {"".concat(nameElements.join(', '))}
        </material_1.Typography>
      </material_1.Grid>
      <material_1.Grid container item direction="row" spacing={2}>
        <material_1.Grid item>
          <material_1.Typography variant="body2" color="rgba(0, 0, 0, 0.87)">
            {dobString}
          </material_1.Typography>
        </material_1.Grid>
        <material_1.Grid item>
          <material_1.Typography variant="body2" color="rgba(0, 0, 0, 0.87)">
            {genderString}
          </material_1.Typography>
        </material_1.Grid>
        <material_1.Grid item>
          <material_1.Typography variant="body2" color="rgba(0, 0, 0, 0.87)">
            {phoneNumber}
          </material_1.Typography>
        </material_1.Grid>
      </material_1.Grid>
    </material_1.Grid>);
};
var paymentSchema = yup.object().shape({
    amount: yup
        .number()
        .typeError('Amount must be a number')
        .required('Amount is required')
        .positive('Amount must be greater than 0'),
    paymentMethod: yup
        .string()
        .oneOf(['card', 'cash', 'check'], 'Invalid payment method')
        .required('Payment method is required'),
    creditCard: yup.string().when('paymentMethod', {
        is: function (val) { return val === 'card'; },
        then: function (schema) {
            return schema
                .required('Credit card selection required')
                .matches(RegExp('pm_[a-zA-Z0-9]{24,24}'), 'Credit card selection required')
                .required();
        },
        otherwise: function (schema) { return schema.notRequired().nullable(); },
    }),
});
function default_1(_a) {
    var _this = this;
    var _b, _c;
    var submitPayment = _a.submitPayment, handleClose = _a.handleClose, open = _a.open, patient = _a.patient, isSubmitting = _a.isSubmitting;
    var buttonSx = {
        fontWeight: 500,
        textTransform: 'none',
        borderRadius: 6,
    };
    var _d = (0, react_hook_form_1.useForm)({
        defaultValues: {
            amount: 0,
            paymentMethod: 'card',
            creditCard: '',
        },
        resolver: (0, yup_1.yupResolver)(paymentSchema),
        mode: 'onBlur',
    }), handleSubmit = _d.handleSubmit, register = _d.register, watch = _d.watch, formState = _d.formState, control = _d.control, setValue = _d.setValue, reset = _d.reset;
    (0, react_1.useEffect)(function () {
        var resetFormAfterDelay = function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, utils_1.sleep)(250)];
                    case 1:
                        _a.sent();
                        reset();
                        return [2 /*return*/];
                }
            });
        }); };
        if (!open) {
            void resetFormAfterDelay();
        }
    }, [open, reset]);
    var paymentMethod = watch('paymentMethod'); // Default to 'card'
    var creditCard = watch('creditCard');
    var structureDataAndSubmit = function (data) { return __awaiter(_this, void 0, void 0, function () {
        var amount, paymentMethod, creditCard, paymentData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    amount = parseFloat(data.amount);
                    paymentMethod = data.paymentMethod;
                    creditCard = data.creditCard;
                    paymentData = {
                        amountInCents: Math.round(amount * 100),
                        paymentMethod: paymentMethod,
                        paymentMethodId: creditCard || undefined,
                    };
                    return [4 /*yield*/, submitPayment(paymentData)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var handleDialogClose = function () {
        handleClose();
    };
    return (<material_1.Dialog open={open} onClose={handleDialogClose} disableScrollLock sx={{
            '.MuiPaper-root': {
                padding: 1,
                width: '700px',
                maxWidth: 'initial',
            },
        }}>
      <form onSubmit={handleSubmit(structureDataAndSubmit)} noValidate>
        <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Payment
        </material_1.DialogTitle>
        <material_1.DialogContent>
          <material_1.Grid container direction="column" spacing={2} sx={{ marginBottom: 2 }}>
            <material_1.Grid item>
              <PatientHeader patient={patient}/>
            </material_1.Grid>
            <material_1.Grid item sx={{ marginBottom: 1 }}>
              <material_1.FormControl variant="outlined" fullWidth required>
                <material_1.InputLabel shrink required error={Boolean(formState.errors.amount)}>
                  Amount
                </material_1.InputLabel>
                <material_1.OutlinedInput id="amount" label="Amount, $" placeholder="Enter amount in dollars" size="small" notched error={Boolean(formState.errors.amount)} {...register('amount', { required: true })}/>
                {formState.errors.amount && (<material_1.FormHelperText error={true}>{(_b = formState.errors.amount) === null || _b === void 0 ? void 0 : _b.message}</material_1.FormHelperText>)}
              </material_1.FormControl>
            </material_1.Grid>
            <material_1.Grid item>
              <material_1.FormControl variant="outlined" fullWidth required>
                <material_1.InputLabel shrink id="payment-method-radio-group">
                  Payment method
                </material_1.InputLabel>
                <react_hook_form_1.Controller name="paymentMethod" control={control} aria-labelledby="payment-method-radio-group" render={function (_a) {
            var field = _a.field;
            return (<material_1.RadioGroup row {...field}>
                      <material_1.FormControlLabel value="card" control={<material_1.Radio />} label="Card"/>
                      <material_1.FormControlLabel value="cash" control={<material_1.Radio />} label="Cash"/>
                      <material_1.FormControlLabel value="check" control={<material_1.Radio />} label="Check"/>
                    </material_1.RadioGroup>);
        }}/>
              </material_1.FormControl>
            </material_1.Grid>
          </material_1.Grid>
          <material_1.Grid item sx={{
            minHeight: '150px',
        }}>
            <material_1.Box sx={{
            display: paymentMethod === 'card' ? 'initial' : 'none',
        }}>
              <SelectCreditCard_1.default patient={patient} selectedCardId={creditCard !== null && creditCard !== void 0 ? creditCard : ''} handleCardSelected={function (newVal) {
            setValue('creditCard', newVal !== null && newVal !== void 0 ? newVal : '');
        }} error={(_c = formState.errors.creditCard) === null || _c === void 0 ? void 0 : _c.message}/>
            </material_1.Box>
          </material_1.Grid>
        </material_1.DialogContent>
        <material_1.DialogActions sx={{ justifyContent: 'space-between', marginLeft: 1 }}>
          <material_1.Button variant="text" onClick={handleDialogClose} size="medium" sx={buttonSx}>
            Cancel
          </material_1.Button>
          <LoadingButton_1.default data-testid={data_test_ids_1.dataTestIds.visitDetailsPage.cancelVisitDialogue} loading={isSubmitting} type="submit" variant="contained" color="primary" size="medium" sx={buttonSx}>
            Process Payment
          </LoadingButton_1.default>
        </material_1.DialogActions>
      </form>
    </material_1.Dialog>);
}
//# sourceMappingURL=PaymentDialog.js.map