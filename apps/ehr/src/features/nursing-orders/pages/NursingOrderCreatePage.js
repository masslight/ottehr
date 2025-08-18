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
exports.NursingOrderCreatePage = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("src/api/api");
var RoundedButton_1 = require("src/features/css-module/components/RoundedButton");
var useAppClients_1 = require("src/hooks/useAppClients");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var appointment_store_1 = require("../../../telemed/state/appointment/appointment.store");
var BreadCrumbs_1 = require("../components/BreadCrumbs");
var NursingOrderCreatePage = function () {
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, react_1.useState)(false), loading = _a[0], setLoading = _a[1];
    var _b = (0, react_1.useState)(''), orderNote = _b[0], setOrderNote = _b[1];
    var _c = (0, getSelectors_1.getSelectors)(appointment_store_1.useAppointmentStore, ['patient', 'encounter']), patient = _c.patient, encounter = _c.encounter;
    var handleBack = function () {
        navigate(-1);
    };
    var handleSubmit = function (event) { return __awaiter(void 0, void 0, void 0, function () {
        var zambdaParams, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event.preventDefault();
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    if (!oystehrZambda)
                        throw new Error('Zambda client not found');
                    console.log('Order submitted:', {
                        notes: orderNote,
                        patientId: patient === null || patient === void 0 ? void 0 : patient.id,
                        encounterId: encounter === null || encounter === void 0 ? void 0 : encounter.id,
                    });
                    if (!(encounter === null || encounter === void 0 ? void 0 : encounter.id)) {
                        throw new Error('Missing encounter ID');
                    }
                    zambdaParams = {
                        encounterId: encounter === null || encounter === void 0 ? void 0 : encounter.id,
                        notes: orderNote,
                    };
                    return [4 /*yield*/, (0, api_1.createNursingOrder)(oystehrZambda, zambdaParams)];
                case 2:
                    _a.sent();
                    handleBack();
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    console.error('Error submitting order:', error_1);
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<material_1.Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, maxWidth: '680px' }}>
        <BreadCrumbs_1.BreadCrumbs />

        <material_1.Typography variant="h4" color="primary.dark">
          Nursing Order
        </material_1.Typography>

        <material_1.Paper>
          {loading ? (<material_1.Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <material_1.CircularProgress />
            </material_1.Box>) : (<form onSubmit={handleSubmit}>
              <material_1.Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <material_1.Box sx={{ p: 3 }}>
                  <material_1.TextField fullWidth id="notes" label="Order note" multiline rows={4} value={orderNote} onChange={function (e) { return setOrderNote(e.target.value); }} required inputProps={{ maxLength: 150 }}/>
                </material_1.Box>
                <material_1.Divider />
                <material_1.Box sx={{ px: 3, py: 2 }}>
                  <material_1.Stack direction="row" spacing={2} justifyContent="space-between">
                    <RoundedButton_1.ButtonRounded variant="outlined" onClick={handleBack} sx={{
                borderRadius: '50px',
                px: 4,
                py: 1,
            }}>
                      Cancel
                    </RoundedButton_1.ButtonRounded>
                    <material_1.Box>
                      <RoundedButton_1.ButtonRounded variant="contained" type="submit" disabled={orderNote.length === 0 || loading} sx={{
                borderRadius: '50px',
                px: 4,
                py: 1,
            }}>
                        Order
                      </RoundedButton_1.ButtonRounded>
                    </material_1.Box>
                  </material_1.Stack>
                </material_1.Box>
              </material_1.Box>
            </form>)}
        </material_1.Paper>
      </material_1.Box>
    </material_1.Box>);
};
exports.NursingOrderCreatePage = NursingOrderCreatePage;
//# sourceMappingURL=NursingOrderCreatePage.js.map