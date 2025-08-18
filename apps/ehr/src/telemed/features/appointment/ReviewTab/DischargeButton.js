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
exports.DischargeButton = void 0;
var Check_1 = require("@mui/icons-material/Check");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var useAppointment_1 = require("src/features/css-module/hooks/useAppointment");
var inPersonVisitStatusUtils_1 = require("src/helpers/inPersonVisitStatusUtils");
var useAppClients_1 = require("src/hooks/useAppClients");
var useEvolveUser_1 = require("src/hooks/useEvolveUser");
var utils_1 = require("utils");
var RoundedButton_1 = require("../../../../components/RoundedButton");
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var DischargeButton = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['appointment', 'encounter']), appointment = _a.appointment, encounter = _a.encounter;
    var refetch = (0, useAppointment_1.useAppointment)(appointment === null || appointment === void 0 ? void 0 : appointment.id).refetch;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var user = (0, useEvolveUser_1.default)();
    var _b = (0, react_1.useState)(false), statusLoading = _b[0], setStatusLoading = _b[1];
    var inPersonStatus = (0, react_1.useMemo)(function () { return appointment && (0, utils_1.getVisitStatus)(appointment, encounter); }, [appointment, encounter]);
    var isAlreadyDischarged = inPersonStatus === 'discharged' || inPersonStatus === 'completed';
    if (!user || !(encounter === null || encounter === void 0 ? void 0 : encounter.id)) {
        return (<material_1.Box sx={{ display: 'flex', justifyContent: 'end' }}>
        <material_1.Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: '20px' }}/>
      </material_1.Box>);
    }
    var encounterId = encounter.id;
    var handleDischarge = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setStatusLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, (0, inPersonVisitStatusUtils_1.handleChangeInPersonVisitStatus)({ encounterId: encounterId, user: user, updatedStatus: 'discharged' }, oystehrZambda)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, refetch()];
                case 3:
                    _a.sent();
                    (0, notistack_1.enqueueSnackbar)('Patient discharged successfully', { variant: 'success' });
                    return [3 /*break*/, 6];
                case 4:
                    error_1 = _a.sent();
                    console.error(error_1);
                    (0, notistack_1.enqueueSnackbar)('An error occurred. Please try again.', { variant: 'error' });
                    return [3 /*break*/, 6];
                case 5:
                    setStatusLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    return (<material_1.Box sx={{ display: 'flex', justifyContent: 'end' }}>
      <RoundedButton_1.RoundedButton disabled={statusLoading || isAlreadyDischarged} loading={statusLoading} variant="contained" onClick={handleDischarge} startIcon={isAlreadyDischarged ? <Check_1.default color="inherit"/> : undefined} data-testid={data_test_ids_1.dataTestIds.progressNotePage.dischargeButton}>
        {isAlreadyDischarged ? 'Discharged' : 'Discharge'}
      </RoundedButton_1.RoundedButton>
    </material_1.Box>);
};
exports.DischargeButton = DischargeButton;
//# sourceMappingURL=DischargeButton.js.map