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
var helpers_1 = require("../../helpers");
var helpers_2 = require("../helpers");
var validateRequestParameters_1 = require("../validateRequestParameters");
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('sub-ready-text', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, task, secrets, oystehr, taskStatusToUpdate, statusReasonToUpdate, appointmentID, fhirAppointment_1, fhirLocation_1, fhirPatient_1, fhirRelatedPerson_1, allResources, missingResources, email, timezone, startTime, visitType, message, _a, taskStatus, statusReason, patchedTask, response, error_1, ENVIRONMENT;
    var _b, _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                _j.trys.push([0, 9, , 10]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                task = validatedParameters.task, secrets = validatedParameters.secrets;
                console.log('task ID', task.id);
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _j.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _j.label = 3;
            case 3:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                taskStatusToUpdate = void 0;
                statusReasonToUpdate = void 0;
                console.log('getting appointment Id from the task');
                appointmentID = ((_b = task.focus) === null || _b === void 0 ? void 0 : _b.type) === 'Appointment' ? (_d = (_c = task.focus) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.replace('Appointment/', '') : undefined;
                console.log('appointment ID parsed: ', appointmentID);
                console.log('searching for appointment, location and patient resources related to this task');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            {
                                name: '_id',
                                value: appointmentID || '',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:location',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:patient',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'RelatedPerson:patient',
                            },
                        ],
                    })];
            case 4:
                allResources = (_j.sent()).unbundle();
                console.log("number of resources returned ".concat(allResources.length));
                allResources.forEach(function (resource) {
                    var _a;
                    if (resource.resourceType === 'Appointment') {
                        fhirAppointment_1 = resource;
                    }
                    if (resource.resourceType === 'Location') {
                        fhirLocation_1 = resource;
                    }
                    if (resource.resourceType === 'Patient') {
                        fhirPatient_1 = resource;
                    }
                    if (resource.resourceType === 'RelatedPerson') {
                        var relatedPerson = resource;
                        var isUserRelatedPerson = (_a = relatedPerson.relationship) === null || _a === void 0 ? void 0 : _a.find(function (relationship) { var _a; return (_a = relationship.coding) === null || _a === void 0 ? void 0 : _a.find(function (code) { return code.code === 'user-relatedperson'; }); });
                        if (isUserRelatedPerson) {
                            fhirRelatedPerson_1 = relatedPerson;
                        }
                    }
                });
                missingResources = [];
                if (!fhirAppointment_1)
                    missingResources.push('appointment');
                if (!fhirLocation_1)
                    missingResources.push('location');
                if (!fhirPatient_1)
                    missingResources.push('patient');
                if (!fhirAppointment_1 || !fhirLocation_1 || !fhirPatient_1) {
                    throw new Error("missing the following vital resources: ".concat(missingResources.join(',')));
                }
                console.log('formatting information included in email');
                email = (0, utils_1.getPatientContactEmail)(fhirPatient_1);
                timezone = (_f = (_e = fhirLocation_1.extension) === null || _e === void 0 ? void 0 : _e.find(function (extensionTemp) { return extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'; })) === null || _f === void 0 ? void 0 : _f.valueString;
                startTime = luxon_1.DateTime.fromISO((fhirAppointment_1 === null || fhirAppointment_1 === void 0 ? void 0 : fhirAppointment_1.start) || '')
                    .setZone(timezone)
                    .toFormat(utils_1.DATETIME_FULL_NO_YEAR);
                visitType = (_h = (_g = fhirAppointment_1.appointmentType) === null || _g === void 0 ? void 0 : _g.text) !== null && _h !== void 0 ? _h : 'Unknown';
                console.log('info', email, timezone, startTime, visitType);
                if (!fhirRelatedPerson_1) return [3 /*break*/, 6];
                message = "Please set up access to your patient portal so you can view test results and discharge information: ".concat(utils_1.PROJECT_WEBSITE, "/patient-portal");
                return [4 /*yield*/, (0, helpers_2.sendText)(message, fhirRelatedPerson_1, oystehrToken, secrets)];
            case 5:
                _a = _j.sent(), taskStatus = _a.taskStatus, statusReason = _a.statusReason;
                taskStatusToUpdate = taskStatus;
                statusReasonToUpdate = statusReason;
                return [3 /*break*/, 7];
            case 6:
                taskStatusToUpdate = 'failed';
                statusReasonToUpdate = 'could not retrieve related person to get sms number';
                console.log('No related person found. Skipping sending text');
                _j.label = 7;
            case 7:
                if (!taskStatusToUpdate) {
                    console.log('no task was attempted');
                    taskStatusToUpdate = 'failed';
                    statusReasonToUpdate = 'no task was attempted';
                }
                // update task status and status reason
                console.log('making patch request to update task status');
                return [4 /*yield*/, (0, helpers_1.patchTaskStatus)({ task: task, taskStatusToUpdate: taskStatusToUpdate, statusReasonToUpdate: statusReasonToUpdate }, oystehr)];
            case 8:
                patchedTask = _j.sent();
                console.log('successfully patched task');
                console.log(JSON.stringify(patchedTask));
                response = {
                    taskStatus: taskStatusToUpdate,
                    statusReason: statusReasonToUpdate,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 9:
                error_1 = _j.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('sub-ready-text', error_1, ENVIRONMENT)];
            case 10: return [2 /*return*/];
        }
    });
}); });
