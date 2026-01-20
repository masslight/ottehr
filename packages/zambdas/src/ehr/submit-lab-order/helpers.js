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
exports.LABS_DATE_STRING_FORMAT = void 0;
exports.getBundledOrderResources = getBundledOrderResources;
exports.makeProvenanceResourceRequest = makeProvenanceResourceRequest;
exports.makeOrderFormsAndDocRefs = makeOrderFormsAndDocRefs;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var external_labs_order_form_pdf_1 = require("../../shared/pdf/external-labs-order-form-pdf");
var labs_results_form_pdf_1 = require("../../shared/pdf/labs-results-form-pdf");
var labs_1 = require("../shared/labs");
exports.LABS_DATE_STRING_FORMAT = 'MM/dd/yyyy hh:mm a ZZZZ';
function getBundledOrderResources(oystehr, m2mToken, // needed to get questionnaire via the qr.questionnaire url
serviceRequestIDs, isManualOrder) {
    return __awaiter(this, void 0, void 0, function () {
        var promises, results, bundledOrders, resourcesByServiceRequest, locationPromises, coveragePromises, aoeAnswerPromises, _a, locationResults, coverageResults, aoeAnswerResults, firstLocation, accountNumberByOrgRef, bundledOrderResources;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    promises = serviceRequestIDs.map(function (serviceRequestID) {
                        return (0, labs_1.getExternalLabOrderResourcesViaServiceRequest)(oystehr, serviceRequestID).then(function (result) { return ({
                            serviceRequestID: serviceRequestID,
                            result: result,
                        }); });
                    });
                    return [4 /*yield*/, Promise.all(promises).catch(function (e) {
                            console.log('error getting getting external lab resources', e);
                            throw e;
                        })];
                case 1:
                    results = _c.sent();
                    bundledOrders = {};
                    resourcesByServiceRequest = {};
                    locationPromises = [];
                    coveragePromises = [];
                    aoeAnswerPromises = [];
                    results.forEach(function (_a) {
                        var _b, _c, _d;
                        var serviceRequestID = _a.serviceRequestID, result = _a.result;
                        if (result.serviceRequest.status !== 'draft') {
                            throw Error("This order has already been submitted: ".concat(result.serviceRequest.id));
                        }
                        // TODO: fix in future. Pretty sure we don't need this, as result.location is part of the LabOrderResources type
                        var locationRef = (_b = result.serviceRequest.locationReference) === null || _b === void 0 ? void 0 : _b[0].reference;
                        var locationPromise = makeLocationPromise(oystehr, serviceRequestID, locationRef);
                        locationPromises.push(locationPromise);
                        var patientIDToValidate = result.patient.id;
                        var insuranceRefs = (_c = result.serviceRequest.insurance) === null || _c === void 0 ? void 0 : _c.map(function (ins) {
                            var _a;
                            return ins.reference && ((_a = ins.reference) === null || _a === void 0 ? void 0 : _a.startsWith('Coverage/')) ? ins.reference : undefined;
                        }).filter(function (ref) { return ref !== undefined; });
                        var coveragePromise = makeCoveragePromise(oystehr, serviceRequestID, patientIDToValidate, insuranceRefs);
                        coveragePromises.push(coveragePromise);
                        var questionnaireResponse = result.questionnaireResponse;
                        var aoeAnswerPromise = makeQuestionnairePromise(serviceRequestID, questionnaireResponse, m2mToken);
                        aoeAnswerPromises.push(aoeAnswerPromise);
                        var orderNumber = (0, utils_1.getOrderNumber)(result.serviceRequest);
                        if (!orderNumber)
                            throw Error("ServiceRequest is missing a requisition number, ".concat(result.serviceRequest));
                        if (bundledOrders[orderNumber]) {
                            bundledOrders[orderNumber].push(serviceRequestID);
                        }
                        else {
                            bundledOrders[orderNumber] = [serviceRequestID];
                        }
                        var timezone = result.schedule ? (0, utils_1.getTimezone)(result.schedule) : undefined;
                        var sampleCollectionDate = (_d = getMostRecentCollectionDate(result.specimens)) === null || _d === void 0 ? void 0 : _d.setZone(timezone);
                        var sampleCollectionDateFormatted = (sampleCollectionDate === null || sampleCollectionDate === void 0 ? void 0 : sampleCollectionDate.isValid) ? sampleCollectionDate : undefined;
                        // future TODO: we can move the check that every serviceRequest has a Location here
                        resourcesByServiceRequest[serviceRequestID] = __assign(__assign({}, result), { mostRecentSampleCollectionDate: sampleCollectionDateFormatted, timezone: timezone });
                    });
                    return [4 /*yield*/, Promise.all([
                            Promise.all(locationPromises),
                            Promise.all(coveragePromises),
                            Promise.all(aoeAnswerPromises),
                        ])];
                case 2:
                    _a = _c.sent(), locationResults = _a[0], coverageResults = _a[1], aoeAnswerResults = _a[2];
                    // Oystehr requires that all the locations be the same. We don't enforce that on the FE yet, so throwing a check here
                    // future todo: enforce on FE that all tests in a bundle be ordered from same location
                    if (!locationResults.length) {
                        throw (0, utils_1.EXTERNAL_LAB_ERROR)('No locations found for bundle');
                    }
                    firstLocation = locationResults[0].location;
                    if (!firstLocation ||
                        !locationResults.every(function (locRes) { var _a, _b; return ((_a = locRes.location) === null || _a === void 0 ? void 0 : _a.id) === (firstLocation === null || firstLocation === void 0 ? void 0 : firstLocation.id) && ((_b = locRes.location) === null || _b === void 0 ? void 0 : _b.status) === 'active'; })) {
                        throw (0, utils_1.EXTERNAL_LAB_ERROR)("All tests must be ordered from the same Location/".concat(firstLocation === null || firstLocation === void 0 ? void 0 : firstLocation.id));
                    }
                    accountNumberByOrgRef = new Map((_b = firstLocation === null || firstLocation === void 0 ? void 0 : firstLocation.identifier) === null || _b === void 0 ? void 0 : _b.filter(function (id) { return id.system === utils_1.LAB_ACCOUNT_NUMBER_SYSTEM && id.value && id.assigner && id.assigner.reference; }).map(function (id) { return [id.assigner.reference, id.value]; }));
                    locationResults.forEach(function (_a) {
                        var serviceRequestID = _a.serviceRequestID, location = _a.location;
                        if (!location) {
                            throw (0, utils_1.EXTERNAL_LAB_ERROR)("ServiceRequest/".concat(serviceRequestID, " must have a Location defined"));
                        }
                        var labOrderResourcesForSubmit = resourcesByServiceRequest[serviceRequestID];
                        var accountNumber = accountNumberByOrgRef.get("Organization/".concat(labOrderResourcesForSubmit.labOrganization.id));
                        if (!accountNumber) {
                            throw (0, utils_1.EXTERNAL_LAB_ERROR)("No account number found for ".concat(labOrderResourcesForSubmit.labOrganization.name, " for ").concat(location === null || location === void 0 ? void 0 : location.name, " office"));
                        }
                        // doing this so the type check keeps us honest on location and accountNumber
                        var resourcesWithLocationAndAccountNumber = __assign(__assign({}, labOrderResourcesForSubmit), { location: location, accountNumber: accountNumber });
                        resourcesByServiceRequest[serviceRequestID] = resourcesWithLocationAndAccountNumber;
                    });
                    coverageResults.forEach(function (_a) {
                        var serviceRequestID = _a.serviceRequestID, coveragesAndOrgs = _a.coveragesAndOrgs;
                        var labOrderResourcesForSubmit = resourcesByServiceRequest[serviceRequestID];
                        resourcesByServiceRequest[serviceRequestID] = __assign(__assign({}, labOrderResourcesForSubmit), { coveragesAndOrgs: coveragesAndOrgs });
                    });
                    aoeAnswerResults.forEach(function (_a) {
                        var serviceRequestID = _a.serviceRequestID, questionsAndAnswers = _a.questionsAndAnswers;
                        var labOrderResourcesForSubmit = resourcesByServiceRequest[serviceRequestID];
                        resourcesByServiceRequest[serviceRequestID] = __assign(__assign({}, labOrderResourcesForSubmit), { questionsAndAnswers: questionsAndAnswers });
                    });
                    bundledOrderResources = {};
                    Object.entries(bundledOrders).forEach(function (_a) {
                        var orderNumber = _a[0], serviceRequestIDs = _a[1];
                        serviceRequestIDs.forEach(function (srID) {
                            var allResources = resourcesByServiceRequest[srID];
                            var serviceRequest = allResources.serviceRequest;
                            var sampleCollectionDate = allResources.mostRecentSampleCollectionDate;
                            var aoeAnswers = allResources.questionsAndAnswers;
                            var srTestDetail = getTestDataForOrderForm(serviceRequest, aoeAnswers, sampleCollectionDate);
                            var isPscOrder = (0, utils_1.isPSCOrder)(serviceRequest);
                            function isLabOrderResourcesExtended(resources) {
                                return 'accountNumber' in resources && 'location' in resources;
                            }
                            if (!isLabOrderResourcesExtended(allResources)) {
                                throw (0, utils_1.EXTERNAL_LAB_ERROR)('resources do not contain location and/or account number');
                            }
                            if (bundledOrderResources[orderNumber]) {
                                bundledOrderResources[orderNumber].testDetails.push(srTestDetail);
                            }
                            else {
                                var paymentResources = makePaymentResourceConfig(allResources.serviceRequest.id, allResources.coveragesAndOrgs, allResources.account);
                                // oystehr labs will validate that all these resources match for each ServiceRequest submitted within
                                // a bundled order so there is no need for us to do that validation here, we will just take the resources from the first ServiceRequest for that bundle
                                bundledOrderResources[orderNumber] = {
                                    isManualOrder: isManualOrder,
                                    isPscOrder: isPscOrder,
                                    testDetails: [srTestDetail],
                                    accountNumber: allResources.accountNumber,
                                    encounter: allResources.encounter,
                                    labOrganization: allResources.labOrganization,
                                    provider: allResources.practitioner,
                                    patient: allResources.patient,
                                    timezone: allResources.timezone,
                                    location: allResources.location,
                                    paymentResources: paymentResources,
                                    account: allResources.account,
                                };
                            }
                        });
                    });
                    return [2 /*return*/, bundledOrderResources];
            }
        });
    });
}
function makeLocationPromise(oystehr, serviceRequestID, locationRef) {
    // If no locationRef, return resolved promise with location undefined
    if (!locationRef)
        return Promise.resolve({ serviceRequestID: serviceRequestID, location: undefined });
    var locationID = locationRef.replace('Location/', '');
    return oystehr.fhir
        .get({
        resourceType: 'Location',
        id: locationID,
    })
        .then(function (location) { return ({ serviceRequestID: serviceRequestID, location: location }); });
}
function makeCoveragePromise(oystehr, serviceRequestID, patientIDToValidate, insuranceRefs) {
    // If no insuranceRef, return resolved promise with undefined for coveragesAndOrgs
    if (!insuranceRefs || !insuranceRefs.length) {
        return Promise.resolve({ serviceRequestID: serviceRequestID, coveragesAndOrgs: undefined });
    }
    var coverageIDs = insuranceRefs.map(function (ref) { return ref.replace('Coverage/', ''); });
    return oystehr.fhir
        .search({
        resourceType: 'Coverage',
        params: [
            { name: '_id', value: coverageIDs.join(',') || 'UNKNOWN' },
            { name: '_include', value: 'Coverage:payor' },
            { name: '_include', value: 'Coverage:beneficiary' },
        ],
    })
        .then(function (bundle) {
        var unbundledResults = bundle.unbundle();
        var coverages = unbundledResults.filter(function (resource) { return resource.resourceType === 'Coverage'; });
        if (!coverages.length)
            throw (0, utils_1.EXTERNAL_LAB_ERROR)('no coverage found');
        var insuranceOrganizations = unbundledResults.filter(function (resource) { return resource.resourceType === 'Organization'; });
        if (!insuranceOrganizations.length)
            throw (0, utils_1.EXTERNAL_LAB_ERROR)('organizations for insurance were not found');
        var payorRefToOrgMap = new Map(insuranceOrganizations.map(function (org) { return ["Organization/".concat(org.id), org]; }));
        var coveragePatients = unbundledResults.filter(function (resource) { return resource.resourceType === 'Patient'; });
        if (coveragePatients.length !== 1)
            throw (0, utils_1.EXTERNAL_LAB_ERROR)('Found multiple patients when querying insurance info');
        var coveragePatient = coveragePatients[0];
        if (!coveragePatient || (coveragePatient === null || coveragePatient === void 0 ? void 0 : coveragePatient.id) !== patientIDToValidate) {
            throw Error("The coverage beneficiary does not match the patient from the service request. Coverage patient id: ".concat(coveragePatient === null || coveragePatient === void 0 ? void 0 : coveragePatient.id, ". ServiceRequest patient id: ").concat(patientIDToValidate, " "));
        }
        // map the coverage to its payor
        var coveragesAndOrgs = coverages.map(function (coverage) {
            var orgRef = coverage.payor.length ? coverage.payor[0].reference : '';
            var org = payorRefToOrgMap.get(orgRef !== null && orgRef !== void 0 ? orgRef : '');
            if (!org)
                throw (0, utils_1.EXTERNAL_LAB_ERROR)("No payor found for Coverage/".concat(coverage.id));
            return {
                coverage: coverage,
                payorOrg: org,
            };
        });
        return { serviceRequestID: serviceRequestID, coveragesAndOrgs: coveragesAndOrgs };
    });
}
function makeQuestionnairePromise(serviceRequestID, questionnaireResponse, m2mToken) {
    if (!questionnaireResponse) {
        return Promise.resolve({ serviceRequestID: serviceRequestID, questionsAndAnswers: undefined });
    }
    var questionnaireUrl = questionnaireResponse.questionnaire;
    if (!questionnaireUrl) {
        throw new Error("QuestionnaireResponse is missing its questionnaire, ".concat(questionnaireResponse.id));
    }
    var answers = questionnaireResponse.item;
    if (!answers) {
        // this will happen when there is an aoe but all the questions are optional and the user does not answer them
        return Promise.resolve({ serviceRequestID: serviceRequestID, questionsAndAnswers: undefined });
    }
    return fetch(questionnaireUrl, {
        headers: {
            Authorization: "Bearer ".concat(m2mToken),
        },
    })
        .then(function (questionnaireRequest) {
        return questionnaireRequest.json();
    })
        .then(function (questionnaire) {
        var fhirQuestionnaire = questionnaire;
        console.log('fhirQuestionnaire', fhirQuestionnaire);
        var questionsAndAnswers = answers
            .map(function (qrItem) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            var question = (_a = fhirQuestionnaire.item) === null || _a === void 0 ? void 0 : _a.find(function (item) { return item.linkId === qrItem.linkId; });
            if (!question)
                throw Error("question is not found on the questionnaire, link id: ".concat(qrItem.linkId));
            var answerDisplay;
            if (question.type === 'text' || question.type === 'choice') {
                answerDisplay = (_b = qrItem.answer) === null || _b === void 0 ? void 0 : _b.map(function (answerString) { return answerString.valueString; }).join(', ');
            }
            if (question.type === 'boolean') {
                answerDisplay = ((_c = qrItem.answer) === null || _c === void 0 ? void 0 : _c[0].valueBoolean) === false ? 'No' : 'Yes';
            }
            if (question.type === 'date') {
                answerDisplay = (_d = qrItem.answer) === null || _d === void 0 ? void 0 : _d[0].valueDate;
            }
            if (question.type === 'decimal') {
                answerDisplay = (_f = (_e = qrItem.answer) === null || _e === void 0 ? void 0 : _e[0].valueDecimal) === null || _f === void 0 ? void 0 : _f.toString();
            }
            if (question.type === 'integer') {
                answerDisplay = (_h = (_g = qrItem.answer) === null || _g === void 0 ? void 0 : _g[0].valueInteger) === null || _h === void 0 ? void 0 : _h.toString();
            }
            var questionDisplay = question.text;
            if (!questionDisplay || !answerDisplay) {
                return null;
            }
            return { question: questionDisplay, answer: [answerDisplay] };
        })
            .filter(function (item) { return !!item; });
        return { serviceRequestID: serviceRequestID, questionsAndAnswers: questionsAndAnswers };
    });
}
function getMostRecentCollectionDate(specimens) {
    if (specimens.length === 0)
        return;
    var sampleCollectionDates = specimens
        .map(function (specimen) { var _a, _b; return ((_a = specimen.collection) === null || _a === void 0 ? void 0 : _a.collectedDateTime) ? luxon_1.DateTime.fromISO((_b = specimen.collection) === null || _b === void 0 ? void 0 : _b.collectedDateTime) : undefined; })
        .filter(function (date) { return date !== undefined && date.isValid; });
    if (sampleCollectionDates.length > 0) {
        var mostRecentDate = luxon_1.DateTime.max.apply(luxon_1.DateTime, sampleCollectionDates);
        if (mostRecentDate)
            return mostRecentDate;
    }
    return;
}
function getTestDataForOrderForm(sr, aoeAnswers, mostRecentSampleCollectionDate) {
    var _a, _b, _c, _d;
    if (!sr.reasonCode)
        throw Error('ServiceRequest is missing a reasonCode to specify diagnosis');
    var data = {
        serviceRequestID: sr.id || utils_1.ORDER_ITEM_UNKNOWN,
        serviceRequest: sr,
        serviceRequestCreatedDate: sr.authoredOn || '',
        testName: ((_c = (_b = (_a = sr.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.system === utils_1.OYSTEHR_LAB_OI_CODE_SYSTEM; })) === null || _c === void 0 ? void 0 : _c.display) || utils_1.ORDER_ITEM_UNKNOWN,
        testAssessments: (_d = sr.reasonCode) === null || _d === void 0 ? void 0 : _d.map(function (code) {
            var _a;
            return ({
                code: ((_a = code.coding) === null || _a === void 0 ? void 0 : _a[0].code) || utils_1.ORDER_ITEM_UNKNOWN,
                name: code.text || utils_1.ORDER_ITEM_UNKNOWN,
            });
        }),
        testPriority: sr.priority || utils_1.ORDER_ITEM_UNKNOWN,
        aoeAnswers: aoeAnswers,
        mostRecentSampleCollectionDate: mostRecentSampleCollectionDate,
    };
    return data;
}
function makeProvenanceResourceRequest(now, serviceRequestID, currentUser) {
    var provenanceFhir = {
        resourceType: 'Provenance',
        target: [
            {
                reference: "ServiceRequest/".concat(serviceRequestID),
            },
        ],
        recorded: now.toISO(),
        agent: [
            {
                who: { reference: currentUser === null || currentUser === void 0 ? void 0 : currentUser.profile },
            },
        ],
        activity: {
            coding: [utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.submit],
        },
    };
    return {
        method: 'POST',
        url: '/Provenance',
        resource: provenanceFhir,
    };
}
function makeOrderFormsAndDocRefs(input, now, secrets, token, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var orderFormPromises, orderFormPdfDetails, _a, docRefPromises, presignedOrderFormURLPromises, _b, _docRefs, presignedOrderFormURLs;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    orderFormPromises = Object.entries(input).map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                        var patientId, encounterId, serviceRequestIds, pdfInfo, labGeneratedEReqUrl, abnUrl, orderFormDataConfig;
                        var orderNumber = _b[0], resources = _b[1];
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    console.log('making form order for', orderNumber);
                                    patientId = resources.patient.id;
                                    encounterId = resources.encounter.id;
                                    serviceRequestIds = resources.testDetails.map(function (detail) { return detail.serviceRequestID; });
                                    if (!patientId)
                                        throw new Error("Patient id is missing, cannot create order form");
                                    if (!encounterId)
                                        throw new Error("Encounter id is missing, cannot create order form");
                                    if (!resources.labGeneratedEReq) return [3 /*break*/, 1];
                                    labGeneratedEReqUrl = resources.labGeneratedEReq.content[0].attachment.url || '';
                                    return [3 /*break*/, 3];
                                case 1:
                                    orderFormDataConfig = (0, external_labs_order_form_pdf_1.getOrderFormDataConfig)(orderNumber, resources, now, oystehr);
                                    return [4 /*yield*/, (0, external_labs_order_form_pdf_1.createExternalLabsOrderFormPDF)(orderFormDataConfig, patientId, secrets, token)];
                                case 2:
                                    pdfInfo = _c.sent();
                                    _c.label = 3;
                                case 3:
                                    if (resources.abnDocRef) {
                                        abnUrl = resources.abnDocRef.content[0].attachment.url || '';
                                    }
                                    return [2 /*return*/, {
                                            pdfInfo: pdfInfo,
                                            labGeneratedEReqUrl: labGeneratedEReqUrl,
                                            abnUrl: abnUrl,
                                            patientId: patientId,
                                            encounterId: encounterId,
                                            serviceRequestIds: serviceRequestIds,
                                        }];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(orderFormPromises)];
                case 1:
                    orderFormPdfDetails = _c.sent();
                    _a = orderFormPdfDetails.reduce(function (acc, detail) {
                        if (detail.pdfInfo) {
                            acc.docRefPromises.push((0, labs_results_form_pdf_1.makeLabPdfDocumentReference)({
                                oystehr: oystehr,
                                type: 'order',
                                pdfInfo: detail.pdfInfo,
                                patientID: detail.patientId,
                                encounterID: detail.encounterId,
                                related: (0, labs_results_form_pdf_1.makeRelatedForLabsPDFDocRef)({ serviceRequestIds: detail.serviceRequestIds }),
                            }));
                            acc.presignedOrderFormURLPromises.push((0, utils_1.getPresignedURL)(detail.pdfInfo.uploadURL, token));
                        }
                        else if (detail.labGeneratedEReqUrl) {
                            acc.presignedOrderFormURLPromises.push((0, utils_1.getPresignedURL)(detail.labGeneratedEReqUrl, token));
                        }
                        if (detail.abnUrl) {
                            acc.presignedOrderFormURLPromises.push((0, utils_1.getPresignedURL)(detail.abnUrl, token));
                        }
                        return acc;
                    }, { docRefPromises: [], presignedOrderFormURLPromises: [] }), docRefPromises = _a.docRefPromises, presignedOrderFormURLPromises = _a.presignedOrderFormURLPromises;
                    return [4 /*yield*/, Promise.all([
                            Promise.all(docRefPromises),
                            Promise.all(presignedOrderFormURLPromises),
                        ])];
                case 2:
                    _b = _c.sent(), _docRefs = _b[0], presignedOrderFormURLs = _b[1];
                    return [2 /*return*/, presignedOrderFormURLs];
            }
        });
    });
}
function makePaymentResourceConfig(serviceRequestID, coveragesAndOrgs, account) {
    console.log('in makePaymentResourceConfig');
    console.log("These are the coveragesAndOrgs: ".concat(JSON.stringify(coveragesAndOrgs)));
    console.log('For ServiceRequest', serviceRequestID);
    if (!coveragesAndOrgs || !coveragesAndOrgs.length)
        return { type: utils_1.LabPaymentMethod.SelfPay };
    var clientBillCoverageAndOrg = coveragesAndOrgs.find(function (data) { return (0, utils_1.paymentMethodFromCoverage)(data.coverage) === utils_1.LabPaymentMethod.ClientBill; });
    var selfPayCoverage = coveragesAndOrgs.find(function (data) { return (0, utils_1.paymentMethodFromCoverage)(data.coverage) === utils_1.LabPaymentMethod.SelfPay; });
    if (clientBillCoverageAndOrg && coveragesAndOrgs.length === 1) {
        return { type: utils_1.LabPaymentMethod.ClientBill, coverage: clientBillCoverageAndOrg.coverage };
    }
    else if (coveragesAndOrgs.every(function (data) { return (0, utils_1.paymentMethodFromCoverage)(data.coverage) === utils_1.LabPaymentMethod.Insurance; })) {
        var sortedCoverages = (0, labs_1.sortCoveragesByPriority)(account, coveragesAndOrgs.map(function (cAndO) { return cAndO.coverage; }));
        // this should only happen if there are no Coverages passed, which we know there would be
        if (!sortedCoverages)
            throw new Error('Error sorting coverages in makePaymentResourceConfig, none returned');
        console.log("These are the sorted sortedCoverages ".concat(JSON.stringify(sortedCoverages.map(function (e) { return "Coverage/".concat(e.id); }))));
        var coverageRefToResourcesMap_1 = new Map(coveragesAndOrgs.map(function (e) { return ["Coverage/".concat(e.coverage.id), e]; }));
        var coveragesAndOrgsWithRank = sortedCoverages.map(function (coverage, idx) {
            var coverageAndOrg = coverageRefToResourcesMap_1.get("Coverage/".concat(coverage.id));
            if (!coverageAndOrg)
                throw (0, utils_1.EXTERNAL_LAB_ERROR)("Could not map Coverage back to its coverageAndOrg: Coverage/".concat(coverage.id));
            return {
                coverage: coverageAndOrg.coverage,
                payorOrg: coverageAndOrg.payorOrg,
                coverageRank: idx + 1,
            };
        });
        console.log("These are the coveragesAndOrgsWithRank: ".concat(JSON.stringify(coveragesAndOrgsWithRank.map(function (e) {
            return {
                coverage: "Coverage/".concat(e.coverage),
                insuranceOrganization: "Organization/".concat(e.payorOrg),
                coverageRank: e.coverageRank,
            };
        }))));
        return { type: utils_1.LabPaymentMethod.Insurance, coverageAndOrgs: coveragesAndOrgsWithRank };
    }
    else if (selfPayCoverage && coveragesAndOrgs.length === 1) {
        return { type: utils_1.LabPaymentMethod.SelfPay, coverage: selfPayCoverage.coverage };
    }
    else {
        var coverageIdWithPaymentMethod = coveragesAndOrgs.map(function (data) { return ({
            coverageId: data.coverage.id,
            paymentMethod: (0, utils_1.paymentMethodFromCoverage)(data.coverage),
        }); });
        console.log("coverages parsed have an unexpected combination of payment methods: ".concat(JSON.stringify(coverageIdWithPaymentMethod)));
        // right now labs can only have one type of payment method: self pay or insurance or client bill
        // possibly in the future we could allow a combo of self pay and insurance (maybe idk) and then this error is not needed
        throw new Error("Could not determine the payment method based on coverages linked to this service request ".concat(serviceRequestID));
    }
}
