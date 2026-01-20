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
exports.getEncounterDetails = exports.getVideoEncounterForAppointment = void 0;
var utils_1 = require("utils");
var shared_1 = require("../shared");
var getVideoEncounterForAppointment = function (appointmentID, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var encounter, encounters;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                encounter = undefined;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: 'appointment',
                                value: "Appointment/".concat(appointmentID),
                            },
                        ],
                    })];
            case 1:
                encounters = (_a.sent()).unbundle();
                encounter = (encounters !== null && encounters !== void 0 ? encounters : []).find(function (encounterTemp) {
                    return Boolean((0, utils_1.getVirtualServiceResourceExtension)(encounterTemp, utils_1.TELEMED_VIDEO_ROOM_CODE));
                });
                return [2 /*return*/, encounter];
        }
    });
}); };
exports.getVideoEncounterForAppointment = getVideoEncounterForAppointment;
var getEncounterDetails = function (appointmentID, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var curStatusHistoryIdx, location, visitType, appointmentStart, patientID, canceledHistoryIdx, encounter, appointment, locationId, fhirLocation, _a, _b;
    var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    return __generator(this, function (_o) {
        switch (_o.label) {
            case 0: return [4 /*yield*/, (0, utils_1.getEncounterForAppointment)(appointmentID, oystehr)];
            case 1:
                encounter = _o.sent();
                appointment = undefined;
                console.log('Got encounter with id', encounter.id);
                if (encounter.statusHistory) {
                    curStatusHistoryIdx = encounter.statusHistory.findIndex(function (history) { return !history.period.end; });
                    canceledHistoryIdx = encounter.statusHistory.findIndex(function (history) { return history.status === 'cancelled' && !history.period.end; });
                }
                else {
                    throw new Error('Encounter status history not found');
                }
                _o.label = 2;
            case 2:
                _o.trys.push([2, 4, , 5]);
                locationId = ((_e = (_d = (_c = encounter.location) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.location.reference) === null || _e === void 0 ? void 0 : _e.replace('Location/', '')) || '';
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Location',
                        id: locationId,
                    })];
            case 3:
                fhirLocation = _o.sent();
                location = {
                    name: (fhirLocation === null || fhirLocation === void 0 ? void 0 : fhirLocation.name) || 'Unknown',
                    slug: ((_g = (_f = fhirLocation.identifier) === null || _f === void 0 ? void 0 : _f.find(function (identifierTemp) { return identifierTemp.system === utils_1.SLUG_SYSTEM; })) === null || _g === void 0 ? void 0 : _g.value) || 'Unknown',
                    state: ((_h = fhirLocation.address) === null || _h === void 0 ? void 0 : _h.state) || 'Unknown',
                    timezone: ((_k = (_j = fhirLocation.extension) === null || _j === void 0 ? void 0 : _j.find(function (extTemp) { return extTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'; })) === null || _k === void 0 ? void 0 : _k.valueString) || 'Unknown',
                    address: (_l = fhirLocation === null || fhirLocation === void 0 ? void 0 : fhirLocation.address) !== null && _l !== void 0 ? _l : undefined,
                };
                return [3 /*break*/, 5];
            case 4:
                _a = _o.sent();
                throw new Error('Error getting location details');
            case 5:
                _o.trys.push([5, 7, , 8]);
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Appointment',
                        id: appointmentID,
                    })];
            case 6:
                appointment = (_o.sent());
                if (!appointment) {
                    throw new Error('error searching for appointment resource');
                }
                patientID = (0, shared_1.getParticipantFromAppointment)(appointment, 'Patient');
                appointmentStart = appointment.start;
                visitType = ((_m = appointment.appointmentType) === null || _m === void 0 ? void 0 : _m.text) || 'Unknown';
                return [3 /*break*/, 8];
            case 7:
                _b = _o.sent();
                throw new Error('Error getting appointment details');
            case 8: return [2 /*return*/, {
                    encounter: encounter,
                    curStatusHistoryIdx: curStatusHistoryIdx,
                    canceledHistoryIdx: canceledHistoryIdx,
                    location: location,
                    visitType: visitType,
                    appointmentStart: appointmentStart,
                    appointment: appointment,
                    patientID: patientID,
                }];
        }
    });
}); };
exports.getEncounterDetails = getEncounterDetails;
