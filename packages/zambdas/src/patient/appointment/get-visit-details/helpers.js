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
exports.getDocumentType = getDocumentType;
exports.isDocumentPublished = isDocumentPublished;
exports.getMedications = getMedications;
exports.getPresignedURLs = getPresignedURLs;
var utils_1 = require("utils");
function makePresignedURLFromDocumentReference(resource, oystehrToken) {
    return __awaiter(this, void 0, void 0, function () {
        var documentBaseUrl, presignedUrl;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    documentBaseUrl = (_a = resource.content) === null || _a === void 0 ? void 0 : _a[0].attachment.url;
                    if (!documentBaseUrl)
                        throw new Error("Attached DocumentReference don't have attached base file URL");
                    return [4 /*yield*/, (0, utils_1.getPresignedURL)(documentBaseUrl, oystehrToken)];
                case 1:
                    presignedUrl = _b.sent();
                    return [2 /*return*/, presignedUrl];
            }
        });
    });
}
var PdfDocumentReferencePublishedStatuses = {
    published: 'final',
    unpublished: 'preliminary',
};
var loincCodeToDocumentTypeMap = {
    '34105-7': 'receipt',
    '75498-6': 'visit-note',
    '47420-5': 'school-work-note',
};
function getDocumentTypeFromLoincCode(code) {
    if (!code) {
        return null;
    }
    return loincCodeToDocumentTypeMap[code] || null;
}
function getDocumentType(resource) {
    if (resource.resourceType !== 'DocumentReference') {
        return null;
    }
    var typeInfo = resource.type || {};
    var codingList = typeInfo.coding || [];
    for (var _i = 0, codingList_1 = codingList; _i < codingList_1.length; _i++) {
        var coding = codingList_1[_i];
        if (coding.system === 'http://loinc.org') {
            return getDocumentTypeFromLoincCode(coding.code);
        }
    }
    return null;
}
function isDocumentPublished(documentReference) {
    return documentReference.docStatus === PdfDocumentReferencePublishedStatuses.published;
}
function getMedications(oystehr, encounterId) {
    return __awaiter(this, void 0, void 0, function () {
        var medicationRequestSearch, medications;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (encounterId === undefined) {
                        throw new Error('Encounter ID must be specified for payments.');
                    }
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'MedicationRequest',
                            params: [
                                {
                                    name: 'encounter',
                                    value: encounterId,
                                },
                            ],
                        })];
                case 1:
                    medicationRequestSearch = _b.sent();
                    medications = [];
                    (_a = medicationRequestSearch.entry) === null || _a === void 0 ? void 0 : _a.forEach(function (entry) {
                        var _a;
                        if (((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'MedicationRequest')
                            medications.push(makePrescribedMedicationDTO(entry.resource));
                    });
                    return [2 /*return*/, medications];
            }
        });
    });
}
function makePrescribedMedicationDTO(medRequest) {
    var _a, _b, _c, _d, _e;
    return {
        resourceId: medRequest.id,
        name: (_c = (_b = (_a = medRequest.medicationCodeableConcept) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.system === utils_1.MEDICATION_DISPENSABLE_DRUG_ID; })) === null || _c === void 0 ? void 0 : _c.display,
        instructions: (_e = (_d = medRequest.dosageInstruction) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.patientInstruction,
    };
}
function getPresignedURLs(oystehr, oystehrToken, encounterId) {
    return __awaiter(this, void 0, void 0, function () {
        var documentReferenceResources, presignedUrlObj, documentsByType, latestDocumentsByType;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (encounterId === undefined) {
                        throw new Error('Encounter ID must be specified for payments.');
                    }
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'DocumentReference',
                            params: [
                                {
                                    name: 'encounter',
                                    value: encounterId,
                                },
                            ],
                        })];
                case 1:
                    documentReferenceResources = (_a.sent()).unbundle();
                    presignedUrlObj = {};
                    documentsByType = {};
                    documentReferenceResources.forEach(function (resource) {
                        var type = getDocumentType(resource);
                        if (!type || type === 'school-work-note')
                            return;
                        if (!documentsByType[type]) {
                            documentsByType[type] = [];
                        }
                        documentsByType[type].push(resource);
                    });
                    latestDocumentsByType = {};
                    Object.entries(documentsByType).forEach(function (_a) {
                        var type = _a[0], documents = _a[1];
                        var latestDocument = documents.reduce(function (latest, current) {
                            var _a, _b;
                            var latestTime = ((_a = latest.meta) === null || _a === void 0 ? void 0 : _a.lastUpdated) ? new Date(latest.meta.lastUpdated).getTime() : 0;
                            var currentTime = ((_b = current.meta) === null || _b === void 0 ? void 0 : _b.lastUpdated) ? new Date(current.meta.lastUpdated).getTime() : 0;
                            return currentTime > latestTime ? current : latest;
                        });
                        latestDocumentsByType[type] = latestDocument;
                    });
                    // Generate presigned URLs for latest documents (excluding school-work-note)
                    return [4 /*yield*/, Promise.all(Object.entries(latestDocumentsByType).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var _c, _d;
                            var _e;
                            var type = _b[0], resource = _b[1];
                            return __generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0:
                                        _c = presignedUrlObj;
                                        _d = type;
                                        _e = {};
                                        return [4 /*yield*/, makePresignedURLFromDocumentReference(resource, oystehrToken)];
                                    case 1:
                                        _c[_d] = (_e.presignedUrl = _f.sent(),
                                            _e);
                                        return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 2:
                    // Generate presigned URLs for latest documents (excluding school-work-note)
                    _a.sent();
                    // Handle school-work-note documents separately (keep existing logic)
                    return [4 /*yield*/, Promise.all(documentReferenceResources.map(function (resource) { return __awaiter(_this, void 0, void 0, function () {
                            var type, noteType, _a, _b;
                            var _c;
                            var _d, _e, _f;
                            return __generator(this, function (_g) {
                                switch (_g.label) {
                                    case 0:
                                        type = getDocumentType(resource);
                                        if (type !== 'school-work-note')
                                            return [2 /*return*/, null];
                                        if (!isDocumentPublished(resource))
                                            return [2 /*return*/, undefined];
                                        noteType = (_f = (_e = (_d = resource.meta) === null || _d === void 0 ? void 0 : _d.tag) === null || _e === void 0 ? void 0 : _e.find(function (tag) { return tag.system === 'school-work-note/type'; })) === null || _f === void 0 ? void 0 : _f.code;
                                        if (!noteType)
                                            return [2 /*return*/, undefined];
                                        _a = presignedUrlObj;
                                        _b = noteType;
                                        _c = {};
                                        return [4 /*yield*/, makePresignedURLFromDocumentReference(resource, oystehrToken)];
                                    case 1:
                                        _a[_b] = (_c.presignedUrl = _g.sent(),
                                            _c);
                                        return [2 /*return*/, null];
                                }
                            });
                        }); }))];
                case 3:
                    // Handle school-work-note documents separately (keep existing logic)
                    _a.sent();
                    return [2 /*return*/, presignedUrlObj];
            }
        });
    });
}
