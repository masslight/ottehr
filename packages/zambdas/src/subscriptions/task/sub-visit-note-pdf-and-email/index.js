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
var get_chart_data_1 = require("../../../ehr/get-chart-data");
var helpers_1 = require("../../../ehr/get-in-house-orders/helpers");
var helpers_2 = require("../../../ehr/get-lab-orders/helpers");
var get_medication_orders_1 = require("../../../ehr/get-medication-orders");
var get_orders_1 = require("../../../ehr/immunization/get-orders");
var shared_1 = require("../../../ehr/schedules/shared");
var helpers_3 = require("../../../patient/appointment/get-visit-details/helpers");
var shared_2 = require("../../../shared");
var get_video_resources_1 = require("../../../shared/pdf/visit-details-pdf/get-video-resources");
var make_visit_note_pdf_document_reference_1 = require("../../../shared/pdf/visit-details-pdf/make-visit-note-pdf-document-reference");
var visit_note_pdf_creation_1 = require("../../../shared/pdf/visit-details-pdf/visit-note-pdf-creation");
var validateRequestParameters_1 = require("../validateRequestParameters");
var oystehrToken;
var oystehr;
var taskId;
var ZAMBDA_NAME = 'sub-visit-note-pdf-and-email';
exports.index = (0, shared_2.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, task, secrets, appointmentId, visitResources, encounter, patient, appointment, location, listResources, isInPersonAppointment, isPDFOnlyTask, chartDataPromise, additionalChartDataPromise, medicationOrdersPromise, externalLabOrdersPromise, inHouseOrdersPromise, _a, chartDataResult, additionalChartDataResult, externalLabsData, inHouseOrdersData, medicationOrdersData, immunizationOrders, chartData, additionalChartData, medicationOrders, pdfInfo, emailClient, emailEnabled, patientEmail, prettyStartTime, locationName, address, presignedUrls, visitNoteUrl, missingData, templateData, missingData, templateData, statusMessage, patchedTask, response, error_1, ENVIRONMENT, patchError_1;
    var _b, _c, _d, _e, _f, _g, _h, _j, _k;
    return __generator(this, function (_l) {
        switch (_l.label) {
            case 0:
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                task = validatedParameters.task, secrets = validatedParameters.secrets;
                console.log('task ID', task.id);
                if (!task.id) {
                    throw new Error('Task ID is required');
                }
                taskId = task.id;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_2.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _l.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _l.label = 3;
            case 3:
                oystehr = (0, shared_2.createOystehrClient)(oystehrToken, secrets);
                console.log('getting appointment Id from the task');
                appointmentId = ((_b = task.focus) === null || _b === void 0 ? void 0 : _b.type) === 'Appointment' ? (_d = (_c = task.focus) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.replace('Appointment/', '') : undefined;
                console.log('appointment ID parsed: ', appointmentId);
                if (!appointmentId) {
                    console.log('no appointment ID found on task');
                    throw new Error('no appointment ID found on task focus');
                }
                return [4 /*yield*/, (0, get_video_resources_1.getAppointmentAndRelatedResources)(oystehr, appointmentId, true, (_f = (_e = task.encounter) === null || _e === void 0 ? void 0 : _e.reference) === null || _f === void 0 ? void 0 : _f.split('/')[1])];
            case 4:
                visitResources = _l.sent();
                if (!visitResources) {
                    {
                        throw new Error("Visit resources are not properly defined for appointment ".concat(appointmentId));
                    }
                }
                encounter = visitResources.encounter, patient = visitResources.patient, appointment = visitResources.appointment, location = visitResources.location, listResources = visitResources.listResources;
                if (((_g = encounter === null || encounter === void 0 ? void 0 : encounter.subject) === null || _g === void 0 ? void 0 : _g.reference) === undefined) {
                    throw new Error("No subject reference defined for encounter ".concat(encounter === null || encounter === void 0 ? void 0 : encounter.id));
                }
                if (!patient) {
                    throw new Error("No patient found for encounter ".concat(encounter.id));
                }
                isInPersonAppointment = !!((_j = (_h = visitResources.appointment.meta) === null || _h === void 0 ? void 0 : _h.tag) === null || _j === void 0 ? void 0 : _j.find(function (tag) { return tag.code === utils_1.OTTEHR_MODULE.IP; }));
                isPDFOnlyTask = (0, utils_1.isFollowupEncounter)(encounter);
                chartDataPromise = (0, get_chart_data_1.getChartData)(oystehr, oystehrToken, visitResources.encounter.id);
                additionalChartDataPromise = (0, get_chart_data_1.getChartData)(oystehr, oystehrToken, visitResources.encounter.id, isInPersonAppointment ? utils_1.progressNoteChartDataRequestedFields : utils_1.telemedProgressNoteChartDataRequestedFields);
                medicationOrdersPromise = (0, get_medication_orders_1.getMedicationOrders)(oystehr, {
                    searchBy: {
                        field: 'encounterId',
                        value: visitResources.encounter.id,
                    },
                });
                externalLabOrdersPromise = (0, helpers_2.getLabResources)(oystehr, {
                    searchBy: { field: 'encounterId', value: encounter.id },
                    itemsPerPage: 10,
                    pageIndex: 0,
                    secrets: secrets,
                }, oystehrToken, { searchBy: { field: 'encounterId', value: encounter.id } });
                inHouseOrdersPromise = (0, helpers_1.getInHouseResources)(oystehr, {
                    searchBy: { field: 'encounterId', value: encounter.id },
                    itemsPerPage: 10,
                    pageIndex: 0,
                    secrets: secrets,
                    userToken: '',
                }, { searchBy: { field: 'encounterId', value: encounter.id } }, oystehrToken);
                return [4 /*yield*/, Promise.all([
                        chartDataPromise,
                        additionalChartDataPromise,
                        externalLabOrdersPromise,
                        inHouseOrdersPromise,
                        medicationOrdersPromise,
                    ])];
            case 5:
                _a = _l.sent(), chartDataResult = _a[0], additionalChartDataResult = _a[1], externalLabsData = _a[2], inHouseOrdersData = _a[3], medicationOrdersData = _a[4];
                return [4 /*yield*/, (0, get_orders_1.getImmunizationOrders)(oystehr, {
                        encounterId: visitResources.encounter.id,
                    })];
            case 6:
                immunizationOrders = (_l.sent()).orders;
                chartData = chartDataResult.response;
                additionalChartData = additionalChartDataResult.response;
                medicationOrders = medicationOrdersData === null || medicationOrdersData === void 0 ? void 0 : medicationOrdersData.orders.filter(function (order) { return order.status !== 'cancelled'; });
                console.log('Chart data received');
                _l.label = 7;
            case 7:
                _l.trys.push([7, 19, , 25]);
                return [4 /*yield*/, (0, visit_note_pdf_creation_1.composeAndCreateVisitNotePdf)({ chartData: chartData, additionalChartData: additionalChartData, medicationOrders: medicationOrders, immunizationOrders: immunizationOrders, externalLabsData: externalLabsData, inHouseOrdersData: inHouseOrdersData }, visitResources, secrets, oystehrToken)];
            case 8:
                pdfInfo = _l.sent();
                if (!(patient === null || patient === void 0 ? void 0 : patient.id))
                    throw new Error("No patient has been found for encounter: ".concat(encounter.id));
                console.log("Creating visit note pdf docRef");
                return [4 /*yield*/, (0, make_visit_note_pdf_document_reference_1.makeVisitNotePdfDocumentReference)(oystehr, pdfInfo, patient.id, appointmentId, encounter.id, listResources)];
            case 9:
                _l.sent();
                emailClient = (0, shared_2.getEmailClient)(secrets);
                emailEnabled = emailClient.getFeatureFlag();
                if (!(emailEnabled && !isPDFOnlyTask)) return [3 /*break*/, 17];
                patientEmail = (0, utils_1.getPatientContactEmail)(patient);
                prettyStartTime = '';
                locationName = '';
                address = '';
                if (appointment.start && visitResources.timezone) {
                    prettyStartTime = luxon_1.DateTime.fromISO(appointment.start)
                        .setZone(visitResources.timezone)
                        .toFormat(utils_1.DATETIME_FULL_NO_YEAR);
                }
                if (location) {
                    locationName = (0, shared_1.getNameForOwner)(location);
                    address = (_k = (0, utils_1.getAddressStringForScheduleResource)(location)) !== null && _k !== void 0 ? _k : '';
                }
                return [4 /*yield*/, (0, helpers_3.getPresignedURLs)(oystehr, oystehrToken, visitResources.encounter.id)];
            case 10:
                presignedUrls = _l.sent();
                visitNoteUrl = presignedUrls['visit-note'].presignedUrl;
                if (!isInPersonAppointment) return [3 /*break*/, 14];
                missingData = [];
                if (!patientEmail)
                    missingData.push('patient email');
                if (!appointment.id)
                    missingData.push('appointment ID');
                if (!locationName)
                    missingData.push('location name');
                if (!address)
                    missingData.push('address');
                if (!prettyStartTime)
                    missingData.push('appointment time');
                if (!visitNoteUrl)
                    missingData.push('visit note URL');
                if (!(missingData.length === 0 && location && visitNoteUrl && patientEmail)) return [3 /*break*/, 12];
                templateData = {
                    location: (0, shared_1.getNameForOwner)(location),
                    time: prettyStartTime,
                    address: address,
                    'address-url': (0, shared_2.makeAddressUrl)(address),
                    'visit-note-url': visitNoteUrl,
                };
                return [4 /*yield*/, emailClient.sendInPersonCompletionEmail(patientEmail, templateData)];
            case 11:
                _l.sent();
                return [3 /*break*/, 13];
            case 12:
                console.error("Not sending in-person completion email, missing the following data: ".concat(missingData.join(', ')));
                _l.label = 13;
            case 13: return [3 /*break*/, 17];
            case 14:
                missingData = [];
                if (!patientEmail)
                    missingData.push('patient email');
                if (!appointment.id)
                    missingData.push('appointment ID');
                if (!locationName)
                    missingData.push('location name');
                if (!visitNoteUrl)
                    missingData.push('visit note URL');
                if (!(missingData.length === 0 && location && visitNoteUrl && patientEmail)) return [3 /*break*/, 16];
                templateData = {
                    location: (0, shared_1.getNameForOwner)(location),
                    'visit-note-url': visitNoteUrl,
                };
                return [4 /*yield*/, emailClient.sendVirtualCompletionEmail(patientEmail, templateData)];
            case 15:
                _l.sent();
                return [3 /*break*/, 17];
            case 16:
                console.error("Not sending virtual completion email, missing the following data: ".concat(missingData.join(', ')));
                _l.label = 17;
            case 17:
                // update task status and status reason
                console.log('making patch request to update task status');
                statusMessage = isPDFOnlyTask ? 'PDF created successfully' : 'PDF created and emailed successfully';
                return [4 /*yield*/, patchTaskStatus(oystehr, task.id, 'completed', statusMessage)];
            case 18:
                patchedTask = _l.sent();
                response = {
                    taskStatus: patchedTask.status,
                    statusReason: patchedTask.statusReason,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 19:
                error_1 = _l.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                _l.label = 20;
            case 20:
                _l.trys.push([20, 23, , 24]);
                if (!(oystehr && taskId)) return [3 /*break*/, 22];
                return [4 /*yield*/, patchTaskStatus(oystehr, taskId, 'failed', JSON.stringify(error_1))];
            case 21:
                _l.sent();
                _l.label = 22;
            case 22: return [3 /*break*/, 24];
            case 23:
                patchError_1 = _l.sent();
                console.error('Error patching task status in top level catch:', patchError_1);
                return [3 /*break*/, 24];
            case 24: return [2 /*return*/, (0, shared_2.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 25: return [2 /*return*/];
        }
    });
}); });
var patchTaskStatus = function (oystehr, taskId, status, reason) { return __awaiter(void 0, void 0, void 0, function () {
    var patchedTask;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.patch({
                    resourceType: 'Task',
                    id: taskId,
                    operations: [
                        {
                            op: 'replace',
                            path: '/status',
                            value: status,
                        },
                        {
                            op: 'add',
                            path: '/statusReason',
                            value: {
                                coding: [
                                    {
                                        system: 'status-reason',
                                        code: reason || 'no reason given',
                                    },
                                ],
                            },
                        },
                    ],
                })];
            case 1:
                patchedTask = _a.sent();
                console.log('successfully patched task');
                console.log(JSON.stringify(patchedTask));
                return [2 /*return*/, patchedTask];
        }
    });
}); };
