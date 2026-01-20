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
var aws_serverless_1 = require("@sentry/aws-serverless");
var candidhealth_1 = require("candidhealth");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var invoices_tasks_1 = require("utils/lib/helpers/tasks/invoices-tasks");
var shared_1 = require("../../shared");
var m2mToken;
var ZAMBDA_NAME = 'sub-create-invoices-tasks';
var pendingTaskStatus = 'ready';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, oystehr_1, candid, twoWeeksAgo, candidClaims, twoDaysAgo_1, claimsForThePastTwoDays, _a, pendingPackagesToUpdate, packagesToCreate, promises_1, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 5, , 7]);
                secrets = input.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr_1 = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                candid = (0, utils_1.createCandidApiClient)(secrets);
                twoWeeksAgo = luxon_1.DateTime.now().minus({ weeks: 2 });
                return [4 /*yield*/, getAllCandidClaims(candid, twoWeeksAgo)];
            case 2:
                candidClaims = _b.sent();
                twoDaysAgo_1 = luxon_1.DateTime.now().minus({ days: 2 });
                console.log('getting candid claims for the past two weeks');
                claimsForThePastTwoDays = candidClaims.filter(function (claim) { return luxon_1.DateTime.fromJSDate(claim.timestamp) >= twoDaysAgo_1; });
                console.log('getting pending and to create packages');
                return [4 /*yield*/, Promise.all([
                        getEncountersWithPendingTasksFhir(oystehr_1, candid, candidClaims),
                        getEncountersWithoutTaskFhir(oystehr_1, candid, claimsForThePastTwoDays),
                    ])];
            case 3:
                _a = _b.sent(), pendingPackagesToUpdate = _a[0], packagesToCreate = _a[1];
                console.log('encounters without a task: ', packagesToCreate.length);
                console.log('encounters with pending task: ', pendingPackagesToUpdate.length);
                promises_1 = [];
                packagesToCreate.forEach(function (encounter) {
                    promises_1.push(createTaskForEncounter(oystehr_1, encounter));
                });
                pendingPackagesToUpdate.forEach(function (encounter) {
                    promises_1.push(updateTaskForEncounter(oystehr_1, encounter));
                });
                return [4 /*yield*/, Promise.all(promises_1)];
            case 4:
                _b.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({ message: 'Successfully created tasks for encounters' }),
                    }];
            case 5:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                console.log('Error occurred:', error_1);
                return [4 /*yield*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 6: return [2 /*return*/, _b.sent()];
            case 7: return [2 /*return*/];
        }
    });
}); });
function getPrefilledInvoiceInfo(patientBalanceInCents) {
    return __awaiter(this, void 0, void 0, function () {
        var smsMessageFromSecret, memoFromSecret, dueDateFromSecret, dueDate;
        return __generator(this, function (_a) {
            try {
                smsMessageFromSecret = utils_1.textingConfig.invoicing.smsMessage;
                memoFromSecret = utils_1.textingConfig.invoicing.stripeMemoMessage;
                dueDateFromSecret = utils_1.textingConfig.invoicing.dueDateInDays;
                dueDate = luxon_1.DateTime.now().plus({ days: dueDateFromSecret }).toISODate();
                return [2 /*return*/, {
                        smsTextMessage: smsMessageFromSecret,
                        memo: memoFromSecret,
                        dueDate: dueDate,
                        amountCents: patientBalanceInCents,
                    }];
            }
            catch (error) {
                console.error('Error fetching prefilled invoice info: ', error);
                throw new Error('Error fetching prefilled invoice info: ' + error);
            }
            return [2 /*return*/];
        });
    });
}
function createTaskForEncounter(oystehr, encounterPkg) {
    return __awaiter(this, void 0, void 0, function () {
        var encounter, claim, amountCents, patientId, prefilledInvoiceInfo, task, created, error_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    encounter = encounterPkg.encounter, claim = encounterPkg.claim, amountCents = encounterPkg.amountCents;
                    patientId = (_b = (_a = encounter.subject) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Patient/', '');
                    if (!patientId)
                        throw new Error('Patient ID not found in encounter: ' + encounter.id);
                    return [4 /*yield*/, getPrefilledInvoiceInfo(amountCents)];
                case 1:
                    prefilledInvoiceInfo = _c.sent();
                    console.log("Creating task. patient: ".concat(claim.patientExternalId, ", claim: ").concat(claim.claimId, ", oyst encounter: ").concat(encounter.id, " balance (cents): ").concat(amountCents));
                    task = {
                        resourceType: 'Task',
                        status: pendingTaskStatus,
                        intent: 'order',
                        code: utils_1.RcmTaskCodings.sendInvoiceToPatient,
                        encounter: (0, utils_1.createReference)(encounter),
                        authoredOn: luxon_1.DateTime.now().toISO(),
                        input: (0, invoices_tasks_1.createInvoiceTaskInput)(prefilledInvoiceInfo),
                    };
                    return [4 /*yield*/, oystehr.fhir.create(task)];
                case 2:
                    created = _c.sent();
                    console.log('Created task: ', created.id);
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _c.sent();
                    (0, aws_serverless_1.captureException)(error_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function updateTaskForEncounter(oystehr, encounterPkg) {
    return __awaiter(this, void 0, void 0, function () {
        var encounter, claim, invoiceTask, amountCents, prefilledInvoiceInfo, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    encounter = encounterPkg.encounter, claim = encounterPkg.claim, invoiceTask = encounterPkg.invoiceTask, amountCents = encounterPkg.amountCents;
                    if (!(invoiceTask === null || invoiceTask === void 0 ? void 0 : invoiceTask.id)) {
                        console.error('Task cannot be updated for encounter: ', encounter.id);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, getPrefilledInvoiceInfo(amountCents)];
                case 1:
                    prefilledInvoiceInfo = _a.sent();
                    console.log("Updating task. patient: ".concat(claim.patientExternalId, ", claim: ").concat(claim.claimId, ", oyst encounter: ").concat(encounter.id, " balance (cents): ").concat(amountCents));
                    return [4 /*yield*/, oystehr.fhir.patch({
                            resourceType: 'Task',
                            id: invoiceTask.id,
                            operations: [{ op: 'replace', path: '/input', value: (0, invoices_tasks_1.createInvoiceTaskInput)(prefilledInvoiceInfo) }],
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    (0, aws_serverless_1.captureException)(error_3);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getEncountersWithPendingTasksFhir(oystehr, candid, claims) {
    return __awaiter(this, void 0, void 0, function () {
        var result, packages;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('fetching encounters with pending tasks');
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Task',
                            params: [
                                {
                                    name: 'status',
                                    value: pendingTaskStatus,
                                },
                                {
                                    name: 'code',
                                    value: "".concat(utils_1.RCM_TASK_SYSTEM, "|").concat(utils_1.RcmTaskCode.sendInvoiceToPatient),
                                },
                                {
                                    name: '_include',
                                    value: 'Task:encounter',
                                },
                                {
                                    name: '_count',
                                    value: '1000',
                                },
                            ],
                        })];
                case 1:
                    result = (_a.sent()).unbundle();
                    console.log('fetched fhir resources: ', result.length);
                    packages = [];
                    result
                        .filter(function (res) { return res.resourceType === 'Encounter'; })
                        .forEach(function (resource) {
                        var encounter = resource;
                        var candidEncounterId = (0, shared_1.getCandidEncounterIdFromEncounter)(encounter);
                        var claim = claims.find(function (el) { return el.encounterId === candidEncounterId; });
                        if (claim) {
                            var task = result.find(function (res) { var _a; return res.resourceType === 'Task' && ((_a = res.encounter) === null || _a === void 0 ? void 0 : _a.reference) === (0, utils_1.createReference)(encounter).reference; });
                            if (task) {
                                packages.push({
                                    encounter: encounter,
                                    invoiceTask: task,
                                    claim: claim,
                                });
                            }
                        }
                    });
                    return [4 /*yield*/, populateAmountInPackagesAndFilterZeroAmount(candid, packages)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function getEncountersWithoutTaskFhir(oystehr, candid, claims) {
    return __awaiter(this, void 0, void 0, function () {
        var promises, resourcesResponse, tasks, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    promises = [];
                    promises.push((0, utils_1.getResourcesFromBatchInlineRequests)(oystehr, claims.map(function (claim) {
                        return "Encounter?identifier=".concat(shared_1.CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, "|").concat(claim.encounterId, "&_revinclude=Task:encounter");
                    })));
                    return [4 /*yield*/, Promise.all(promises)];
                case 1:
                    resourcesResponse = (_a.sent()).flat();
                    tasks = resourcesResponse.filter(function (res) {
                        var _a, _b;
                        return res.resourceType === 'Task' &&
                            ((_b = (_a = res.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.system === utils_1.RCM_TASK_SYSTEM && coding.code === utils_1.RcmTaskCode.sendInvoiceToPatient; }));
                    });
                    result = [];
                    claims.forEach(function (claim) {
                        var encounter = resourcesResponse.find(function (res) {
                            return res.resourceType === 'Encounter' && claim.encounterId === (0, shared_1.getCandidEncounterIdFromEncounter)(res);
                        });
                        if (encounter === null || encounter === void 0 ? void 0 : encounter.id) {
                            var invoiceTask = tasks.find(function (task) { var _a; return ((_a = task.encounter) === null || _a === void 0 ? void 0 : _a.reference) === (0, utils_1.createReference)(encounter).reference; });
                            if (!invoiceTask) {
                                result.push({ encounter: encounter, claim: claim });
                            }
                        }
                    });
                    return [4 /*yield*/, populateAmountInPackagesAndFilterZeroAmount(candid, result)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function populateAmountInPackagesAndFilterZeroAmount(candid, packages) {
    return __awaiter(this, void 0, void 0, function () {
        var itemizationPromises, itemizationResponse, resultPackages;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    itemizationPromises = packages.map(function (pkg) { return candid.patientAr.v1.itemize(candidhealth_1.CandidApi.ClaimId(pkg.claim.claimId)); });
                    return [4 /*yield*/, Promise.all(itemizationPromises)];
                case 1:
                    itemizationResponse = _a.sent();
                    resultPackages = [];
                    itemizationResponse.forEach(function (res) {
                        if (res && res.ok && res.body) {
                            var itemization_1 = res.body;
                            var incomingPkg = packages.find(function (pkg) { return pkg.claim.claimId === itemization_1.claimId; });
                            if (itemization_1.claimId &&
                                itemization_1.patientBalanceCents &&
                                itemization_1.patientBalanceCents > 0 &&
                                incomingPkg) {
                                resultPackages.push(__assign(__assign({}, incomingPkg), { amountCents: itemization_1.patientBalanceCents }));
                            }
                        }
                    });
                    return [2 /*return*/, resultPackages];
            }
        });
    });
}
function getAllCandidClaims(candid, sinceDate) {
    return __awaiter(this, void 0, void 0, function () {
        var inventoryPages, claimsFetched;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, utils_1.getCandidInventoryPagesRecursive)({
                        candid: candid,
                        claims: [],
                        limitPerPage: 100,
                        pageCount: 0,
                        onlyInvoiceable: true,
                        since: sinceDate,
                    })];
                case 1:
                    inventoryPages = _a.sent();
                    claimsFetched = inventoryPages === null || inventoryPages === void 0 ? void 0 : inventoryPages.claims;
                    console.log('fetched claims: ', claimsFetched === null || claimsFetched === void 0 ? void 0 : claimsFetched.length);
                    if ((claimsFetched === null || claimsFetched === void 0 ? void 0 : claimsFetched.length) && claimsFetched.length > 0) {
                        return [2 /*return*/, claimsFetched];
                    }
                    return [2 /*return*/, []];
            }
        });
    });
}
