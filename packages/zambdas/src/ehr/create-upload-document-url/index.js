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
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var presigned_file_urls_1 = require("../../shared/presigned-file-urls");
var z3Utils_1 = require("../../shared/z3Utils");
var validateRequestParameters_1 = require("./validateRequestParameters");
var logIt = function (msg) {
    console.log("[create-upload-document-url]: ".concat(msg));
};
var UNIVERSAL_DEVICE_IDENTIFIER_CODE = 'UDI';
var ZAMBDA_NAME = 'create-upload-document';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedInput, secrets, patientId, fileFolderId, fileName, oystehr, listAndPatientResource, documentsFolder, folderId, folderName, fileZ3Url, presignedFileUploadUrl, docRefReq, results, docRef, documentRefId, updatedFolderEntries, operations, listPatchResult, response, error_1, ENVIRONMENT;
    var _a, _b, _c, _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                logIt("handler() start.");
                _h.label = 1;
            case 1:
                _h.trys.push([1, 7, 8, 9]);
                validatedInput = (0, validateRequestParameters_1.validateRequestParameters)(input);
                secrets = validatedInput.secrets, patientId = validatedInput.patientId, fileFolderId = validatedInput.fileFolderId, fileName = validatedInput.fileName;
                logIt("validatedInput => ");
                logIt(JSON.stringify(validatedInput));
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _h.sent();
                logIt("Got m2mToken");
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                logIt('fetching list .......');
                return [4 /*yield*/, getListAndPatientResource(fileFolderId, oystehr)];
            case 3:
                listAndPatientResource = _h.sent();
                logIt('Got list resource');
                documentsFolder = listAndPatientResource.list;
                if (!documentsFolder) {
                    return [2 /*return*/, {
                            statusCode: 500,
                            body: JSON.stringify({ error: "Can't fetch List resource with id=".concat(fileFolderId) }),
                        }];
                }
                folderId = (_a = documentsFolder.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) {
                    var _a, _b, _c;
                    return ((_c = (_b = (_a = id.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.at(0)) === null || _c === void 0 ? void 0 : _c.code) === UNIVERSAL_DEVICE_IDENTIFIER_CODE && id.value;
                });
                folderName = folderId === null || folderId === void 0 ? void 0 : folderId.value;
                if (!folderName) {
                    return [2 /*return*/, {
                            statusCode: 500,
                            body: JSON.stringify({
                                error: "Found List resource with id=".concat(fileFolderId, " but it does not have Folder identifier"),
                            }),
                        }];
                }
                logIt("Folder name => [".concat(folderName, "]"));
                fileZ3Url = (0, presigned_file_urls_1.makeZ3Url)({ secrets: secrets, patientID: patientId, bucketName: folderName, fileName: fileName });
                return [4 /*yield*/, (0, z3Utils_1.createPresignedUrl)(m2mToken, fileZ3Url, 'upload')];
            case 4:
                presignedFileUploadUrl = _h.sent();
                logIt("created fileZ3Url: [".concat(fileZ3Url, "] :: presignedFileUploadUrl: [").concat(presignedFileUploadUrl, "]"));
                docRefReq = createDocumentReferenceRequest({
                    patientId: patientId,
                    folder: documentsFolder,
                    documentReferenceData: {
                        attachmentInfo: {
                            fileUrl: fileZ3Url,
                            fileTitle: fileName,
                        },
                    },
                });
                logIt("making DocumentReference ...");
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: [docRefReq],
                    })];
            case 5:
                results = _h.sent();
                logIt("making DocumentReference results => ");
                logIt(JSON.stringify(results));
                docRef = (_c = (_b = results.entry) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.resource;
                if (!docRef || (docRef === null || docRef === void 0 ? void 0 : docRef.resourceType) !== 'DocumentReference') {
                    return [2 /*return*/, {
                            statusCode: 500,
                            body: JSON.stringify({
                                error: "Can't create a DocumentReference resource for the file ".concat(fileName),
                            }),
                        }];
                }
                documentRefId = docRef.id;
                logIt("created DocumentReference id = [".concat(documentRefId, "]"));
                if (!documentRefId) {
                    return [2 /*return*/, {
                            statusCode: 500,
                            body: JSON.stringify({
                                error: "Can't create a DocumentReference resource for the file ".concat(fileName, " - empty documentRefId"),
                            }),
                        }];
                }
                updatedFolderEntries = __spreadArray([], ((_d = documentsFolder.entry) !== null && _d !== void 0 ? _d : []), true);
                updatedFolderEntries.push({
                    date: (_e = luxon_1.DateTime.now().setZone('UTC').toISO()) !== null && _e !== void 0 ? _e : '',
                    item: {
                        type: 'DocumentReference',
                        reference: "DocumentReference/".concat(documentRefId),
                    },
                });
                operations = [];
                operations.push(documentsFolder.entry && ((_f = documentsFolder.entry) === null || _f === void 0 ? void 0 : _f.length) > 0
                    ? (0, utils_1.replaceOperation)('/entry', updatedFolderEntries)
                    : (0, utils_1.addOperation)('/entry', updatedFolderEntries));
                logIt("patching documents folder List ...");
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'List',
                        id: (_g = documentsFolder.id) !== null && _g !== void 0 ? _g : '',
                        operations: operations,
                    })];
            case 6:
                listPatchResult = _h.sent();
                logIt("patch results => ");
                logIt(JSON.stringify(listPatchResult));
                response = {
                    z3Url: fileZ3Url,
                    presignedUploadUrl: presignedFileUploadUrl,
                    documentRefId: documentRefId,
                    folderId: fileFolderId,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 7:
                error_1 = _h.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('create-upload-document-url', error_1, ENVIRONMENT)];
            case 8:
                logIt("handler() end");
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
function getListAndPatientResource(listId, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var resources, lists, listItem, patients, patientItem;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'List',
                        params: [
                            {
                                name: '_id',
                                value: listId,
                            },
                            {
                                name: '_include',
                                value: 'List:subject',
                            },
                        ],
                    })];
                case 1:
                    resources = (_a.sent()).unbundle();
                    lists = resources.filter(function (resource) { return resource.resourceType === 'List'; });
                    listItem = lists === null || lists === void 0 ? void 0 : lists.at(0);
                    patients = resources.filter(function (resource) { return resource.resourceType === 'Patient'; });
                    patientItem = patients === null || patients === void 0 ? void 0 : patients.at(0);
                    return [2 /*return*/, {
                            list: listItem,
                            patient: patientItem,
                        }];
            }
        });
    });
}
function createDocumentReferenceRequest(input) {
    var _a;
    logIt('createDocumentReference()');
    var patientId = input.patientId, folder = input.folder, documentReferenceData = input.documentReferenceData;
    var attachmentInfo = documentReferenceData.attachmentInfo;
    var attachmentData = {
        url: attachmentInfo.fileUrl,
        contentType: attachmentInfo.fileMimeType,
        title: attachmentInfo.fileTitle,
    };
    var writeDRFullUrl = (0, crypto_1.randomUUID)();
    logIt("writeDRFullUrl=".concat(writeDRFullUrl));
    var references = {
        subject: {
            reference: "Patient/".concat(patientId),
        },
    };
    //   if (taskContext && writeDRFullUrl) {
    var writeDocRefReq = {
        method: 'POST',
        fullUrl: writeDRFullUrl,
        url: '/DocumentReference',
        resource: __assign({ resourceType: 'DocumentReference', meta: {
                tag: [{ code: utils_1.OTTEHR_MODULE.TM }],
            }, date: (_a = luxon_1.DateTime.now().setZone('UTC').toISO()) !== null && _a !== void 0 ? _a : '', status: 'current', type: resolveDocumentReferenceType({ folder: folder }), content: [{ attachment: __assign({}, attachmentData) }] }, references),
    };
    return writeDocRefReq;
}
//TODO:
var resolveDocumentReferenceType = function (_a) {
    var folder = _a.folder;
    console.log(folder);
    return;
};
