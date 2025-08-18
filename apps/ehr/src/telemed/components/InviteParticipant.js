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
var react_hook_form_1 = require("react-hook-form");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api/api");
var useAppClients_1 = require("../../hooks/useAppClients");
var buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
    mb: 2,
    ml: 1,
};
var InviteParticipant = function (_a) {
    var modalOpen = _a.modalOpen, onClose = _a.onClose;
    var _b = (0, react_hook_form_1.useForm)({
        mode: 'onChange',
    }), register = _b.register, handleSubmit = _b.handleSubmit, formState = _b.formState;
    var _c = react_1.default.useState(false), isLoading = _c[0], setIsLoading = _c[1];
    var _d = react_1.default.useState(false), error = _d[0], setError = _d[1];
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var appointmentID = (0, react_router_dom_1.useParams)().id;
    var onSubmit = function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var response, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsLoading(true);
                    setError(false);
                    if (!oystehrZambda)
                        throw new Error('Zambda client not found');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, api_1.inviteParticipant)(oystehrZambda, {
                            appointmentId: appointmentID || '',
                            firstName: data.firstName,
                            lastName: data.lastName,
                            phoneNumber: data.phone,
                            emailAddress: data.email,
                        })];
                case 2:
                    response = _a.sent();
                    console.log('Participant invited successfully', response);
                    onClose();
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    setError(true);
                    console.error('Failed to invite participant', error_1);
                    return [3 /*break*/, 5];
                case 4:
                    setIsLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<material_1.Dialog open={modalOpen} onClose={onClose} fullWidth disableScrollLock sx={{ '.MuiPaper-root': { padding: 1, width: '444px', maxWidth: 'initial' } }}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Invite Participant
        </material_1.DialogTitle>
        <material_1.DialogContent>
          <material_1.FormControl fullWidth required sx={{ mt: 2 }}>
            <material_1.TextField {...register('firstName', { required: true })} id="first-name" label="First Name" variant="outlined" fullWidth error={!!formState.errors.firstName} required/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth required sx={{ mt: 2 }}>
            <material_1.TextField {...register('lastName', { required: true })} id="last-name" label="Last Name" variant="outlined" fullWidth error={!!formState.errors.lastName} required/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth required sx={{ mt: 2 }}>
            <material_1.TextField {...register('phone', { required: true })} id="phone" label="Phone" variant="outlined" fullWidth error={!!formState.errors.phone} required/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth required sx={{ mt: 2 }}>
            <material_1.TextField {...register('email', { required: true })} id="email" label="Email" variant="outlined" fullWidth error={!!formState.errors.email} required/>
          </material_1.FormControl>
        </material_1.DialogContent>
        <material_1.DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <lab_1.LoadingButton loading={isLoading} type="submit" variant="contained" color="primary" size="medium" sx={buttonSx} disabled={!formState.isValid}>
            Send Invite
          </lab_1.LoadingButton>
          <material_1.Button onClick={onClose} variant="text" color="primary" size="medium" sx={buttonSx}>
            Cancel
          </material_1.Button>
        </material_1.DialogActions>
        {error && (<material_1.Typography color="error" variant="body2" my={1} mx={2}>
            There was an error inviting this participant, please try again.
          </material_1.Typography>)}
      </form>
    </material_1.Dialog>);
};
exports.default = InviteParticipant;
//# sourceMappingURL=InviteParticipant.js.map