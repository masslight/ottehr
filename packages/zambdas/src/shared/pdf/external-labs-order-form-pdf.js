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
exports.createExternalLabsOrderFormPDF = createExternalLabsOrderFormPDF;
exports.getOrderFormDataConfig = getOrderFormDataConfig;
var lodash_1 = require("lodash");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var helpers_1 = require("../../ehr/submit-lab-order/helpers");
var presigned_file_urls_1 = require("../presigned-file-urls");
var z3Utils_1 = require("../z3Utils");
var lab_pdf_utils_1 = require("./lab-pdf-utils");
var labs_results_form_pdf_1 = require("./labs-results-form-pdf");
var pdf_consts_1 = require("./pdf-consts");
var pdf_utils_1 = require("./pdf-utils");
function uploadPDF(pdfBytes, token, baseFileUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var presignedUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, z3Utils_1.createPresignedUrl)(token, baseFileUrl, 'upload')];
                case 1:
                    presignedUrl = _a.sent();
                    return [4 /*yield*/, (0, z3Utils_1.uploadObjectToZ3)(pdfBytes, presignedUrl)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createExternalLabsOrderFormPDF(input, patientID, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfBytes, bucketName, fileName, baseFileUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Creating external labs order form pdf bytes');
                    return [4 /*yield*/, createExternalLabsOrderFormPdfBytes(input).catch(function (error) {
                            throw new Error('failed creating labs order form pdfBytes: ' + error.message);
                        })];
                case 1:
                    pdfBytes = _a.sent();
                    console.debug("Created external labs order form pdf bytes");
                    bucketName = utils_1.BUCKET_NAMES.LABS;
                    fileName = "ExternalLabsOrderForm-".concat(input.labOrganizationName ? (0, labs_results_form_pdf_1.getLabFileName)(input.labOrganizationName) + '-' : '', "-").concat(luxon_1.DateTime.fromISO(input.dateIncludedInFileName).toFormat('yyyy-MM-dd'), "-").concat(input.orderNumber, "-").concat(input.orderPriority, ".pdf");
                    console.log('Creating base file url');
                    baseFileUrl = (0, presigned_file_urls_1.makeZ3Url)({ secrets: secrets, fileName: fileName, bucketName: bucketName, patientID: patientID });
                    console.log('Uploading file to bucket');
                    return [4 /*yield*/, uploadPDF(pdfBytes, token, baseFileUrl).catch(function (error) {
                            throw new Error('failed uploading pdf to z3: ' + error.message);
                        })];
                case 2:
                    _a.sent();
                    // for testing
                    // savePdfLocally(pdfBytes);
                    return [2 /*return*/, { title: fileName, uploadURL: baseFileUrl }];
            }
        });
    });
}
function createExternalLabsOrderFormPdfBytes(data) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfClient, _a, client, callIcon, faxIcon, locationIcon, textStyles, iconStyleWithMargin, rightColumnXStart, GREY_LINE_STYLE_NO_TOP_MARGIN, leftColumnBounds, yPosAtStartOfLocation, yPosAtEndOfLocation, xPosAfterImage, currXPos, sortedDetails, _i, sortedDetails_1, insuranceDetail;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('drawing pdf for ', data.orderNumber);
                    return [4 /*yield*/, (0, lab_pdf_utils_1.getPdfClientForLabsPDFs)()];
                case 1:
                    _a = _b.sent(), client = _a.pdfClient, callIcon = _a.callIcon, faxIcon = _a.faxIcon, locationIcon = _a.locationIcon, textStyles = _a.textStyles;
                    pdfClient = client;
                    iconStyleWithMargin = __assign(__assign({}, pdf_consts_1.ICON_STYLE), { margin: { left: 10, right: 10 } });
                    rightColumnXStart = 315;
                    GREY_LINE_STYLE_NO_TOP_MARGIN = __assign(__assign({}, pdf_utils_1.SEPARATED_LINE_STYLE), { margin: { top: 0, bottom: 8 } });
                    // Draw header
                    console.log("Drawing header. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". Current page index is ").concat(pdfClient.getCurrentPageIndex(), " out of ").concat(pdfClient.getTotalPages(), " pages."));
                    pdfClient.drawText("".concat(data.labOrganizationName, ": Order Form"), textStyles.headerRight); // the original was 18 font
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    // print 'e-req' if submitting electronically
                    if (!data.isManualOrder) {
                        console.log("Drawing e-Req line. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". Current page index is ").concat(pdfClient.getCurrentPageIndex(), " out of ").concat(pdfClient.getTotalPages(), " pages."));
                        pdfClient.drawText('E-REQ', __assign(__assign({}, textStyles.textBoldRight), { fontSize: textStyles.headerRight.fontSize - 2 }));
                        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    }
                    pdfClient.drawSeparatedLine(pdf_utils_1.BLACK_LINE_STYLE);
                    // Location Details (left column)
                    console.log("Drawing location details left column. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". Current page index is ").concat(pdfClient.getCurrentPageIndex(), " out of ").concat(pdfClient.getTotalPages(), " pages."));
                    leftColumnBounds = { leftBound: pdfClient.getLeftBound(), rightBound: rightColumnXStart - 10 };
                    yPosAtStartOfLocation = pdfClient.getY();
                    yPosAtEndOfLocation = yPosAtStartOfLocation;
                    if (data.brandingProjectName ||
                        data.locationName ||
                        data.locationStreetAddress ||
                        data.locationCity ||
                        data.locationState ||
                        data.locationZip ||
                        data.locationPhone ||
                        data.locationFax) {
                        if (data.brandingProjectName) {
                            pdfClient.drawTextSequential(data.brandingProjectName, textStyles.textBold, leftColumnBounds);
                            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        }
                        if (data.locationName) {
                            pdfClient.drawTextSequential(data.locationName, textStyles.textBold, leftColumnBounds);
                            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        }
                        pdfClient.drawImage(locationIcon, __assign(__assign({}, iconStyleWithMargin), { margin: __assign(__assign({}, iconStyleWithMargin.margin), { left: 0 }) }), textStyles.text);
                        xPosAfterImage = pdfClient.getX();
                        if (data.locationStreetAddress) {
                            pdfClient.drawTextSequential(data.locationStreetAddress.toUpperCase(), textStyles.text, {
                                leftBound: xPosAfterImage,
                                rightBound: leftColumnBounds.rightBound,
                            });
                            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        }
                        if (data.locationCity || data.locationState || data.locationZip) {
                            pdfClient.drawTextSequential("".concat(data.locationCity ? data.locationCity + ', ' : '').concat(data.locationState ? data.locationState + ' ' : '').concat(data.locationZip || '').toUpperCase(), textStyles.text, {
                                leftBound: xPosAfterImage,
                                rightBound: leftColumnBounds.rightBound,
                            });
                            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        }
                        // the phone and fax should be on the same line
                        if (data.locationPhone) {
                            pdfClient.drawImage(callIcon, __assign(__assign({}, iconStyleWithMargin), { margin: __assign(__assign({}, iconStyleWithMargin.margin), { left: 0 }) }), textStyles.text);
                            pdfClient.drawTextSequential((0, utils_1.formatPhoneNumberDisplay)(data.locationPhone), textStyles.text, {
                                leftBound: pdfClient.getX(),
                                rightBound: leftColumnBounds.rightBound,
                            });
                        }
                        if (data.locationFax) {
                            pdfClient.drawImage(faxIcon, iconStyleWithMargin, textStyles.text);
                            pdfClient.drawTextSequential(data.locationFax, textStyles.text, {
                                leftBound: pdfClient.getX(),
                                rightBound: leftColumnBounds.rightBound,
                            });
                        }
                        if (data.locationPhone || data.locationFax) {
                            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        }
                        yPosAtEndOfLocation = pdfClient.getY();
                    }
                    // Requisition number (aka order number), physician info (right column)
                    // go back to where the location info started to start the right column of text
                    pdfClient.setY(yPosAtStartOfLocation);
                    console.log("Drawing requisition number, physician info right column. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". Current page index is ").concat(pdfClient.getCurrentPageIndex(), " out of ").concat(pdfClient.getTotalPages(), " pages."));
                    currXPos = pdfClient.drawStartXPosSpecifiedText('Req #: ', textStyles.textBold, rightColumnXStart).endXPos;
                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    pdfClient.drawStartXPosSpecifiedText(data.orderNumber, textStyles.text, currXPos).endXPos;
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    console.log("Drawing physician info. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". Current page index is ").concat(pdfClient.getCurrentPageIndex(), " out of ").concat(pdfClient.getTotalPages(), " pages."));
                    pdfClient.drawStartXPosSpecifiedText(data.providerName, textStyles.textBold, rightColumnXStart);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    if (data.providerNPI) {
                        currXPos = pdfClient.drawStartXPosSpecifiedText('NPI: ', textStyles.textBold, rightColumnXStart).endXPos;
                        pdfClient.drawStartXPosSpecifiedText(data.providerNPI, textStyles.text, currXPos);
                        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    }
                    currXPos = pdfClient.drawStartXPosSpecifiedText('Client ID: ', textStyles.textBold, rightColumnXStart).endXPos;
                    pdfClient.drawStartXPosSpecifiedText(data.accountNumber, textStyles.text, currXPos);
                    // figure out which column drew farther down in the y direction, and set the new y to that, then add newline
                    pdfClient.setY((0, lodash_1.min)([pdfClient.getY(), yPosAtEndOfLocation]));
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    // Line before patient info
                    pdfClient.drawSeparatedLine(pdf_utils_1.BLACK_LINE_STYLE);
                    // Patient info (left column)
                    console.log("Drawing patient info left column. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". Current page index is ").concat(pdfClient.getCurrentPageIndex(), " out of ").concat(pdfClient.getTotalPages(), " pages."));
                    pdfClient.drawTextSequential("".concat(data.patientLastName, ", ").concat(data.patientFirstName).concat(data.patientMiddleName ? ' ' + data.patientMiddleName : '', " "), __assign(__assign({}, textStyles.header), { newLineAfter: false }));
                    pdfClient.drawTextSequential("".concat(data.patientSex, ", ").concat(data.patientDOB), textStyles.text);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    pdfClient = (0, lab_pdf_utils_1.drawFieldLineBoldHeader)(pdfClient, textStyles, 'ID:', data.patientId);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    pdfClient.drawImage(locationIcon, __assign(__assign({}, iconStyleWithMargin), { margin: __assign(__assign({}, iconStyleWithMargin.margin), { left: 0 }) }), textStyles.text);
                    pdfClient.drawTextSequential("".concat(data.patientAddress, " "), textStyles.text);
                    pdfClient.drawImage(callIcon, iconStyleWithMargin, textStyles.text);
                    pdfClient.drawTextSequential((0, utils_1.formatPhoneNumberDisplay)(data.patientPhone), textStyles.text);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    // Order date and collection date
                    console.log("Drawing order and collection date. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". Current page index is ").concat(pdfClient.getCurrentPageIndex(), " out of ").concat(pdfClient.getTotalPages(), " pages."));
                    pdfClient = (0, lab_pdf_utils_1.drawFieldLineBoldHeader)(pdfClient, textStyles, 'Order Date:', data.orderSubmitDate);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    pdfClient.drawSeparatedLine(pdf_utils_1.BLACK_LINE_STYLE);
                    // Insurance/billing Section
                    console.log("Drawing insurance. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". Current page index is ").concat(pdfClient.getCurrentPageIndex(), " out of ").concat(pdfClient.getTotalPages(), " pages."));
                    pdfClient = (0, lab_pdf_utils_1.drawFieldLineBoldHeader)(pdfClient, textStyles, 'Bill Class:', data.billClass);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    if (data.insuranceDetails) {
                        sortedDetails = data.insuranceDetails.sort(function (a, b) { return a.insuranceRank - b.insuranceRank; });
                        for (_i = 0, sortedDetails_1 = sortedDetails; _i < sortedDetails_1.length; _i++) {
                            insuranceDetail = sortedDetails_1[_i];
                            pdfClient = drawInsuranceDetail(pdfClient, textStyles, insuranceDetail);
                        }
                    }
                    // Test Details
                    console.log('Drawing test details section');
                    pdfClient.drawSeparatedLine(pdf_utils_1.BLACK_LINE_STYLE);
                    pdfClient.drawTextSequential('Labs', textStyles.header);
                    data.testDetails.forEach(function (detail, idx) {
                        var _a, _b, _c;
                        var lastTest = idx + 1 === data.testDetails.length;
                        pdfClient.drawTextSequential(detail.testName.toUpperCase(), __assign(__assign({}, textStyles.textBold), { fontSize: pdf_consts_1.SUB_HEADER_FONT_SIZE }));
                        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        pdfClient = (0, lab_pdf_utils_1.drawFieldLineBoldHeader)(pdfClient, textStyles, "Assessments: ", detail.testAssessments.map(function (assessment) { return "".concat(assessment.code, " (").concat(assessment.name, ")"); }).join(', '));
                        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        // only print this for non-psc orders
                        if (!data.isPscOrder) {
                            pdfClient = (0, lab_pdf_utils_1.drawFieldLineBoldHeader)(pdfClient, textStyles, 'Collection Date:', (_b = (_a = detail.mostRecentSampleCollectionDate) === null || _a === void 0 ? void 0 : _a.toFormat(helpers_1.LABS_DATE_STRING_FORMAT)) !== null && _b !== void 0 ? _b : '');
                            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        }
                        // AOE Section
                        if ((_c = detail.aoeAnswers) === null || _c === void 0 ? void 0 : _c.length) {
                            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                            pdfClient.drawTextSequential('AOE Answers', textStyles.textBold);
                            console.log("Drawing AOE. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". Current page index is ").concat(pdfClient.getCurrentPageIndex(), " out of ").concat(pdfClient.getTotalPages(), " pages."));
                            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE + 4);
                            detail.aoeAnswers.forEach(function (item) {
                                pdfClient = (0, lab_pdf_utils_1.drawFieldLineBoldHeader)(pdfClient, textStyles, "".concat(item.question, ": "), item.answer.toString());
                                pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                            });
                        }
                        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        if (!lastTest)
                            pdfClient.drawSeparatedLine(GREY_LINE_STYLE_NO_TOP_MARGIN);
                    });
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    // Signature
                    console.log("Drawing signature. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". Current page index is ").concat(pdfClient.getCurrentPageIndex(), " out of ").concat(pdfClient.getTotalPages(), " pages."));
                    pdfClient.drawTextSequential("Electronically signed by: ".concat(data.providerName), textStyles.textBold);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    pdfClient.drawTextSequential(data.orderSubmitDate, textStyles.textGreyBold);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    pdfClient.drawSeparatedLine(pdf_utils_1.BLACK_LINE_STYLE);
                    // Generated by Ottehr
                    console.log("Drawing ottehr signature. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". Current page index is ").concat(pdfClient.getCurrentPageIndex(), " out of ").concat(pdfClient.getTotalPages(), " pages."));
                    pdfClient.drawTextSequential('Order generated by Ottehr', textStyles.textGreyBold);
                    return [4 /*yield*/, pdfClient.save()];
                case 2: return [2 /*return*/, _b.sent()];
            }
        });
    });
}
function getOrderFormDataConfig(orderNumber, resources, now, oystehr) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    var testDetails = resources.testDetails, accountNumber = resources.accountNumber, labOrganization = resources.labOrganization, provider = resources.provider, patient = resources.patient, timezone = resources.timezone, location = resources.location, isManualOrder = resources.isManualOrder, isPscOrder = resources.isPscOrder, paymentResources = resources.paymentResources;
    // this is the same logic we use in oystehr to determine PV1-20
    var getBillClass = function (paymentResources) {
        var _a, _b, _c;
        var coverage;
        if (paymentResources.type === utils_1.LabPaymentMethod.Insurance) {
            coverage = paymentResources.coverageAndOrgs[0].coverage;
        }
        else {
            // client bill or self pay
            coverage = paymentResources.coverage;
        }
        var coverageType = (_c = (_b = (_a = coverage === null || coverage === void 0 ? void 0 : coverage.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code; // assumption: we'll use the first code in the list
        if (!coverage || coverageType === 'pay') {
            return 'Patient Bill (P)';
        }
        else if (coverageType === utils_1.LAB_CLIENT_BILL_COVERAGE_TYPE_CODING.code) {
            return 'Client Bill (C)';
        }
        else {
            return 'Third-Party Bill (T)';
        }
    };
    var billClass = getBillClass(paymentResources);
    var insuranceDetails = paymentResources.type === utils_1.LabPaymentMethod.Insurance
        ? getInsuranceDetails(paymentResources.coverageAndOrgs, patient, oystehr)
        : undefined;
    var brandingProjectName = utils_1.BRANDING_CONFIG.projectName;
    var dataConfig = {
        locationName: location === null || location === void 0 ? void 0 : location.name,
        locationStreetAddress: (_b = (_a = location === null || location === void 0 ? void 0 : location.address) === null || _a === void 0 ? void 0 : _a.line) === null || _b === void 0 ? void 0 : _b.join(','),
        locationCity: (_c = location === null || location === void 0 ? void 0 : location.address) === null || _c === void 0 ? void 0 : _c.city,
        locationState: (_d = location === null || location === void 0 ? void 0 : location.address) === null || _d === void 0 ? void 0 : _d.state,
        locationZip: (_e = location === null || location === void 0 ? void 0 : location.address) === null || _e === void 0 ? void 0 : _e.postalCode,
        locationPhone: (_g = (_f = location === null || location === void 0 ? void 0 : location.telecom) === null || _f === void 0 ? void 0 : _f.find(function (t) { return t.system === 'phone'; })) === null || _g === void 0 ? void 0 : _g.value,
        locationFax: (_j = (_h = location === null || location === void 0 ? void 0 : location.telecom) === null || _h === void 0 ? void 0 : _h.find(function (t) { return t.system === 'fax'; })) === null || _j === void 0 ? void 0 : _j.value,
        labOrganizationName: (labOrganization === null || labOrganization === void 0 ? void 0 : labOrganization.name) || utils_1.ORDER_ITEM_UNKNOWN,
        brandingProjectName: brandingProjectName,
        accountNumber: accountNumber,
        orderNumber: orderNumber || utils_1.ORDER_ITEM_UNKNOWN,
        providerName: (0, utils_1.getFullestAvailableName)(provider) || utils_1.ORDER_ITEM_UNKNOWN,
        providerNPI: (_l = (_k = provider.identifier) === null || _k === void 0 ? void 0 : _k.find(function (id) { return (id === null || id === void 0 ? void 0 : id.system) === utils_1.FHIR_IDENTIFIER_NPI; })) === null || _l === void 0 ? void 0 : _l.value,
        patientFirstName: ((_o = (_m = patient.name) === null || _m === void 0 ? void 0 : _m[0].given) === null || _o === void 0 ? void 0 : _o[0]) || utils_1.ORDER_ITEM_UNKNOWN,
        patientMiddleName: (_q = (_p = patient.name) === null || _p === void 0 ? void 0 : _p[0].given) === null || _q === void 0 ? void 0 : _q[1],
        patientLastName: ((_r = patient.name) === null || _r === void 0 ? void 0 : _r[0].family) || utils_1.ORDER_ITEM_UNKNOWN,
        patientSex: patient.gender || utils_1.ORDER_ITEM_UNKNOWN,
        patientDOB: patient.birthDate
            ? luxon_1.DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')
            : utils_1.ORDER_ITEM_UNKNOWN,
        patientId: patient.id || utils_1.ORDER_ITEM_UNKNOWN,
        patientAddress: ((_s = patient.address) === null || _s === void 0 ? void 0 : _s[0]) ? oystehr.fhir.formatAddress(patient.address[0]) : utils_1.ORDER_ITEM_UNKNOWN,
        patientPhone: ((_u = (_t = patient.telecom) === null || _t === void 0 ? void 0 : _t.find(function (temp) { return temp.system === 'phone'; })) === null || _u === void 0 ? void 0 : _u.value) || utils_1.ORDER_ITEM_UNKNOWN,
        todayDate: now.setZone(timezone).toFormat(helpers_1.LABS_DATE_STRING_FORMAT),
        orderSubmitDate: now.setZone(timezone).toFormat(helpers_1.LABS_DATE_STRING_FORMAT),
        dateIncludedInFileName: testDetails[0].serviceRequestCreatedDate,
        orderPriority: testDetails[0].testPriority || utils_1.ORDER_ITEM_UNKNOWN, // used for file name
        billClass: billClass,
        insuranceDetails: insuranceDetails,
        testDetails: testDetails,
        isManualOrder: isManualOrder,
        isPscOrder: isPscOrder,
    };
    return dataConfig;
}
function getInsuranceDetails(insuranceCoveragesAndOrgs, patient, oystehr) {
    if (!insuranceCoveragesAndOrgs || !insuranceCoveragesAndOrgs.length)
        return undefined;
    var insuranceInfo = [];
    insuranceCoveragesAndOrgs.forEach(function (covAndOrg) {
        var _a;
        var coverage = covAndOrg.coverage, insuranceOrganization = covAndOrg.payorOrg, coverageRank = covAndOrg.coverageRank;
        var _b = getInsuredInfoFromCoverageSubscriber(coverage, patient), insuredName = _b.insuredName, insuredAddress = _b.insuredAddress;
        insuranceInfo.push({
            insuranceName: insuranceOrganization === null || insuranceOrganization === void 0 ? void 0 : insuranceOrganization.name,
            insuranceAddress: (insuranceOrganization === null || insuranceOrganization === void 0 ? void 0 : insuranceOrganization.address)
                ? oystehr.fhir.formatAddress((_a = insuranceOrganization.address) === null || _a === void 0 ? void 0 : _a[0])
                : undefined,
            insuranceSubNum: coverage === null || coverage === void 0 ? void 0 : coverage.subscriberId,
            insuredName: insuredName && insuredName.length ? oystehr.fhir.formatHumanName(insuredName[0]) : undefined,
            insuredAddress: insuredAddress && insuredAddress.length ? oystehr.fhir.formatAddress(insuredAddress[0]) : undefined,
            insuranceRank: coverageRank,
        });
    });
    return insuranceInfo;
}
function getInsuredInfoFromCoverageSubscriber(coverage, patient) {
    var _a;
    var subscriberRef = (_a = coverage.subscriber) === null || _a === void 0 ? void 0 : _a.reference;
    console.log("subscriberRef for Coverage/".concat(coverage.id, " is: ").concat(subscriberRef));
    if (subscriberRef === "Patient/".concat(patient.id)) {
        console.log("Coverage reference matched Patient/".concat(patient.id, ". Setting insuredName and address to patient info"));
        return {
            insuredName: patient.name,
            insuredAddress: patient.address,
        };
    }
    console.log("Coverage reference did not match Patient/".concat(patient.id, ". Checking for contained RelatedPerson subscriber"));
    var emptyResponse = { insuredName: undefined, insuredAddress: undefined };
    // for the moment always assume we're going to get the subscriber as a contained resource
    if (!subscriberRef || !subscriberRef.startsWith('#'))
        return emptyResponse;
    // also going to assume the subscriber is only a RelatedPerson
    var subscriber = coverage.contained.find(function (cont) {
        return cont.resourceType === 'RelatedPerson' && cont.id === subscriberRef.replace('#', '');
    });
    console.log("subscriber resource for Coverage/".concat(coverage.id, " is: ").concat(JSON.stringify(subscriber)));
    if (!subscriber)
        return emptyResponse;
    return {
        insuredName: subscriber.name,
        insuredAddress: subscriber.address,
    };
}
function drawInsuranceDetail(pdfClient, textStyles, insuranceDetail) {
    var insuranceRank = insuranceDetail.insuranceRank, insuredName = insuranceDetail.insuredName, insuredAddress = insuranceDetail.insuredAddress, insuranceName = insuranceDetail.insuranceName, insuranceAddress = insuranceDetail.insuranceAddress, insuranceSubNum = insuranceDetail.insuranceSubNum;
    var rankToLabel = function (rank) {
        switch (rank) {
            case 1:
                return 'Primary';
            case 2:
                return 'Secondary';
            case 3:
                return 'Tertiary';
            default:
                return 'Additional';
        }
    };
    if (insuranceName) {
        pdfClient = (0, lab_pdf_utils_1.drawFieldLineBoldHeader)(pdfClient, textStyles, "".concat(rankToLabel(insuranceRank), " Insurance Name:"), insuranceName);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    if (insuranceAddress) {
        pdfClient = (0, lab_pdf_utils_1.drawFieldLineBoldHeader)(pdfClient, textStyles, 'Insurance Address:', insuranceAddress.toUpperCase());
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    if (insuranceSubNum) {
        pdfClient = (0, lab_pdf_utils_1.drawFieldLineBoldHeader)(pdfClient, textStyles, 'Subscriber Number:', insuranceSubNum);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    if (insuredName) {
        pdfClient = (0, lab_pdf_utils_1.drawFieldLineBoldHeader)(pdfClient, textStyles, 'Insured Name:', insuredName);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    if (insuredAddress) {
        pdfClient = (0, lab_pdf_utils_1.drawFieldLineBoldHeader)(pdfClient, textStyles, 'Address:', insuredAddress);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    if (insuredName || insuredAddress || insuranceName || insuranceAddress || insuranceSubNum) {
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    return pdfClient;
}
