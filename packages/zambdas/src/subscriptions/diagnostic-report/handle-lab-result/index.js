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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.index = void 0;
var utils_1 = require("utils");
var labs_1 = require("../../../ehr/shared/labs");
var shared_1 = require("../../../shared");
var labs_results_form_pdf_1 = require("../../../shared/pdf/labs-results-form-pdf");
var tasks_1 = require("../../../shared/tasks");
var helpers_1 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'handle-lab-result';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, diagnosticReport_1, secrets, specificDrTypeFromTag, isUnsolicited, isUnsolicitedAndMatched, serviceRequestId, oystehr, _b, tasks, patient, labOrg, encounter, requests_1, preSubmissionTask, appointmentRef, appointmentId, taskInput, nonNormalResult, showTaskOnBoard, newTask, oystehrResponse, response_1, error_1, ENVIRONMENT;
    var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    return __generator(this, function (_o) {
        switch (_o.label) {
            case 0:
                console.log("Input: ".concat(JSON.stringify(input, undefined, 2)));
                _o.label = 1;
            case 1:
                _o.trys.push([1, 14, , 15]);
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), diagnosticReport_1 = _a.diagnosticReport, secrets = _a.secrets;
                if (!!oystehrToken) return [3 /*break*/, 3];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 2:
                oystehrToken = _o.sent();
                return [3 /*break*/, 4];
            case 3:
                console.log('already have token');
                _o.label = 4;
            case 4:
                specificDrTypeFromTag = (0, labs_1.diagnosticReportSpecificResultType)(diagnosticReport_1);
                isUnsolicited = specificDrTypeFromTag === utils_1.LAB_DR_TYPE_TAG.code.unsolicited;
                isUnsolicitedAndMatched = isUnsolicited && !!((_d = (_c = diagnosticReport_1.subject) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.startsWith('Patient/'));
                serviceRequestId = (_g = (_f = (_e = diagnosticReport_1 === null || diagnosticReport_1 === void 0 ? void 0 : diagnosticReport_1.basedOn) === null || _e === void 0 ? void 0 : _e.find(function (temp) { var _a; return (_a = temp.reference) === null || _a === void 0 ? void 0 : _a.startsWith('ServiceRequest/'); })) === null || _f === void 0 ? void 0 : _f.reference) === null || _g === void 0 ? void 0 : _g.split('/')[1];
                console.log('specificDrTypeFromTag', specificDrTypeFromTag);
                console.log('isUnsolicitedAndMatched:', isUnsolicitedAndMatched);
                console.log('isUnsolicited', isUnsolicited);
                console.log('diagnosticReport: ', diagnosticReport_1.id);
                console.log('serviceRequestId:', serviceRequestId);
                if (!serviceRequestId && specificDrTypeFromTag === undefined) {
                    throw new Error('ServiceRequest id is not found');
                }
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                return [4 /*yield*/, (0, helpers_1.fetchRelatedResources)(diagnosticReport_1, oystehr)];
            case 5:
                _b = _o.sent(), tasks = _b.tasks, patient = _b.patient, labOrg = _b.labOrg, encounter = _b.encounter;
                requests_1 = [];
                // See if the diagnosticReport has any existing tasks associated in the
                // if there were existing in-progress or ready tasks, then those should be set to 'cancelled' (two l's)
                tasks.forEach(function (task) {
                    var _a;
                    if (['ready', 'in-progress'].includes(task.status) &&
                        ((_a = (0, utils_1.getCoding)(task.code, utils_1.LAB_ORDER_TASK.system)) === null || _a === void 0 ? void 0 : _a.code) != utils_1.LAB_ORDER_TASK.code.preSubmission) {
                        requests_1.push({
                            url: "/Task/".concat(task.id),
                            method: 'PATCH',
                            operations: [
                                {
                                    op: 'replace',
                                    path: '/status',
                                    value: diagnosticReport_1.status === 'cancelled' ? 'rejected' : 'cancelled',
                                },
                            ],
                        });
                    }
                });
                preSubmissionTask = tasks.find(function (task) { var _a; return ((_a = (0, utils_1.getCoding)(task.code, utils_1.LAB_ORDER_TASK.system)) === null || _a === void 0 ? void 0 : _a.code) == utils_1.LAB_ORDER_TASK.code.preSubmission; });
                appointmentRef = (_h = encounter === null || encounter === void 0 ? void 0 : encounter.appointment) === null || _h === void 0 ? void 0 : _h[0].reference;
                appointmentId = (appointmentRef === null || appointmentRef === void 0 ? void 0 : appointmentRef.startsWith('Appointment/'))
                    ? appointmentRef === null || appointmentRef === void 0 ? void 0 : appointmentRef.replace('Appointment/', '')
                    : undefined;
                taskInput = (preSubmissionTask === null || preSubmissionTask === void 0 ? void 0 : preSubmissionTask.input)
                    ? preSubmissionTask.input
                    : [
                        {
                            type: utils_1.LAB_ORDER_TASK.input.testName,
                            valueString: (0, utils_1.getTestNameOrCodeFromDr)(diagnosticReport_1),
                        },
                        {
                            type: utils_1.LAB_ORDER_TASK.input.labName,
                            valueString: labOrg === null || labOrg === void 0 ? void 0 : labOrg.name,
                        },
                        {
                            type: utils_1.LAB_ORDER_TASK.input.receivedDate,
                            valueString: diagnosticReport_1.effectiveDateTime,
                        },
                        {
                            type: utils_1.LAB_ORDER_TASK.input.patientName,
                            valueString: patient ? (0, utils_1.getFullestAvailableName)(patient) : undefined,
                        },
                        {
                            type: utils_1.LAB_ORDER_TASK.input.appointmentId,
                            valueString: appointmentId ? appointmentId : undefined,
                        },
                    ];
                if (specificDrTypeFromTag && taskInput) {
                    taskInput.push({
                        type: utils_1.LAB_ORDER_TASK.input.drTag,
                        valueString: specificDrTypeFromTag,
                    });
                }
                nonNormalResult = (0, labs_1.nonNonNormalTagsContained)(diagnosticReport_1);
                if (nonNormalResult)
                    console.log('nonNormalResult:', nonNormalResult);
                if (nonNormalResult === null || nonNormalResult === void 0 ? void 0 : nonNormalResult.includes(utils_1.NonNormalResult.Abnormal)) {
                    taskInput.push({
                        type: utils_1.LAB_ORDER_TASK.input.alert,
                        valueString: utils_1.TaskAlertCode.abnormalLabResult,
                    });
                }
                showTaskOnBoard = diagnosticReport_1.status !== 'preliminary' || isUnsolicited;
                console.log('showTaskOnBoard', showTaskOnBoard);
                newTask = (0, tasks_1.createTask)({
                    category: utils_1.LAB_ORDER_TASK.category,
                    code: {
                        system: utils_1.LAB_ORDER_TASK.system,
                        code: (0, helpers_1.getCodeForNewTask)(diagnosticReport_1, isUnsolicited, isUnsolicitedAndMatched),
                    },
                    encounterId: (_l = (_k = (_j = preSubmissionTask === null || preSubmissionTask === void 0 ? void 0 : preSubmissionTask.encounter) === null || _j === void 0 ? void 0 : _j.reference) === null || _k === void 0 ? void 0 : _k.split('/')[1]) !== null && _l !== void 0 ? _l : '',
                    basedOn: __spreadArray([
                        "DiagnosticReport/".concat(diagnosticReport_1.id)
                    ], (serviceRequestId ? ["ServiceRequest/".concat(serviceRequestId)] : []), true),
                    location: preSubmissionTask ? (0, tasks_1.getTaskLocation)(preSubmissionTask) : undefined,
                    input: taskInput,
                }, showTaskOnBoard);
                if (diagnosticReport_1.status === 'cancelled') {
                    newTask.status = 'completed';
                }
                requests_1.push({
                    method: 'POST',
                    url: '/Task',
                    resource: newTask,
                });
                console.log('creating a new task with code: ', JSON.stringify(newTask.code));
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests_1 })];
            case 6:
                oystehrResponse = _o.sent();
                response_1 = {
                    updatedTasks: [],
                    createdTasks: [],
                };
                (_m = oystehrResponse.entry) === null || _m === void 0 ? void 0 : _m.forEach(function (ent) {
                    var _a, _b, _c, _d;
                    if (((_b = (_a = ent.response) === null || _a === void 0 ? void 0 : _a.outcome) === null || _b === void 0 ? void 0 : _b.id) === 'ok' && ent.resource)
                        response_1.updatedTasks.push(ent.resource);
                    else if (((_d = (_c = ent.response) === null || _c === void 0 ? void 0 : _c.outcome) === null || _d === void 0 ? void 0 : _d.id) === 'created' && ent.resource)
                        response_1.createdTasks.push(ent.resource);
                });
                if (!serviceRequestId) return [3 /*break*/, 8];
                return [4 /*yield*/, (0, labs_results_form_pdf_1.createExternalLabResultPDF)(oystehr, serviceRequestId, diagnosticReport_1, false, secrets, oystehrToken)];
            case 7:
                _o.sent();
                return [3 /*break*/, 13];
            case 8:
                if (!(specificDrTypeFromTag !== undefined)) return [3 /*break*/, 12];
                if (!(isUnsolicitedAndMatched || specificDrTypeFromTag === utils_1.LabType.reflex)) return [3 /*break*/, 10];
                if (!diagnosticReport_1.id)
                    throw Error('unable to parse id from diagnostic report');
                console.log("creating pdf for ".concat(specificDrTypeFromTag, " result"));
                return [4 /*yield*/, (0, labs_results_form_pdf_1.createExternalLabResultPDFBasedOnDr)(oystehr, specificDrTypeFromTag, diagnosticReport_1.id, false, secrets, oystehrToken)];
            case 9:
                _o.sent();
                return [3 /*break*/, 11];
            case 10:
                console.log('skipping pdf creating for unsolicited result since it is not matched', diagnosticReport_1.id, isUnsolicited, isUnsolicitedAndMatched, specificDrTypeFromTag);
                _o.label = 11;
            case 11: return [3 /*break*/, 13];
            case 12:
                console.log('skipping pdf creation'); // shouldn't reach this tbh
                _o.label = 13;
            case 13: return [2 /*return*/, {
                    statusCode: 200,
                    body: JSON.stringify(response_1),
                }];
            case 14:
                error_1 = _o.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('handle-lab-result', error_1, ENVIRONMENT)];
            case 15: return [2 /*return*/];
        }
    });
}); });
