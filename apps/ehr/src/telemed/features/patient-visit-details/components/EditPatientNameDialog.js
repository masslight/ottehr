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
exports.EditPatientNameDialog = void 0;
var CloseOutlined_1 = require("@mui/icons-material/CloseOutlined");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var hooks_1 = require("../../../hooks");
var state_1 = require("../../../state");
var EditPatientNameDialog = function (_a) {
    var modalOpen = _a.modalOpen, onClose = _a.onClose;
    var _b = (0, react_hook_form_1.useForm)(), register = _b.register, handleSubmit = _b.handleSubmit, formState = _b.formState, setValue = _b.setValue;
    var _c = (0, react_1.useState)(false), error = _c[0], setError = _c[1];
    var patient = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['patient']).patient;
    (0, react_1.useEffect)(function () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        setValue('firstName', (_c = (_b = (_a = patient === null || patient === void 0 ? void 0 : patient.name) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.given) === null || _c === void 0 ? void 0 : _c[0]);
        setValue('middleName', (_f = (_e = (_d = patient === null || patient === void 0 ? void 0 : patient.name) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.given) === null || _f === void 0 ? void 0 : _f[1]);
        setValue('lastName', (_h = (_g = patient === null || patient === void 0 ? void 0 : patient.name) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.family);
    }, [patient, setValue]);
    var editPatientName = (0, hooks_1.useEditPatientNameMutation)();
    var onSubmit = function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var patientData, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    if (!(patient === null || patient === void 0 ? void 0 : patient.id)) {
                        throw new Error('Patient reference not provided');
                    }
                    patientData = __assign(__assign({}, patient), { resourceType: 'Patient', id: patient.id, name: [
                            {
                                use: 'official',
                                family: data.lastName,
                                given: [data.firstName],
                            },
                        ] });
                    if (data.middleName) {
                        (_a = patientData.name[0].given) === null || _a === void 0 ? void 0 : _a.push(data.middleName);
                    }
                    return [4 /*yield*/, editPatientName.mutateAsync({ patientData: patientData }, {
                            onSuccess: function (updatedData) {
                                state_1.useAppointmentStore.setState({
                                    patient: __assign({}, updatedData),
                                });
                                onClose();
                            },
                        })];
                case 1:
                    _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _b.sent();
                    setError(true);
                    console.error('Error while updating patient name: ', error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    return (<material_1.Dialog open={modalOpen} onClose={onClose} fullWidth disableScrollLock sx={{ '.MuiPaper-root': { padding: 1, width: '444px', maxWidth: 'initial' } }}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%', py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          Please enter patient name
          <material_1.IconButton onClick={onClose} aria-label="close" sx={{ mr: -3, mt: -3 }}>
            <CloseOutlined_1.default />
          </material_1.IconButton>
        </material_1.DialogTitle>
        <material_1.DialogContent>
          <material_1.FormControl fullWidth required sx={{ mt: 1 }}>
            <material_1.TextField {...register('firstName', { required: true })} id="first-name" label="First Name" variant="outlined" fullWidth error={!!formState.errors.firstName} required/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth sx={{ mt: 2 }}>
            <material_1.TextField {...register('middleName')} id="middle-name" label="Middle Name" variant="outlined" fullWidth error={!!formState.errors.middleName}/>
          </material_1.FormControl>
          <material_1.FormControl fullWidth required sx={{ mt: 2 }}>
            <material_1.TextField {...register('lastName', { required: true })} id="last-name" label="Last Name" variant="outlined" fullWidth error={!!formState.errors.lastName} required/>
          </material_1.FormControl>
        </material_1.DialogContent>
        <material_1.DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <lab_1.LoadingButton loading={editPatientName.isLoading} type="submit" variant="contained" color="primary" size="medium" sx={{ fontWeight: 500, textTransform: 'none', borderRadius: 6, ml: 1, mb: 1, px: 4 }} disabled={!formState.isValid}>
            Update Patient Name
          </lab_1.LoadingButton>
        </material_1.DialogActions>
        {error && (<material_1.Typography color="error" variant="body2" my={1} mx={2}>
            Failed to update patient name, please try again.
          </material_1.Typography>)}
      </form>
    </material_1.Dialog>);
};
exports.EditPatientNameDialog = EditPatientNameDialog;
//# sourceMappingURL=EditPatientNameDialog.js.map