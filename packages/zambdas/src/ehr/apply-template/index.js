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
var uuid_1 = require("uuid");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var templates_1 = require("../../shared/templates");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('apply-template', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedInput, secrets, oystehr, _a, templateList, encounter, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                validatedInput = (0, validateRequestParameters_1.validateRequestParameters)(input);
                secrets = validatedInput.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, complexValidation(validatedInput, oystehr)];
            case 2:
                _a = _b.sent(), templateList = _a.templateList, encounter = _a.encounter;
                return [4 /*yield*/, performEffect(validatedInput, templateList, encounter, oystehr)];
            case 3:
                _b.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({}),
                    }];
            case 4:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('apply-template', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var complexValidation = function (validatedInput, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var templateName, encounterId, lists, globalTemplatesList, templateLists, encounter;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                templateName = validatedInput.templateName, encounterId = validatedInput.encounterId;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'List',
                        params: [
                            { name: 'title', value: templateName },
                            { name: '_revinclude', value: 'List:item' },
                        ],
                    })];
            case 1:
                lists = (_a.sent()).unbundle();
                globalTemplatesList = lists.filter(function (list) { var _a, _b; return (_b = (_a = list.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.some(function (tag) { return tag.system === templates_1.GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM; }); });
                if (!globalTemplatesList) {
                    // By searching on the template name, and not finding the global templates List on revinclude
                    // We demonstrated that even if there is a List with that title, it's not a global template.
                    throw new Error("No global template found with title: ".concat(templateName));
                }
                templateLists = lists.filter(function (list) { return list.title === templateName; });
                if (templateLists.length === 0) {
                    throw new Error("No template found with title: ".concat(templateName));
                }
                if (templateLists.length > 1) {
                    throw new Error("Multiple templates found with the same title: ".concat(templateName));
                }
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Encounter',
                        id: encounterId,
                    })];
            case 2:
                encounter = _a.sent();
                return [2 /*return*/, { templateList: templateLists[0], encounter: encounter }];
        }
    });
}); };
var performEffect = function (validatedInput, templateList, encounter, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var encounterId, encounterBundle, deleteRequests, deleteBatches, createRequests, miniTransactionRequests, observationRequests, createObservationBatches, miniTransactionPromise, bundles;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                encounterId = validatedInput.encounterId;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            { name: '_id', value: encounterId },
                            { name: '_revinclude:iterate', value: 'Observation:encounter' },
                            { name: '_revinclude:iterate', value: 'ClinicalImpression:encounter' },
                            { name: '_revinclude:iterate', value: 'Communication:encounter' },
                            { name: '_revinclude:iterate', value: 'Condition:encounter' },
                        ],
                    })];
            case 1:
                encounterBundle = (_a.sent()).unbundle();
                return [4 /*yield*/, makeDeleteRequests(encounterBundle)];
            case 2:
                deleteRequests = _a.sent();
                deleteBatches = (0, utils_1.chunkThings)(deleteRequests, 5).map(function (chunk) {
                    return oystehr.fhir.batch({
                        requests: chunk,
                    });
                });
                createRequests = makeCreateRequests(encounter, templateList, encounterBundle);
                miniTransactionRequests = createRequests.filter(function (request) {
                    if (request.method === 'POST') {
                        return (request.resource.resourceType === 'ClinicalImpression' ||
                            request.resource.resourceType === 'Condition' ||
                            request.resource.resourceType === 'Communication');
                    }
                    else if (request.method === 'PATCH') {
                        return true;
                    }
                    return false;
                });
                observationRequests = createRequests.filter(function (request) { return request.method === 'POST' && request.resource.resourceType === 'Observation'; });
                createObservationBatches = (0, utils_1.chunkThings)(observationRequests, 5).map(function (chunk) {
                    return oystehr.fhir.batch({
                        requests: chunk,
                    });
                });
                miniTransactionPromise = oystehr.fhir.transaction({
                    requests: miniTransactionRequests,
                });
                return [4 /*yield*/, Promise.all(__spreadArray(__spreadArray(__spreadArray([], deleteBatches, true), createObservationBatches, true), [miniTransactionPromise], false))];
            case 3:
                bundles = _a.sent();
                console.log('Outcome bundles, ', JSON.stringify(bundles));
                return [2 /*return*/];
        }
    });
}); };
var makeDeleteRequests = function (encounterBundle) { return __awaiter(void 0, void 0, void 0, function () {
    var deleteResourcesRequests, resourcesToDelete;
    return __generator(this, function (_a) {
        deleteResourcesRequests = [];
        resourcesToDelete = encounterBundle.filter(function (resource) {
            var _a, _b;
            return (_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.some(function (tag) {
                return tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/exam-observation-field' ||
                    tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/medical-decision' ||
                    tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/patient-instruction';
            }
            // tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/chief-complaint'
            );
        });
        deleteResourcesRequests.push.apply(deleteResourcesRequests, resourcesToDelete.map(function (resource) { return makeDeleteResourceRequest(resource.resourceType, resource.id); }) // we just fetched these so they definitely have id
        );
        return [2 /*return*/, deleteResourcesRequests];
    });
}); };
var makeDeleteResourceRequest = function (resourceType, id) { return ({
    method: 'DELETE',
    url: "".concat(resourceType, "/").concat(id),
}); };
var makeCreateRequests = function (encounter, templateList, encounterBundle) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    var createResourcesRequests = [];
    if (templateList.entry === undefined || templateList.entry.length === 0) {
        console.log('Template has no entries, it will not create anything.');
        return createResourcesRequests;
    }
    var encounterDiagnoses = (_a = encounter.diagnosis) !== null && _a !== void 0 ? _a : [];
    // If there's a 'rank' on the diagnosis, remove it. We use rank: 1 to indicate the 'primary diagnosis'.
    encounterDiagnoses.forEach(function (d) {
        if (d.rank) {
            delete d.rank;
        }
    });
    // We will patch the HPI to append content if it already exists.
    var existingHpiCondition = encounterBundle.find(function (resource) {
        var _a, _b;
        return (_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.some(function (tag) { return tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/chief-complaint'; });
    });
    var templateEncounterDiagnoses = (_c = (_b = templateList.contained) === null || _b === void 0 ? void 0 : _b.find(function (r) { return r.resourceType === 'Encounter'; })) === null || _c === void 0 ? void 0 : _c.diagnosis;
    var templateHpiCondition;
    var _loop_1 = function (resource) {
        // grab contained resource from resource.id in entry
        var containedResource = (_d = templateList.contained) === null || _d === void 0 ? void 0 : _d.find(function (r) { var _a; return r.id === ((_a = resource.item.reference) === null || _a === void 0 ? void 0 : _a.replace('#', '')); });
        if (!containedResource) {
            console.error('no contained resource found');
            return "continue";
        }
        // For Chief Complaint, if there is an existing HPI Condition, instead of creating, we will patch so skip.
        if (((_f = (_e = containedResource.meta) === null || _e === void 0 ? void 0 : _e.tag) === null || _f === void 0 ? void 0 : _f.some(function (tag) { return tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/chief-complaint'; })) &&
            existingHpiCondition) {
            templateHpiCondition = containedResource;
            return "continue";
        }
        var resourceToCreate = __assign({}, containedResource);
        var fullUrl = "urn:uuid:".concat((0, uuid_1.v4)());
        delete resourceToCreate.id;
        (_g = resourceToCreate.meta) === null || _g === void 0 ? true : delete _g.versionId;
        (_h = resourceToCreate.meta) === null || _h === void 0 ? true : delete _h.lastUpdated;
        if (resourceToCreate.resourceType === 'Observation' ||
            resourceToCreate.resourceType === 'ClinicalImpression' ||
            resourceToCreate.resourceType === 'Condition' ||
            resourceToCreate.resourceType === 'Communication') {
            resourceToCreate.subject = encounter.subject;
            resourceToCreate.encounter = { reference: "Encounter/".concat(encounter.id) };
        }
        else {
            return "continue";
        }
        // For Condition resources that are ICD-10 codes, we need to update the Encounter.diagnosis references
        if (resourceToCreate.resourceType === 'Condition' &&
            ((_k = (_j = resourceToCreate.code) === null || _j === void 0 ? void 0 : _j.coding) === null || _k === void 0 ? void 0 : _k.find(function (c) { return c.system === 'http://hl7.org/fhir/sid/icd-10'; }))) {
            var diagnosisToAdd = templateEncounterDiagnoses === null || templateEncounterDiagnoses === void 0 ? void 0 : templateEncounterDiagnoses.find(function (d) {
                var _a;
                return ((_a = d.condition.reference) === null || _a === void 0 ? void 0 : _a.split('/')[1]) === containedResource.id;
            });
            encounterDiagnoses.push(__assign(__assign({}, diagnosisToAdd), { condition: { reference: fullUrl } }));
        }
        createResourcesRequests.push({
            method: 'POST',
            url: "".concat(resourceToCreate.resourceType),
            resource: resourceToCreate,
            fullUrl: fullUrl,
        });
    };
    for (var _i = 0, _q = templateList.entry; _i < _q.length; _i++) {
        var resource = _q[_i];
        _loop_1(resource);
    }
    // Patch the encounter.diagnoses with our new diagnosis references.
    if (encounterDiagnoses.length > 0) {
        var encounterDiagnosisPatch = {
            method: 'PATCH',
            url: "Encounter/".concat(encounter.id),
            operations: [
                {
                    op: encounter.diagnosis ? 'replace' : 'add',
                    path: '/diagnosis',
                    value: encounterDiagnoses,
                },
            ],
        };
        createResourcesRequests.push(encounterDiagnosisPatch);
    }
    // Patch HPI Condition note if it already exists
    if (existingHpiCondition) {
        var condition = existingHpiCondition;
        var encounterDiagnosisPatch = {
            method: 'PATCH',
            url: "Condition/".concat(condition.id),
            operations: [
                {
                    op: 'replace',
                    path: '/note/0/text',
                    value: "".concat((_m = (_l = condition.note) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.text, "\n\n").concat((_p = (_o = templateHpiCondition === null || templateHpiCondition === void 0 ? void 0 : templateHpiCondition.note) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.text),
                },
            ],
        };
        createResourcesRequests.push(encounterDiagnosisPatch);
    }
    return createResourcesRequests;
};
