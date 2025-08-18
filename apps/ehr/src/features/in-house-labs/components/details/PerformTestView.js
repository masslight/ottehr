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
exports.PerformTestView = void 0;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("src/api/api");
var useAppClients_1 = require("src/hooks/useAppClients");
var utils_1 = require("utils");
var InHouseLabsDetailsCard_1 = require("./InHouseLabsDetailsCard");
var ResultEntryRadioButton_1 = require("./ResultEntryRadioButton");
var ResultsEntryTable_1 = require("./ResultsEntryTable");
var PerformTestView = function (_a) {
    var testDetails = _a.testDetails, setLoadingState = _a.setLoadingState, onBack = _a.onBack;
    var methods = (0, react_hook_form_1.useForm)({ mode: 'onChange' });
    var serviceRequestID = (0, react_router_dom_1.useParams)().serviceRequestID;
    var handleSubmit = methods.handleSubmit, isValid = methods.formState.isValid;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var _b = (0, react_1.useState)(false), showDetails = _b[0], setShowDetails = _b[1];
    // const [notes, setNotes] = useState(testDetails.notes || '');
    var _c = (0, react_1.useState)(false), submittingResults = _c[0], setSubmittingResults = _c[1];
    var _d = (0, react_1.useState)(undefined), error = _d[0], setError = _d[1];
    var handleResultEntrySubmit = function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var e_1, sdkError, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setSubmittingResults(true);
                    if (!oystehr) {
                        console.log('no oystehr client! :o'); // todo add error handling
                        return [2 /*return*/];
                    }
                    if (!serviceRequestID)
                        return [2 /*return*/]; // todo better error handling
                    console.log('data being submitted', data);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, api_1.handleInHouseLabResults)(oystehr, {
                            serviceRequestId: serviceRequestID,
                            data: data,
                        })];
                case 2:
                    _a.sent();
                    setLoadingState(utils_1.LoadingState.initial);
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    sdkError = e_1;
                    console.log('error entering results', sdkError.code, sdkError.message);
                    errorMessage = [sdkError.message];
                    setError(errorMessage);
                    return [3 /*break*/, 4];
                case 4:
                    setSubmittingResults(false);
                    return [2 /*return*/];
            }
        });
    }); };
    return (<material_1.Box>
      <material_1.Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
        {(0, utils_1.getFormattedDiagnoses)(testDetails.diagnosesDTO)}
      </material_1.Typography>

      <material_1.Typography variant="h4" color="primary.dark" sx={{ mb: 3, fontWeight: 'bold' }}>
        Perform Test & Enter Results
      </material_1.Typography>

      <react_hook_form_1.FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleResultEntrySubmit)}>
          <material_1.Paper sx={{ mb: 2 }}>
            <material_1.Box sx={{ p: 3 }}>
              <material_1.Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <material_1.Typography variant="h5" color="primary.dark" fontWeight="bold">
                  {testDetails.testItemName}
                </material_1.Typography>
                <material_1.Box sx={{
            bgcolor: '#E8DEFF',
            color: '#5E35B1',
            fontWeight: 'bold',
            px: 2,
            py: 0.5,
            borderRadius: '4px',
            fontSize: '0.75rem',
        }}>
                  {testDetails.status}
                </material_1.Box>
              </material_1.Box>

              {testDetails.labDetails.components.radioComponents.map(function (component, idx) {
            return (<ResultEntryRadioButton_1.ResultEntryRadioButton key={"radio-btn-".concat(idx, "-").concat(component.componentName)} testItemComponent={component}/>);
        })}

              {testDetails.labDetails.components.groupedComponents.length > 0 && (<ResultsEntryTable_1.ResultEntryTable testItemComponents={testDetails.labDetails.components.groupedComponents}/>)}
              <InHouseLabsDetailsCard_1.InHouseLabsDetailsCard testDetails={testDetails} page={utils_1.PageName.performEnterResults} showDetails={showDetails} setShowDetails={setShowDetails}/>
            </material_1.Box>
          </material_1.Paper>
          <material_1.Box display="flex" justifyContent="space-between">
            <material_1.Button variant="outlined" onClick={onBack} sx={{ borderRadius: '50px', px: 4 }}>
              Back
            </material_1.Button>

            <lab_1.LoadingButton variant="contained" color="primary" loading={submittingResults} disabled={!isValid} type="submit" sx={{ borderRadius: '50px', px: 4 }}>
              Submit
            </lab_1.LoadingButton>
          </material_1.Box>
          {error &&
            error.length > 0 &&
            error.map(function (msg, idx) { return (<material_1.Box sx={{ textAlign: 'right', paddingTop: 1 }} key={idx}>
                <material_1.Typography sx={{ color: 'error.dark' }}>
                  {typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}
                </material_1.Typography>
              </material_1.Box>); })}
        </form>
      </react_hook_form_1.FormProvider>
    </material_1.Box>);
};
exports.PerformTestView = PerformTestView;
//# sourceMappingURL=PerformTestView.js.map