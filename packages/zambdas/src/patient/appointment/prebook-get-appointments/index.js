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
exports.index = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('get-appointments', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, patientID, dateRange, secrets, now, oystehr, user, patients, response_1, patientIDs, params, dateLowerFormatted, dateUpperFormatted, allResources_1, appointments, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                patientID = validatedParameters.patientID, dateRange = validatedParameters.dateRange, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                now = luxon_1.DateTime.now().setZone('UTC');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _a.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _a.label = 3;
            case 3:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                console.log('getting user');
                return [4 /*yield*/, (0, shared_1.getUser)(input.headers.Authorization.replace('Bearer ', ''), secrets)];
            case 4:
                user = _a.sent();
                console.log('getting patients for user');
                return [4 /*yield*/, (0, utils_1.getPatientsForUser)(user, oystehr)];
            case 5:
                patients = _a.sent();
                if (!patients.length) {
                    response_1 = {
                        message: 'No patients for this user',
                        appointments: [],
                    };
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify(response_1),
                        }];
                }
                patientIDs = patients.map(function (patient) { return "Patient/".concat(patient.id); });
                if (patientID && !patientIDs.includes("Patient/".concat(patientID))) {
                    throw utils_1.NO_READ_ACCESS_TO_PATIENT_ERROR;
                }
                params = [
                    {
                        name: '_include',
                        value: 'Appointment:slot',
                    },
                    {
                        name: '_include',
                        value: 'Appointment:patient',
                    },
                    {
                        name: '_include',
                        value: 'Appointment:location',
                    },
                    {
                        name: '_revinclude',
                        value: 'Encounter:appointment',
                    },
                    {
                        name: '_revinclude:iterate',
                        value: 'QuestionnaireResponse:encounter',
                    },
                    {
                        name: 'status:not',
                        value: 'cancelled',
                    },
                    {
                        name: 'status:not',
                        value: 'noshow',
                    },
                    {
                        name: '_sort',
                        value: 'date',
                    },
                    {
                        name: '_count',
                        value: '1000',
                    },
                ];
                if (patientID) {
                    params.push({
                        name: 'patient',
                        value: "Patient/".concat(patientID),
                    });
                }
                else {
                    params.push({
                        name: 'patient',
                        value: patientIDs.join(','),
                    }, {
                        name: 'status:not',
                        value: 'fulfilled',
                    });
                }
                if (dateRange) {
                    dateLowerFormatted = luxon_1.DateTime.fromISO(dateRange.greaterThan).setZone('UTC').toISO();
                    console.log('dateLowerFormatted', dateLowerFormatted);
                    dateUpperFormatted = luxon_1.DateTime.fromISO(dateRange.lessThan).setZone('UTC').toISO();
                    console.log('dateUpperFormatted', dateUpperFormatted);
                    params.push({ name: 'date', value: "ge".concat(dateLowerFormatted) }, { name: 'date', value: "le".concat(dateUpperFormatted) });
                }
                else {
                    params.push({
                        name: 'date',
                        value: "ge".concat(now.setZone('UTC').startOf('day').toISO()),
                    });
                }
                console.log('getting all appointment resources');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: params,
                    })];
            case 6:
                allResources_1 = (_a.sent())
                    .unbundle()
                    .filter(function (resource) { return (0, utils_1.isNonPaperworkQuestionnaireResponse)(resource) === false; });
                console.log('successfully retrieved appointment resources');
                appointments = allResources_1
                    .filter(function (resourceTemp) { return resourceTemp.resourceType === 'Appointment'; })
                    .map(function (appointmentTemp) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
                    var fhirAppointment = appointmentTemp;
                    var patientID = (_c = (_b = (_a = fhirAppointment.participant
                        .find(function (participantTemp) { var _a, _b; return (_b = (_a = participantTemp.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/')[1];
                    var locationID = (_f = (_e = (_d = fhirAppointment.participant
                        .find(function (participantTemp) { var _a, _b; return (_b = (_a = participantTemp.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Location/'); })) === null || _d === void 0 ? void 0 : _d.actor) === null || _e === void 0 ? void 0 : _e.reference) === null || _f === void 0 ? void 0 : _f.split('/')[1];
                    var encounter = allResources_1
                        .filter(function (resourceTemp) { return resourceTemp.resourceType === 'Encounter'; })
                        .find(function (resource) { var _a; return ((_a = resource.appointment) === null || _a === void 0 ? void 0 : _a[0].reference) === "Appointment/".concat(appointmentTemp.id); });
                    var questionnaireResponse = allResources_1
                        .filter(function (resourceTemp) { return resourceTemp.resourceType === 'QuestionnaireResponse'; })
                        .find(function (resource) { var _a; return ((_a = resource.encounter) === null || _a === void 0 ? void 0 : _a.reference) === "Encounter/".concat(encounter === null || encounter === void 0 ? void 0 : encounter.id); });
                    var patient = allResources_1.find(function (resourceTemp) { return resourceTemp.id === patientID; });
                    var location = allResources_1.find(function (resourceTemp) { return resourceTemp.id === locationID; });
                    console.log("build appointment resource for appointment with id ".concat(fhirAppointment.id));
                    var appointment = {
                        id: fhirAppointment.id || 'Unknown',
                        patientID: (patient === null || patient === void 0 ? void 0 : patient.id) || 'Unknown',
                        firstName: ((_j = (_h = (_g = patient === null || patient === void 0 ? void 0 : patient.name) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.given) === null || _j === void 0 ? void 0 : _j[0]) || 'Unknown',
                        middleName: ((_m = (_l = (_k = patient === null || patient === void 0 ? void 0 : patient.name) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.given) === null || _m === void 0 ? void 0 : _m[1]) || '',
                        lastName: ((_o = patient === null || patient === void 0 ? void 0 : patient.name) === null || _o === void 0 ? void 0 : _o[0].family) || 'Unknown',
                        start: fhirAppointment.start || 'Unknown',
                        status: fhirAppointment === null || fhirAppointment === void 0 ? void 0 : fhirAppointment.status,
                        location: {
                            name: (location === null || location === void 0 ? void 0 : location.name) || 'Unknown',
                            id: (location === null || location === void 0 ? void 0 : location.id) || 'Unknown',
                            slug: ((_q = (_p = location === null || location === void 0 ? void 0 : location.identifier) === null || _p === void 0 ? void 0 : _p.find(function (identifierTemp) { return identifierTemp.system === utils_1.SLUG_SYSTEM; })) === null || _q === void 0 ? void 0 : _q.value) || 'Unknown',
                            state: ((_s = (_r = location === null || location === void 0 ? void 0 : location.address) === null || _r === void 0 ? void 0 : _r.state) === null || _s === void 0 ? void 0 : _s.toLocaleLowerCase()) || 'Unknown',
                            timezone: ((_u = (_t = location === null || location === void 0 ? void 0 : location.extension) === null || _t === void 0 ? void 0 : _t.find(function (extTemp) { return extTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'; })) === null || _u === void 0 ? void 0 : _u.valueString) || 'Unknown',
                        },
                        paperworkComplete: (0, shared_1.checkPaperworkComplete)(questionnaireResponse),
                        checkedIn: fhirAppointment.status !== 'booked',
                        visitType: ((_v = fhirAppointment.appointmentType) === null || _v === void 0 ? void 0 : _v.text) || 'Unknown',
                        visitStatus: (0, utils_1.getInPersonVisitStatus)(fhirAppointment, encounter),
                    };
                    return appointment;
                });
                response = {
                    message: 'Successfully retrieved all appointments',
                    appointments: appointments,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 7:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('get-appointments', error_1, ENVIRONMENT)];
            case 8: return [2 /*return*/];
        }
    });
}); });
