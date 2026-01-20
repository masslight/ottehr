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
exports.mapEncountersToAppointmentIds = mapEncountersToAppointmentIds;
exports.getFhirResources = getFhirResources;
var utils_1 = require("utils");
function mapEncountersToAppointmentIds(allResources) {
    var result = {};
    allResources.forEach(function (resource) {
        var _a;
        if (!(resource.resourceType === 'Encounter' && !(0, utils_1.isFollowupEncounter)(resource)))
            return;
        var encounter = resource;
        var appointmentReference = ((_a = encounter === null || encounter === void 0 ? void 0 : encounter.appointment) === null || _a === void 0 ? void 0 : _a[0].reference) || '';
        var appointmentId = (0, utils_1.removePrefix)('Appointment/', appointmentReference);
        if (appointmentId)
            result[appointmentId] = encounter;
    });
    return result;
}
function getFhirResources(oystehr, patientIDs, patientID) {
    return __awaiter(this, void 0, void 0, function () {
        var fhirSearchParams, bundle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fhirSearchParams = {
                        resourceType: 'Appointment',
                        params: [
                            { name: '_tag', value: [utils_1.OTTEHR_MODULE.TM, utils_1.OTTEHR_MODULE.IP].join(',') },
                            {
                                name: 'patient',
                                value: patientID ? "Patient/".concat(patientID) : patientIDs.join(','),
                            },
                            {
                                name: '_include',
                                value: 'Appointment:patient',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'RelatedPerson:patient',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Encounter:participant',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Encounter:appointment',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:location',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:actor',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Schedule:actor',
                            },
                        ],
                    };
                    return [4 /*yield*/, oystehr.fhir.search(fhirSearchParams)];
                case 1:
                    bundle = _a.sent();
                    return [2 /*return*/, bundle.unbundle()];
            }
        });
    });
}
