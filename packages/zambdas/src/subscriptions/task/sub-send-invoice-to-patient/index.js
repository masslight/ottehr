"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var harvest_1 = require("../../../ehr/shared/harvest");
var shared_1 = require("../../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'sub-send-invoice-to-patient';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParams, secrets, encounterId, prefilledInfo, task, amountCents, dueDate, memo, smsTextMessage, oystehr, stripe, fhirResources, patient, encounter, account, stripeAccount, stripeCustomerId, candidEncounterId, patientId, filledMemo, invoiceResponse, finalized, sendInvoiceResponse, invoiceUrl, smsMessage, taskCopy, error_1, oystehr_1, taskCopy, error_2, ENVIRONMENT;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 14, , 16]);
                validatedParams = (0, validateRequestParameters_1.validateRequestParameters)(input);
                secrets = validatedParams.secrets, encounterId = validatedParams.encounterId, prefilledInfo = validatedParams.prefilledInfo, task = validatedParams.task;
                amountCents = prefilledInfo.amountCents, dueDate = prefilledInfo.dueDate, memo = prefilledInfo.memo, smsTextMessage = prefilledInfo.smsTextMessage;
                console.log('Input task id: ', task.id);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _d.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                stripe = (0, shared_1.getStripeClient)(secrets);
                _d.label = 2;
            case 2:
                _d.trys.push([2, 11, , 13]);
                console.log('Fetching fhir resources');
                return [4 /*yield*/, getFhirResources(oystehr, encounterId)];
            case 3:
                fhirResources = _d.sent();
                if (!fhirResources)
                    throw new Error('Failed to fetch all needed FHIR resources');
                patient = fhirResources.patient, encounter = fhirResources.encounter, account = fhirResources.account;
                console.log('Fhir resources fetched');
                return [4 /*yield*/, (0, utils_1.getStripeAccountForAppointmentOrEncounter)({ encounterId: encounterId }, oystehr)];
            case 4:
                stripeAccount = _d.sent();
                console.log('Getting stripe and candid ids');
                stripeCustomerId = (0, utils_1.getStripeCustomerIdFromAccount)(account, stripeAccount);
                if (!stripeCustomerId)
                    throw new Error('StripeCustomerId is not found');
                candidEncounterId = (0, shared_1.getCandidEncounterIdFromEncounter)(encounter);
                if (!candidEncounterId)
                    throw new Error('CandidEncounterId is not found');
                console.log('Stripe and candid ids retrieved');
                console.log('Creating invoice and invoice item');
                patientId = (0, utils_1.removePrefix)('Patient/', (_b = (_a = encounter.subject) === null || _a === void 0 ? void 0 : _a.reference) !== null && _b !== void 0 ? _b : '');
                if (!patientId)
                    throw new Error("Encounter doesn't have patient reference");
                filledMemo = memo ? fillMessagePlaceholders(memo, amountCents, dueDate) : undefined;
                return [4 /*yield*/, createInvoice(stripe, stripeCustomerId, {
                        oystEncounterId: encounterId,
                        oystPatientId: patientId,
                        dueDate: dueDate,
                        filledMemo: filledMemo,
                    })];
            case 5:
                invoiceResponse = _d.sent();
                return [4 /*yield*/, createInvoiceItem(stripe, stripeCustomerId, invoiceResponse, amountCents, filledMemo)];
            case 6:
                _d.sent();
                console.log('Invoice and invoice item created');
                console.log('Finalizing invoice');
                return [4 /*yield*/, stripe.invoices.finalizeInvoice(invoiceResponse.id)];
            case 7:
                finalized = _d.sent();
                if (!finalized || finalized.status !== 'open')
                    throw new Error("Failed to finalize invoice, response status: ".concat(finalized.status));
                console.log('Invoice finalized: ', finalized.status);
                console.log("Sending invoice to recipient email recorded in stripe: ".concat(finalized.customer_email));
                return [4 /*yield*/, stripe.invoices.sendInvoice(invoiceResponse.id)];
            case 8:
                sendInvoiceResponse = _d.sent();
                console.log('Invoice sent: ', sendInvoiceResponse.status);
                console.log('Filling in invoice sms messages placeholders');
                invoiceUrl = (_c = sendInvoiceResponse.hosted_invoice_url) !== null && _c !== void 0 ? _c : '??';
                smsMessage = fillMessagePlaceholders(smsTextMessage, amountCents, dueDate, invoiceUrl);
                console.log('Sending sms to patient');
                return [4 /*yield*/, sendInvoiceSmsToPatient(oystehr, smsMessage, patient, secrets)];
            case 9:
                _d.sent();
                console.log('Sms sent to patient');
                console.log('Setting task status to completed');
                taskCopy = addInvoiceIdToTaskOutput(task, invoiceResponse.id);
                return [4 /*yield*/, updateTaskStatusAndOutput(oystehr, task, 'completed', taskCopy.output)];
            case 10:
                _d.sent();
                console.log('Task status and output updated');
                return [3 /*break*/, 13];
            case 11:
                error_1 = _d.sent();
                oystehr_1 = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                console.log('updating task status to failed and output');
                taskCopy = addErrorToTaskOutput(task, error_1 instanceof Error ? error_1.message : 'Unknown error');
                return [4 /*yield*/, updateTaskStatusAndOutput(oystehr_1, task, 'failed', taskCopy.output)];
            case 12:
                _d.sent();
                throw error_1;
            case 13: return [2 /*return*/, {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'Invoice created and sent successfully' }),
                }];
            case 14:
                error_2 = _d.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                console.log('Error occurred:', error_2);
                return [4 /*yield*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_2, ENVIRONMENT)];
            case 15: return [2 /*return*/, _d.sent()];
            case 16: return [2 /*return*/];
        }
    });
}); });
function createInvoiceItem(stripe, stripeCustomerId, invoice, amount, filledMemo) {
    return __awaiter(this, void 0, void 0, function () {
        var invoiceItemParams, invoiceItemResponse, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    invoiceItemParams = {
                        customer: stripeCustomerId,
                        amount: amount, // cents
                        currency: 'usd',
                        description: filledMemo,
                        invoice: invoice.id, // force add current invoiceItem to previously created invoice
                    };
                    return [4 /*yield*/, stripe.invoiceItems.create(invoiceItemParams)];
                case 1:
                    invoiceItemResponse = _a.sent();
                    if (!invoiceItemResponse || !invoiceItemResponse.id)
                        throw new Error('Failed to create invoiceItem');
                    return [2 /*return*/, invoiceItemResponse];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error creating invoice item:', error_3);
                    throw error_3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createInvoice(stripe, stripeCustomerId, params) {
    return __awaiter(this, void 0, void 0, function () {
        var oystEncounterId, oystPatientId, filledMemo, dueDate, invoiceParams, invoiceResponse, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    oystEncounterId = params.oystEncounterId, oystPatientId = params.oystPatientId, filledMemo = params.filledMemo, dueDate = params.dueDate;
                    invoiceParams = {
                        customer: stripeCustomerId,
                        collection_method: 'send_invoice',
                        description: filledMemo,
                        metadata: {
                            oystehr_patient_id: oystPatientId,
                            oystehr_encounter_id: oystEncounterId,
                        },
                        currency: 'USD',
                        due_date: luxon_1.DateTime.fromISO(dueDate).toUnixInteger(),
                        pending_invoice_items_behavior: 'exclude', // Start with a blank invoice
                        auto_advance: false, // Ensure it stays a draft
                    };
                    return [4 /*yield*/, stripe.invoices.create(invoiceParams)];
                case 1:
                    invoiceResponse = _a.sent();
                    if (!invoiceResponse || !invoiceResponse.id)
                        throw new Error('Failed to create invoice');
                    return [2 /*return*/, invoiceResponse];
                case 2:
                    error_4 = _a.sent();
                    console.error('Error creating invoice:', error_4);
                    throw error_4;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getFhirResources(oystehr, encounterId) {
    return __awaiter(this, void 0, void 0, function () {
        var response, encounter, patientId, patient, accounts, account;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: '_id',
                                value: encounterId,
                            },
                            {
                                name: '_include',
                                value: 'Encounter:patient',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Account:patient',
                            },
                        ],
                    })];
                case 1:
                    response = (_c.sent()).unbundle();
                    encounter = response.find(function (resource) { return resource.resourceType === 'Encounter'; });
                    patientId = (0, utils_1.removePrefix)('Patient/', (_b = (_a = encounter.subject) === null || _a === void 0 ? void 0 : _a.reference) !== null && _b !== void 0 ? _b : '');
                    if (!patientId) {
                        console.error("Encounter doesn't have patient reference");
                        return [2 /*return*/, undefined];
                    }
                    patient = response.find(function (resource) { return resource.resourceType === 'Patient' && resource.id === patientId; });
                    accounts = response.filter(function (resource) { var _a; return resource.resourceType === 'Account' && ((_a = (0, utils_1.getPatientReferenceFromAccount)(resource)) === null || _a === void 0 ? void 0 : _a.includes(patientId)); });
                    account = accounts.find(function (account) { return (0, harvest_1.accountMatchesType)(account, utils_1.PATIENT_BILLING_ACCOUNT_TYPE); });
                    console.log('Fhir encounter found: ', encounter.id);
                    console.log('Fhir patient found: ', patient.id);
                    console.log('Fhir account found', account === null || account === void 0 ? void 0 : account.id);
                    if (!encounter || !patient || !account)
                        return [2 /*return*/, undefined];
                    return [2 /*return*/, {
                            encounter: encounter,
                            patient: patient,
                            account: account,
                        }];
            }
        });
    });
}
function updateTaskStatusAndOutput(oystehr, task, status, newOutput) {
    return __awaiter(this, void 0, void 0, function () {
        var patchOperations;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patchOperations = [
                        {
                            op: 'replace',
                            path: '/status',
                            value: status,
                        },
                    ];
                    if (newOutput) {
                        patchOperations.push({
                            op: task.output ? 'replace' : 'add',
                            path: '/output',
                            value: newOutput,
                        });
                    }
                    return [4 /*yield*/, oystehr.fhir.patch({
                            resourceType: 'Task',
                            id: task.id,
                            operations: patchOperations,
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function addInvoiceIdToTaskOutput(task, invoiceId) {
    var _a;
    var taskCopy = __assign({}, task);
    if (!taskCopy.output)
        taskCopy.output = [];
    var invoiceIdCoding = utils_1.RcmTaskCodings.sendInvoiceOutputInvoiceId;
    var existingInvoiceId = taskCopy.output.find(function (output) { return output.valueString === invoiceId; });
    if (existingInvoiceId) {
        return taskCopy;
    }
    else {
        var newInvoiceId = {
            type: invoiceIdCoding,
            valueString: invoiceId,
        };
        (_a = taskCopy.output) === null || _a === void 0 ? void 0 : _a.push(newInvoiceId);
        return taskCopy;
    }
}
function addErrorToTaskOutput(task, error) {
    var _a;
    var taskCopy = __assign({}, task);
    if (!taskCopy.output)
        taskCopy.output = [];
    var taskError = utils_1.RcmTaskCodings.sendInvoiceOutputError;
    (_a = taskCopy.output) === null || _a === void 0 ? void 0 : _a.push({
        type: taskError,
        valueString: error,
    });
    return taskCopy;
}
function sendInvoiceSmsToPatient(oystehr, smsTextMessage, patient, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        var ENVIRONMENT;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
                    console.log('Sending sms to patient: ', smsTextMessage);
                    return [4 /*yield*/, (0, shared_1.sendSmsForPatient)(smsTextMessage, oystehr, patient, ENVIRONMENT)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function fillMessagePlaceholders(message, amountCents, dueDate, invoiceLink) {
    var clinic = utils_1.BRANDING_CONFIG.projectName;
    var params = {
        clinic: clinic,
        amount: (amountCents / 100).toString(),
        'due-date': dueDate,
        'invoice-link': invoiceLink,
    };
    return (0, utils_1.replaceTemplateVariablesArrows)(message, params);
}
