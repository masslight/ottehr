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
exports.PatientVisitDetails = void 0;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var LoadingScreen_1 = require("../../components/LoadingScreen");
var useAppClients_1 = require("../../hooks/useAppClients");
var PageContainer_1 = require("../../layout/PageContainer");
var components_1 = require("../features/patient-visit-details/components");
var hooks_1 = require("../hooks");
var state_1 = require("../state");
var PatientVisitDetails = function () {
    var location = (0, react_router_dom_1.useLocation)();
    var queryParams = new URLSearchParams(location.search);
    var appointmentId = queryParams.get('appointment') || undefined;
    (0, hooks_1.useResetAppointmentStore)();
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var isFetching = (0, state_1.useGetAppointment)({
        appointmentId: appointmentId,
    }, function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, patient, location, locationVirtual, questionnaireResponse, _i, _a, item, insuranceId, insuranceOrg, error_1;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    appointment = data === null || data === void 0 ? void 0 : data.find(function (resource) { return resource.resourceType === 'Appointment'; });
                    patient = data === null || data === void 0 ? void 0 : data.find(function (resource) { return resource.resourceType === 'Patient'; });
                    location = (data === null || data === void 0 ? void 0 : data.filter(function (resource) { return resource.resourceType === 'Location'; })).find(function (location) { return !(0, utils_1.isLocationVirtual)(location); });
                    locationVirtual = (data === null || data === void 0 ? void 0 : data.filter(function (resource) { return resource.resourceType === 'Location'; })).find(function (location) { return (0, utils_1.isLocationVirtual)(location); });
                    questionnaireResponse = data === null || data === void 0 ? void 0 : data.find(function (resource) { return resource.resourceType === 'QuestionnaireResponse'; });
                    if (!(questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.item)) return [3 /*break*/, 7];
                    _i = 0, _a = questionnaireResponse.item;
                    _f.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 7];
                    item = _a[_i];
                    if (!((item.linkId === 'insurance-carrier' || item.linkId === 'insurance-carrier-2') &&
                        ((_c = (_b = item.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString))) return [3 /*break*/, 6];
                    insuranceId = (_e = (_d = item === null || item === void 0 ? void 0 : item.answer) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.valueString;
                    _f.label = 2;
                case 2:
                    _f.trys.push([2, 5, , 6]);
                    if (!oystehr) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, utils_1.getInsuranceOrgById)(insuranceId, oystehr)];
                case 3:
                    insuranceOrg = _f.sent();
                    item.answer[0].valueString = insuranceOrg.name || '-';
                    _f.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_1 = _f.sent();
                    console.error("Error fetching Organization with id ".concat(insuranceId, ":"), error_1);
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7:
                    state_1.useAppointmentStore.setState({
                        appointment: appointment,
                        patient: patient,
                        location: location,
                        locationVirtual: locationVirtual,
                        questionnaireResponse: questionnaireResponse,
                    });
                    return [2 /*return*/];
            }
        });
    }); }).isFetching;
    return (<PageContainer_1.default tabTitle={'Patient Visit Details'}>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {isFetching ? (<LoadingScreen_1.LoadingScreen />) : (<material_1.Box sx={{ maxWidth: '1200px' }}>
            <components_1.BreadCrumbs />
            <components_1.TitleRow />
            <components_1.InsuranceCardAndPhotoContainer />
            <material_1.Grid container direction="row">
              <material_1.Grid item xs={6} paddingRight={2}>
                <components_1.AboutPatientContainer />
                <components_1.ContactContainer />
                <components_1.PatientDetailsContainer />
              </material_1.Grid>
              <material_1.Grid item xs={6} paddingLeft={2}>
                <components_1.InsuranceContainer />
                <components_1.SecondaryInsuranceContainer />
                <components_1.ResponsibleInformationContainer />
                <components_1.CompletedFormsContainer />
              </material_1.Grid>
            </material_1.Grid>
          </material_1.Box>)}
      </material_1.Box>
    </PageContainer_1.default>);
};
exports.PatientVisitDetails = PatientVisitDetails;
//# sourceMappingURL=PatientVisitDetailsPage.js.map