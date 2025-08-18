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
exports.VitalsTab = void 0;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var CSSLoader_1 = require("src/features/css-module/components/CSSLoader");
var VitalsNotesCard_1 = require("src/features/css-module/components/patient-info/VitalsNotesCard");
var VitalsBloodPressureCard_1 = require("src/features/css-module/components/vitals/blood-pressure/VitalsBloodPressureCard");
var VitalsHeartbeatCard_1 = require("src/features/css-module/components/vitals/heartbeat/VitalsHeartbeatCard");
var VitalsHeightCard_1 = require("src/features/css-module/components/vitals/heights/VitalsHeightCard");
var useDeleteVitals_1 = require("src/features/css-module/components/vitals/hooks/useDeleteVitals");
var useGetVitals_1 = require("src/features/css-module/components/vitals/hooks/useGetVitals");
var useSaveVitals_1 = require("src/features/css-module/components/vitals/hooks/useSaveVitals");
var VitalsOxygenSatCard_1 = require("src/features/css-module/components/vitals/oxygen-saturation/VitalsOxygenSatCard");
var VitalsRespirationRateCard_1 = require("src/features/css-module/components/vitals/respiration-rate/VitalsRespirationRateCard");
var VitalsTemperaturesCard_1 = require("src/features/css-module/components/vitals/temperature/VitalsTemperaturesCard");
var VitalsVisionCard_1 = require("src/features/css-module/components/vitals/vision/VitalsVisionCard");
var VitalsWeightsCard_1 = require("src/features/css-module/components/vitals/weights/VitalsWeightsCard");
var NavigationContext_1 = require("src/features/css-module/context/NavigationContext");
var useAppointment_1 = require("src/features/css-module/hooks/useAppointment");
var PageTitle_1 = require("src/telemed/components/PageTitle");
var state_1 = require("src/telemed/state");
var utils_1 = require("utils");
var VitalsTab = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    var appointmentID = (0, react_router_dom_1.useParams)().id;
    var _u = (0, useAppointment_1.useAppointment)(appointmentID), _v = _u.resources, appointment = _v.appointment, encounter = _v.encounter, isLoading = _u.isLoading, error = _u.error;
    var isChartDataLoading = (0, utils_1.getSelectors)(state_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    var interactionMode = (0, NavigationContext_1.useNavigationContext)().interactionMode;
    // todo: this duplicates the functionality of PatientVitals page and could be refactored to use a shared component
    var saveVitals = (0, useSaveVitals_1.useSaveVitals)({
        encounterId: (_a = encounter === null || encounter === void 0 ? void 0 : encounter.id) !== null && _a !== void 0 ? _a : '',
    });
    var deleteVitals = (0, useDeleteVitals_1.useDeleteVitals)({
        encounterId: (_b = encounter === null || encounter === void 0 ? void 0 : encounter.id) !== null && _b !== void 0 ? _b : '',
    });
    var handleSaveVital = function (vitalEntity) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, saveVitals(vitalEntity)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, refetchEncounterVitals()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var handleDeleteVital = function (vitalEntity) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, deleteVitals(vitalEntity)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, refetchEncounterVitals()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var _w = (0, useGetVitals_1.useGetVitals)(encounter === null || encounter === void 0 ? void 0 : encounter.id), encounterVitals = _w.data, encounterVitalsLoading = _w.isLoading, refetchEncounterVitals = _w.refetch;
    var historicalVitals = (0, useGetVitals_1.useGetHistoricalVitals)(encounter === null || encounter === void 0 ? void 0 : encounter.id).data;
    if (isLoading || isChartDataLoading || encounterVitalsLoading)
        return <CSSLoader_1.CSSLoader />;
    if (error)
        return <material_1.Typography>Error: {error.message}</material_1.Typography>;
    if (!appointment)
        return <material_1.Typography>No data available</material_1.Typography>;
    return (<material_1.Stack spacing={1}>
      <PageTitle_1.PageTitle label="Vitals" showIntakeNotesButton={interactionMode === 'intake'}/>
      <VitalsTemperaturesCard_1.default handleSaveVital={handleSaveVital} handleDeleteVital={handleDeleteVital} currentObs={(_c = encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalTemperature]) !== null && _c !== void 0 ? _c : []} historicalObs={(_d = historicalVitals === null || historicalVitals === void 0 ? void 0 : historicalVitals[utils_1.VitalFieldNames.VitalTemperature]) !== null && _d !== void 0 ? _d : []}/>
      <VitalsHeartbeatCard_1.default handleSaveVital={handleSaveVital} handleDeleteVital={handleDeleteVital} currentObs={(_e = encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalHeartbeat]) !== null && _e !== void 0 ? _e : []} historicalObs={(_f = historicalVitals === null || historicalVitals === void 0 ? void 0 : historicalVitals[utils_1.VitalFieldNames.VitalHeartbeat]) !== null && _f !== void 0 ? _f : []}/>
      <VitalsRespirationRateCard_1.default handleSaveVital={handleSaveVital} handleDeleteVital={handleDeleteVital} currentObs={(_g = encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalRespirationRate]) !== null && _g !== void 0 ? _g : []} historicalObs={(_h = historicalVitals === null || historicalVitals === void 0 ? void 0 : historicalVitals[utils_1.VitalFieldNames.VitalRespirationRate]) !== null && _h !== void 0 ? _h : []}/>
      <VitalsBloodPressureCard_1.default handleSaveVital={handleSaveVital} handleDeleteVital={handleDeleteVital} currentObs={(_j = encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalBloodPressure]) !== null && _j !== void 0 ? _j : []} historicalObs={(_k = historicalVitals === null || historicalVitals === void 0 ? void 0 : historicalVitals[utils_1.VitalFieldNames.VitalBloodPressure]) !== null && _k !== void 0 ? _k : []}/>
      <VitalsOxygenSatCard_1.default handleSaveVital={handleSaveVital} handleDeleteVital={handleDeleteVital} currentObs={(_l = encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalOxygenSaturation]) !== null && _l !== void 0 ? _l : []} historicalObs={(_m = historicalVitals === null || historicalVitals === void 0 ? void 0 : historicalVitals[utils_1.VitalFieldNames.VitalOxygenSaturation]) !== null && _m !== void 0 ? _m : []}/>
      <VitalsWeightsCard_1.default handleSaveVital={handleSaveVital} handleDeleteVital={handleDeleteVital} currentObs={(_o = encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalWeight]) !== null && _o !== void 0 ? _o : []} historicalObs={(_p = historicalVitals === null || historicalVitals === void 0 ? void 0 : historicalVitals[utils_1.VitalFieldNames.VitalWeight]) !== null && _p !== void 0 ? _p : []}/>
      <VitalsHeightCard_1.default handleSaveVital={handleSaveVital} handleDeleteVital={handleDeleteVital} currentObs={(_q = encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalHeight]) !== null && _q !== void 0 ? _q : []} historicalObs={(_r = historicalVitals === null || historicalVitals === void 0 ? void 0 : historicalVitals[utils_1.VitalFieldNames.VitalHeight]) !== null && _r !== void 0 ? _r : []}/>
      <VitalsVisionCard_1.default handleSaveVital={handleSaveVital} handleDeleteVital={handleDeleteVital} currentObs={(_s = encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalVision]) !== null && _s !== void 0 ? _s : []} historicalObs={(_t = historicalVitals === null || historicalVitals === void 0 ? void 0 : historicalVitals[utils_1.VitalFieldNames.VitalVision]) !== null && _t !== void 0 ? _t : []}/>
      <VitalsNotesCard_1.default />
      {/* Alert modal needed here??*/}
    </material_1.Stack>);
};
exports.VitalsTab = VitalsTab;
//# sourceMappingURL=VitalsTab.js.map