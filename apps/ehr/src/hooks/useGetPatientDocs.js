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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
exports.useGetPatientDocs = void 0;
var auth0_react_1 = require("@auth0/auth0-react");
var react_1 = require("react");
var react_query_1 = require("react-query");
var utils_1 = require("utils");
var files_helper_1 = require("../helpers/files.helper");
var useAppClients_1 = require("./useAppClients");
var PATIENT_FOLDERS_CODE = 'patient-docs-folder';
var CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID = import.meta.env
    .VITE_APP_CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID;
var QUERY_KEYS = {
    GET_PATIENT_DOCS_FOLDERS: 'get-patient-docs-folders',
    GET_SEARCH_PATIENT_DOCUMENTS: 'get-search-patient-documents',
};
var useGetPatientDocs = function (patientId, filters) {
    var _a = (0, react_1.useState)(), documents = _a[0], setDocuments = _a[1];
    var _b = (0, react_1.useState)([]), documentsFolders = _b[0], setDocumentsFolders = _b[1];
    var _c = (0, react_1.useState)(filters), currentFilters = _c[0], setCurrentFilters = _c[1];
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var isLoadingFolders = useGetPatientDocsFolders({ patientId: patientId }, function (docsFolders) {
        console.log("[useGetPatientDocs] Folders data loading SUCCESS size=[".concat(docsFolders.length, "]. Content => "));
        console.log(docsFolders);
        setDocumentsFolders(docsFolders);
    }).isLoading;
    var isLoadingDocuments = useSearchPatientDocuments({ patientId: patientId, filters: currentFilters }, function (docs) {
        console.log("[useGetPatientDocs] found Docs [".concat(docs.length, "] => "));
        console.log(docs);
        setDocuments(docs);
    }).isLoading;
    var documentActions = usePatientDocsActions({ patientId: patientId });
    var searchDocuments = (0, react_1.useCallback)(function (filters) {
        console.log("[useGetPatientDocs] searchDocuments, filters => ");
        console.log(filters);
        setCurrentFilters(filters);
    }, []);
    var getAccessTokenSilently = (0, auth0_react_1.useAuth0)().getAccessTokenSilently;
    var getDocumentById = (0, react_1.useCallback)(function (docId) {
        return documents === null || documents === void 0 ? void 0 : documents.find(function (doc) { return doc.id === docId; });
    }, [documents]);
    var downloadDocument = (0, react_1.useCallback)(function (documentId) { return __awaiter(void 0, void 0, void 0, function () {
        var authToken, patientDoc, docRef, docAttachments, urlSigningRequests, filesInfoToDownload, _loop_1, _i, filesInfoToDownload_1, fileToD;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getAccessTokenSilently()];
                case 1:
                    authToken = _b.sent();
                    patientDoc = getDocumentById(documentId);
                    if (!(!patientDoc && oystehr)) return [3 /*break*/, 3];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'DocumentReference',
                            params: [
                                {
                                    name: '_id',
                                    value: documentId,
                                },
                            ],
                        })];
                case 2:
                    docRef = (_b.sent()).unbundle()[0];
                    if (docRef) {
                        patientDoc = createDocumentInfo(docRef);
                        setDocuments(__spreadArray(__spreadArray([], (documents !== null && documents !== void 0 ? documents : []), true), [patientDoc], false));
                    }
                    _b.label = 3;
                case 3:
                    docAttachments = (_a = patientDoc === null || patientDoc === void 0 ? void 0 : patientDoc.attachments) !== null && _a !== void 0 ? _a : [];
                    if (docAttachments.length === 0) {
                        console.error("No attachments found for a docId=[".concat(documentId, "]"));
                        return [2 /*return*/];
                    }
                    urlSigningRequests = docAttachments.map(function (attachment) { return __awaiter(void 0, void 0, void 0, function () {
                        var presignedUrl;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, files_helper_1.getPresignedFileUrl)(attachment.z3Url, authToken)];
                                case 1:
                                    presignedUrl = _a.sent();
                                    return [2 /*return*/, {
                                            attachment: attachment,
                                            presignedUrl: presignedUrl,
                                        }];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(urlSigningRequests)];
                case 4:
                    filesInfoToDownload = (_b.sent())
                        .filter(function (signedAttach) { return !!signedAttach.presignedUrl; })
                        .map(function (signedAttach) {
                        var _a;
                        var fileTitle = signedAttach.attachment.title;
                        var fileExt = (_a = (0, files_helper_1.parseFileExtension)(signedAttach.attachment.fileNameFromUrl)) !== null && _a !== void 0 ? _a : 'unknown';
                        var fullFileName = fileTitle.includes('.') ? fileTitle : "".concat(fileTitle, ".").concat(fileExt);
                        return {
                            fileName: fullFileName,
                            urlToDownload: signedAttach.presignedUrl,
                        };
                    });
                    _loop_1 = function (fileToD) {
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0: return [4 /*yield*/, fetch(new URL(fileToD.urlToDownload), {
                                        method: 'GET',
                                        headers: { 'Cache-Control': 'no-cache' },
                                    })
                                        .then(function (response) {
                                        if (!response.ok) {
                                            throw new Error("failed to download Document attachment [".concat(fileToD.fileName, "]"));
                                        }
                                        return response.blob();
                                    })
                                        .then(function (blob) {
                                        var fileBlob = window.URL.createObjectURL(new Blob([blob]));
                                        var link = document.createElement('a');
                                        link.href = fileBlob;
                                        link.download = fileToD.fileName;
                                        link.style.display = 'none';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    })
                                        .catch(function (error) {
                                        console.log(error);
                                    })];
                                case 1:
                                    _c.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, filesInfoToDownload_1 = filesInfoToDownload;
                    _b.label = 5;
                case 5:
                    if (!(_i < filesInfoToDownload_1.length)) return [3 /*break*/, 8];
                    fileToD = filesInfoToDownload_1[_i];
                    return [5 /*yield**/, _loop_1(fileToD)];
                case 6:
                    _b.sent();
                    _b.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 5];
                case 8: return [2 /*return*/];
            }
        });
    }); }, [documents, getAccessTokenSilently, getDocumentById, oystehr]);
    return {
        isLoadingDocuments: isLoadingDocuments,
        documents: documents,
        // documentsByFolders: documentsByFolders,
        isLoadingFolders: isLoadingFolders,
        documentsFolders: documentsFolders,
        searchDocuments: searchDocuments,
        downloadDocument: downloadDocument,
        documentActions: documentActions,
    };
};
exports.useGetPatientDocs = useGetPatientDocs;
var useGetPatientDocsFolders = function (_a, onSuccess) {
    var patientId = _a.patientId;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)([QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS, { patientId: patientId }], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('useGetDocsFolders() oystehr client not defined');
                    }
                    if (!patientId) {
                        throw new Error('useGetDocsFolders() patientId not defined');
                    }
                    console.log("useGetPatientDocsFolders() query triggered");
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'List',
                            params: [
                                { name: 'subject', value: "Patient/".concat(patientId) },
                                { name: 'code', value: PATIENT_FOLDERS_CODE },
                            ],
                        })];
                case 1: return [2 /*return*/, (_a.sent()).unbundle()];
            }
        });
    }); }, {
        onSuccess: function (searchResultsResources) {
            var _a, _b;
            var listResources = (_b = (_a = searchResultsResources === null || searchResultsResources === void 0 ? void 0 : searchResultsResources.filter(function (resource) { return resource.resourceType === 'List' && resource.status === 'current'; })) === null || _a === void 0 ? void 0 : _a.map(function (listResource) { return listResource; })) !== null && _b !== void 0 ? _b : [];
            var patientFoldersResources = listResources.filter(function (listResource) { var _a, _b; return Boolean((_b = (_a = listResource.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (folderCoding) { return folderCoding.code === PATIENT_FOLDERS_CODE; })); });
            var docsFolders = patientFoldersResources.map(function (listRes) {
                var _a, _b, _c, _d;
                var folderName = (_c = (_b = (_a = listRes.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (folderCoding) { return folderCoding.code === PATIENT_FOLDERS_CODE; })) === null || _c === void 0 ? void 0 : _c.display;
                var docRefs = ((_d = listRes.entry) !== null && _d !== void 0 ? _d : []).map(function (entry) {
                    return ({
                        reference: entry.item,
                    });
                });
                return {
                    id: listRes.id,
                    folderName: folderName,
                    documentsCount: docRefs.length,
                    documentsRefs: docRefs,
                };
            });
            onSuccess(docsFolders);
        },
        onError: function (err) {
            console.error('useGetPatientDocsFolders() ERROR', err);
        },
    });
};
/**
 * [/DocumentReference?subject=Patient/104e4c8c-1866-4c96-a436-88080c691614&_has:List:item:_id=06654560-445a-4499-a5ec-48fae3495781]
 */
var useSearchPatientDocuments = function (_a, onSuccess) {
    var _b, _c;
    var patientId = _a.patientId, filters = _a.filters;
    var docCreationDate = (_b = filters === null || filters === void 0 ? void 0 : filters.dateAdded) === null || _b === void 0 ? void 0 : _b.toFormat('yyyy-MM-dd');
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)([
        QUERY_KEYS.GET_SEARCH_PATIENT_DOCUMENTS,
        {
            patientId: patientId,
            docSearchTerm: filters === null || filters === void 0 ? void 0 : filters.documentName,
            docCreationDate: docCreationDate,
            docFolderId: (_c = filters === null || filters === void 0 ? void 0 : filters.documentsFolder) === null || _c === void 0 ? void 0 : _c.id,
        },
    ], function () { return __awaiter(void 0, void 0, void 0, function () {
        var searchParams, docsFolder;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr)
                        throw new Error('useSearchPatientDocuments() oystehr not defined');
                    if (!patientId)
                        throw new Error('useSearchPatientDocuments() patientId not defined');
                    console.log("useSearchPatientDocuments() query triggered");
                    searchParams = [{ name: 'subject', value: "Patient/".concat(patientId) }];
                    docsFolder = filters === null || filters === void 0 ? void 0 : filters.documentsFolder;
                    if (docsFolder && docsFolder.id) {
                        searchParams.push({ name: '_has:List:item:_id', value: docsFolder.id });
                    }
                    if (docCreationDate && docCreationDate.trim().length > 0) {
                        searchParams.push({ name: 'date', value: "eq".concat(docCreationDate) });
                    }
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'DocumentReference',
                            params: searchParams,
                        })];
                case 1: return [2 /*return*/, (_a.sent()).unbundle()];
            }
        });
    }); }, {
        onSuccess: function (searchResultsResources) {
            var _a, _b;
            console.log("useSearchPatientDocuments() search results cnt=[".concat(searchResultsResources.length, "]"));
            //&& resource.status === 'current'
            var docRefsResources = (_b = (_a = searchResultsResources === null || searchResultsResources === void 0 ? void 0 : searchResultsResources.filter(function (resource) { return resource.resourceType === 'DocumentReference'; })) === null || _a === void 0 ? void 0 : _a.map(function (docRefResource) { return docRefResource; })) !== null && _b !== void 0 ? _b : [];
            var documents = docRefsResources.map(function (docRef) { return createDocumentInfo(docRef); });
            //TODO: remove when _text search will be available
            var resultDocuments = debug__mimicTextNarrativeDocumentsFilter(documents, filters);
            onSuccess(resultDocuments);
        },
        onError: function (err) {
            console.error('useSearchPatientDocuments() ERROR', err);
        },
    });
};
var extractDocumentAttachments = function (docRef) {
    var _a, _b;
    var getFileNameFromUrl = function (url) {
        if (!url)
            return;
        var parsedUrl = new URL(url);
        return parsedUrl.pathname.split('/').pop() || '';
    };
    return (_b = (_a = docRef.content) === null || _a === void 0 ? void 0 : _a.map(function (docRefContent) { return docRefContent === null || docRefContent === void 0 ? void 0 : docRefContent.attachment; })) === null || _b === void 0 ? void 0 : _b.map(function (docRefAttachment) {
        var title = docRefAttachment.title || '';
        if (docRefAttachment.contentType) {
            var extension = docRefAttachment.contentType.split('/').pop();
            var currentExtension = (0, files_helper_1.parseFileExtension)(title);
            // Add a file type if it does not match the already set type
            if (extension && currentExtension !== extension) {
                title = "".concat(title, ".").concat(extension);
            }
        }
        return {
            title: title,
            fileNameFromUrl: getFileNameFromUrl(docRefAttachment.url),
            z3Url: docRefAttachment.url,
        };
    });
};
//TODO: for now its not clear how real doc_name will be created based on the attachments data
// there is ongoing problem having multiple attachments per single DocumentReference resource
var debug__createDisplayedDocumentName = function (docRef) {
    var _a;
    return ((_a = extractDocumentAttachments(docRef)) !== null && _a !== void 0 ? _a : []).map(function (item) { return item.title; }).join(' & ');
};
//TODO: OystEHR FHIR backed is going to add support for "_text" search modifier and necessary migration changes is also
// needs to be done per each available DocumentReference resource
// until then simply adding front-side filtration mechanism
var debug__mimicTextNarrativeDocumentsFilter = function (documents, filters) {
    var docSearchTerm = filters === null || filters === void 0 ? void 0 : filters.documentName;
    return documents.filter(function (doc) {
        if (!docSearchTerm)
            return true;
        return doc.docName.toLowerCase().includes(docSearchTerm.toLowerCase());
    });
};
var usePatientDocsActions = function (_a) {
    var patientId = _a.patientId;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var queryClient = (0, react_query_1.useQueryClient)();
    var _b = (0, react_1.useState)(false), isUploading = _b[0], setIsUploading = _b[1];
    var uploadDocumentAction = (0, react_1.useCallback)(function (params) { return __awaiter(void 0, void 0, void 0, function () {
        var docFile, restParams, createUploadDocumentRes, _a, z3Url, presignedUploadUrl, documentRefId, folderId, uploadResponse, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("usePatientDocsActions()::uploadDocumentAction() triggered params =>");
                    console.log(params);
                    docFile = params.docFile, restParams = __rest(params, ["docFile"]);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 5, 6, 7]);
                    if (!CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID) {
                        throw new Error('Could not find environment variable VITE_APP_CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID');
                    }
                    if (!oystehrZambda) {
                        throw new Error('Could not initialize oystehrZambda client.');
                    }
                    console.log('signing request start ...');
                    setIsUploading(true);
                    return [4 /*yield*/, oystehrZambda.zambda.execute(__assign({ id: CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID, patientId: patientId }, restParams))];
                case 2:
                    createUploadDocumentRes = _b.sent();
                    console.log('signing request end RESULT =>');
                    console.log(createUploadDocumentRes);
                    _a = (0, utils_1.chooseJson)(createUploadDocumentRes), z3Url = _a.z3Url, presignedUploadUrl = _a.presignedUploadUrl, documentRefId = _a.documentRefId, folderId = _a.folderId;
                    console.log('uploading file to Z3 ...');
                    return [4 /*yield*/, fetch(presignedUploadUrl, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': docFile.type,
                            },
                            body: docFile,
                        })];
                case 3:
                    uploadResponse = _b.sent();
                    console.log('analyzing uploading result...');
                    if (!uploadResponse.ok) {
                        console.error('Z3 file uploading FAILURE');
                        throw new Error('Failed to upload file');
                    }
                    console.log('Z3 file uploading SUCCESS');
                    return [4 /*yield*/, Promise.all([
                            queryClient.refetchQueries([QUERY_KEYS.GET_PATIENT_DOCS_FOLDERS, { patientId: patientId }]),
                            queryClient.refetchQueries([QUERY_KEYS.GET_SEARCH_PATIENT_DOCUMENTS, { patientId: patientId }]),
                        ])];
                case 4:
                    _b.sent();
                    return [2 /*return*/, {
                            z3Url: z3Url,
                            presignedUploadUrl: presignedUploadUrl,
                            documentRefId: documentRefId,
                            folderId: folderId,
                        }];
                case 5:
                    error_1 = _b.sent();
                    console.error(error_1);
                    throw error_1;
                case 6:
                    setIsUploading(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); }, [oystehrZambda, patientId, queryClient]);
    return {
        uploadDocumentAction: uploadDocumentAction,
        isUploading: isUploading,
    };
};
var createDocumentInfo = function (documentReference) {
    var _a, _b, _c, _d, _e;
    return {
        id: documentReference.id,
        docName: debug__createDisplayedDocumentName(documentReference),
        whenAddedDate: documentReference.date,
        attachments: extractDocumentAttachments(documentReference),
        encounterId: (_e = (_d = (_c = (_b = (_a = documentReference.context) === null || _a === void 0 ? void 0 : _a.encounter) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.split('/')) === null || _e === void 0 ? void 0 : _e[1],
    };
};
//# sourceMappingURL=useGetPatientDocs.js.map