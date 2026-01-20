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
exports.createVisitNotePDF = createVisitNotePDF;
var fs_1 = require("fs");
var pdf_lib_1 = require("pdf-lib");
var utils_1 = require("utils");
var presigned_file_urls_1 = require("../presigned-file-urls");
var z3Utils_1 = require("../z3Utils");
var pdf_consts_1 = require("./pdf-consts");
var pdf_utils_1 = require("./pdf-utils");
function createVisitNotePdfBytes(data, isInPersonAppointment, encounter) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfClientStyles, pdfClient, RubikFont, RubikFontBold, logoBuffer, logo, redDot, greenDot, textStyles, separatedLineStyle, examColorDotsStyle, examExtraItemsSeparatedLineStyle, drawBlockHeader, drawFieldLine, separateLine, regularText, drawExaminationCard, drawExamProviderComment, drawExtraItems, isFollowup, drawHeadline, pageStylesWithHeadline, followupDetails, followupDateTime, inconclusiveIcon, abnormalIcon, normalIcon, regularTextNoLineAfter, getFlagsExcludingNeutral, getCurBounds, drawResultFlags, getTestNameTextStyle, drawInHouseLabs, drawExternalLabs, vitalLabelMapper_1, examination, completedDateTime;
        var _a;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5;
        return __generator(this, function (_6) {
            switch (_6.label) {
                case 0:
                    pdfClientStyles = {
                        initialPage: {
                            width: pdf_lib_1.PageSizes.A4[0],
                            height: pdf_lib_1.PageSizes.A4[1],
                            pageMargins: {
                                top: 40,
                                bottom: 40,
                                // Left and right margins should be 37 to fit item "* Intact recent and remote memory, judgment and insight".
                                // The design of this page will be changed soon, so this simple fix is optimal for now.
                                right: 37,
                                left: 37,
                            },
                        },
                    };
                    return [4 /*yield*/, (0, pdf_utils_1.createPdfClient)(pdfClientStyles)];
                case 1:
                    pdfClient = _6.sent();
                    return [4 /*yield*/, pdfClient.embedFont(fs_1.default.readFileSync('./assets/Rubik-Regular.otf'))];
                case 2:
                    RubikFont = _6.sent();
                    return [4 /*yield*/, pdfClient.embedFont(fs_1.default.readFileSync('./assets/Rubik-Bold.otf'))];
                case 3:
                    RubikFontBold = _6.sent();
                    return [4 /*yield*/, (0, pdf_utils_1.getPdfLogo)()];
                case 4:
                    logoBuffer = _6.sent();
                    if (!logoBuffer) return [3 /*break*/, 6];
                    return [4 /*yield*/, pdfClient.embedImage(logoBuffer)];
                case 5:
                    logo = _6.sent();
                    _6.label = 6;
                case 6: return [4 /*yield*/, pdfClient.embedImage(fs_1.default.readFileSync('./assets/red-dot.png'))];
                case 7:
                    redDot = _6.sent();
                    return [4 /*yield*/, pdfClient.embedImage(fs_1.default.readFileSync('./assets/green-dot.png'))];
                case 8:
                    greenDot = _6.sent();
                    textStyles = {
                        header: {
                            fontSize: 20,
                            font: RubikFontBold,
                            spacing: 17,
                            side: 'right',
                            newLineAfter: true,
                        },
                        subHeader: {
                            fontSize: 14,
                            font: RubikFontBold,
                            spacing: 5,
                            newLineAfter: true,
                        },
                        blockHeader: {
                            fontSize: 18,
                            spacing: 8,
                            font: RubikFont,
                            newLineAfter: true,
                            color: (0, pdf_utils_1.rgbNormalized)(48, 19, 103),
                        },
                        blockSubHeader: {
                            fontSize: 16,
                            spacing: 1,
                            font: RubikFontBold,
                            newLineAfter: true,
                            color: (0, pdf_utils_1.rgbNormalized)(48, 19, 103),
                        },
                        fieldHeader: {
                            fontSize: 16,
                            font: RubikFont,
                            spacing: 1,
                            color: (0, pdf_utils_1.rgbNormalized)(48, 19, 103),
                        },
                        fieldText: {
                            fontSize: 16,
                            spacing: 6,
                            font: RubikFont,
                            side: 'right',
                            newLineAfter: true,
                        },
                        regularText: {
                            fontSize: 16,
                            spacing: 1,
                            font: RubikFont,
                            newLineAfter: true,
                        },
                        alternativeRegularText: {
                            fontSize: 16,
                            spacing: 1,
                            color: (0, pdf_utils_1.rgbNormalized)(143, 154, 167),
                            font: RubikFont,
                            newLineAfter: true,
                        },
                        smallText: {
                            fontSize: 14,
                            spacing: 1,
                            font: RubikFont,
                            newLineAfter: true,
                        },
                        smallGreyText: {
                            fontSize: 14,
                            spacing: 1,
                            font: RubikFont,
                            newLineAfter: true,
                            color: (0, pdf_utils_1.rgbNormalized)(143, 154, 167),
                        },
                        examCardHeader: {
                            fontSize: 16,
                            spacing: 1,
                            font: RubikFontBold,
                            color: (0, pdf_utils_1.rgbNormalized)(48, 19, 103),
                        },
                        examBoldField: {
                            fontSize: 16,
                            spacing: 5,
                            font: RubikFontBold,
                        },
                        examRegularField: {
                            fontSize: 16,
                            spacing: 5,
                            font: RubikFont,
                        },
                        examProviderComment: {
                            fontSize: 16,
                            spacing: 16,
                            font: RubikFontBold,
                            newLineAfter: true,
                        },
                    };
                    separatedLineStyle = {
                        thickness: 1,
                        color: (0, pdf_utils_1.rgbNormalized)(227, 230, 239),
                        margin: {
                            top: 8,
                            bottom: 8,
                        },
                    };
                    examColorDotsStyle = {
                        width: 10,
                        height: 10,
                    };
                    examExtraItemsSeparatedLineStyle = {
                        thickness: 1,
                        color: (0, pdf_utils_1.rgbNormalized)(244, 246, 248),
                        margin: {
                            right: 200,
                        },
                    };
                    drawBlockHeader = function (text, styles) {
                        var _a;
                        if (styles === void 0) { styles = textStyles.blockHeader; }
                        var headerTextDims = pdfClient.getTextDimensions(text, styles);
                        var regularTextDims = pdfClient.getTextDimensions('a', textStyles.regularText);
                        if (pdfClient.getY() - headerTextDims.height - (styles.newLineAfter ? styles.spacing : 0) - regularTextDims.height <
                            ((_a = pdfClientStyles.initialPage.pageMargins.bottom) !== null && _a !== void 0 ? _a : 0)) {
                            pdfClient.addNewPage(pdfClientStyles.initialPage);
                        }
                        pdfClient.drawText(text, styles);
                    };
                    drawFieldLine = function (name, value) {
                        var leftBound = pdfClient.getLeftBound();
                        var labelWidth = pdfClient.getTextDimensions(name || '', textStyles.fieldHeader).width + 10;
                        pdfClient.drawText(name || '', textStyles.fieldHeader);
                        pdfClient.setLeftBound(leftBound + labelWidth);
                        pdfClient.drawText(value || '', textStyles.fieldText);
                        pdfClient.setLeftBound(leftBound);
                    };
                    separateLine = function () {
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    regularText = function (text, alternativeText) {
                        if (text)
                            pdfClient.drawText(text, textStyles.regularText);
                        else if (alternativeText)
                            pdfClient.drawText(alternativeText, textStyles.alternativeRegularText);
                    };
                    drawExaminationCard = function (cardHeader, cardContent, extraItems, cardComment) {
                        if ((cardContent && cardContent.length > 0) || cardComment) {
                            pdfClient.drawTextSequential(cardHeader, textStyles.examCardHeader);
                            if (cardContent && cardContent.length > 0) {
                                var headerDims = pdfClient.getTextDimensions(cardHeader, textStyles.examCardHeader);
                                pdfClient.setLeftBound(pdfClient.getLeftBound() + headerDims.width);
                                cardContent.forEach(function (item) {
                                    var itemText = " ".concat(item.label, "   ");
                                    var textDimensions = pdfClient.getTextDimensions(itemText, textStyles.examBoldField);
                                    if (textDimensions.width + examColorDotsStyle.width + pdfClient.getX() > pdfClient.getRightBound())
                                        pdfClient.newLine(textDimensions.height + textStyles.examBoldField.spacing);
                                    if (item.abnormal) {
                                        pdfClient.drawImage(redDot, examColorDotsStyle, textStyles.examBoldField);
                                        pdfClient.drawTextSequential(itemText, textStyles.examBoldField);
                                    }
                                    else {
                                        pdfClient.drawImage(greenDot, examColorDotsStyle, textStyles.examRegularField);
                                        pdfClient.drawTextSequential(itemText, textStyles.examRegularField);
                                    }
                                });
                                pdfClient.setLeftBound(pdfClient.getLeftBound() - headerDims.width);
                            }
                            if (extraItems || [].length > 0) {
                                pdfClient.newLine(pdfClient.getTextDimensions('A', textStyles.examRegularField).height + textStyles.examRegularField.spacing);
                                drawExtraItems(extraItems);
                            }
                            else {
                                pdfClient.newLine(pdfClient.getTextDimensions('a', textStyles.examRegularField).height + 2);
                            }
                            if (cardComment)
                                drawExamProviderComment(cardComment);
                        }
                    };
                    drawExamProviderComment = function (comment) {
                        if (!comment) {
                            pdfClient.setY(pdfClient.getY() - 16);
                            return;
                        }
                        // +8 we add as margin between exam cards and comments
                        pdfClient.setY(pdfClient.getY() - 8);
                        pdfClient.drawText(comment, textStyles.examProviderComment);
                    };
                    drawExtraItems = function (extraItems) {
                        if (!extraItems)
                            return;
                        extraItems.forEach(function (item, index) {
                            pdfClient.drawText(item, textStyles.regularText);
                            if (index + 1 < extraItems.length)
                                pdfClient.drawSeparatedLine(examExtraItemsSeparatedLineStyle);
                        });
                    };
                    isFollowup = encounter ? (0, utils_1.isFollowupEncounter)(encounter) : false;
                    drawHeadline = function () {
                        var imgStyles = {
                            width: 110,
                            height: 28,
                        };
                        if (logo)
                            pdfClient.drawImage(logo, imgStyles);
                        var title = isFollowup ? 'Follow-up Visit Note' : 'Visit Note';
                        pdfClient.drawText(title, textStyles.header);
                    };
                    // We can't set this headline in initial styles, so we gonna draw it and add
                    // it as headline for all next pages to set automatically
                    drawHeadline();
                    pageStylesWithHeadline = __assign(__assign({}, pdfClientStyles.initialPage), { setHeadline: drawHeadline });
                    pdfClient.setPageStyles(pageStylesWithHeadline);
                    // --- add all sections to PDF ---
                    // ===============================
                    drawBlockHeader('Patient information');
                    drawFieldLine('Patient name', data.patientName);
                    drawFieldLine('Date of birth', data.patientDOB);
                    if (data.personAccompanying) {
                        drawFieldLine('Person accompanying the minor patient', data.personAccompanying);
                    }
                    if (data.patientPhone) {
                        drawFieldLine('Phone', data.patientPhone);
                    }
                    separateLine();
                    drawBlockHeader('Visit Details');
                    if (isFollowup && encounter) {
                        followupDetails = (0, utils_1.formatFhirEncounterToPatientFollowupDetails)(encounter, data.patientName);
                        followupDateTime = ((_b = encounter.period) === null || _b === void 0 ? void 0 : _b.start)
                            ? new Date(encounter.period.start).toLocaleString()
                            : data.dateOfService;
                        drawFieldLine('Initial visit date', data.dateOfService);
                        drawFieldLine('Follow-up date and time', followupDateTime);
                        if (followupDetails.reason) {
                            drawFieldLine('Reason', followupDetails.reason);
                        }
                        if (followupDetails.reason === 'Other' && followupDetails.otherReason) {
                            drawFieldLine('Other reason', followupDetails.otherReason);
                        }
                        if ((_c = followupDetails.provider) === null || _c === void 0 ? void 0 : _c.name) {
                            drawFieldLine('Follow-up provider', followupDetails.provider.name);
                        }
                        if (followupDetails.location) {
                            drawFieldLine('Location', followupDetails.location.name || '');
                        }
                        if (followupDetails.message) {
                            drawFieldLine('Comment', followupDetails.message);
                        }
                    }
                    else {
                        drawFieldLine('Date of Service', data.dateOfService);
                        drawFieldLine('Reason for Visit', data.reasonForVisit);
                        drawFieldLine('Provider', data.provider);
                        if (data.intakePerson) {
                            drawFieldLine('Intake completed by', data.intakePerson);
                        }
                        drawFieldLine('Signed On', data.signedOn);
                        drawFieldLine('Visit ID', data.visitID);
                        drawFieldLine('Visit State', data.visitState);
                        if (data.insuranceCompany) {
                            drawFieldLine('Insurance Company', data.insuranceCompany);
                        }
                        if (data.insuranceSubscriberId) {
                            drawFieldLine('Subscriber ID', data.insuranceSubscriberId);
                        }
                        drawFieldLine('Address', data.address);
                    }
                    regularText(
                    // Related to a node bug, a second space(good space) was added between the words gave, their to handle a bad space(no space) occurrence
                    'Provider confirmed patient’s name, DOB, introduced themselves, and gave their licensure and credentials.');
                    separateLine();
                    if (!isFollowup) {
                        if (data.chiefComplaint || data.providerTimeSpan) {
                            drawBlockHeader('Chief complaint & History of Present Illness');
                            if (data.chiefComplaint && data.chiefComplaint.length > 0) {
                                regularText(data.chiefComplaint);
                            }
                            if (data.providerTimeSpan && !isInPersonAppointment) {
                                pdfClient.drawText("Provider spent ".concat(data.providerTimeSpan, " minutes on real-time audio & video with this patient"), textStyles.smallGreyText);
                            }
                            separateLine();
                        }
                        if (data.mechanismOfInjury) {
                            drawBlockHeader('Mechanism of Injury');
                            regularText(data.mechanismOfInjury);
                            separateLine();
                        }
                        if (data.reviewOfSystems) {
                            drawBlockHeader('Review of Systems');
                            regularText(data.reviewOfSystems);
                            separateLine();
                        }
                    }
                    if (data.medications || (data.medicationsNotes && data.medicationsNotes.length > 0)) {
                        drawBlockHeader('Medications');
                        if ((_d = data.medications) === null || _d === void 0 ? void 0 : _d.length) {
                            data.medications.forEach(function (medication) {
                                pdfClient.drawText(medication, textStyles.regularText);
                            });
                        }
                        else {
                            pdfClient.drawText('No current medications', textStyles.regularText);
                        }
                        if (data.medicationsNotes && data.medicationsNotes.length > 0) {
                            drawBlockHeader('Medications notes', textStyles.blockSubHeader);
                            data.medicationsNotes.forEach(function (record) {
                                regularText(record);
                            });
                        }
                        separateLine();
                    }
                    if (data.allergies || (data.allergiesNotes && data.allergiesNotes.length > 0)) {
                        drawBlockHeader('Allergies');
                        if ((_e = data.allergies) === null || _e === void 0 ? void 0 : _e.length) {
                            data.allergies.forEach(function (allergy) {
                                pdfClient.drawText(allergy, textStyles.regularText);
                            });
                        }
                        else {
                            pdfClient.drawText('No known allergies', textStyles.regularText);
                        }
                        if (data.allergiesNotes && data.allergiesNotes.length > 0) {
                            drawBlockHeader('Allergies notes', textStyles.blockSubHeader);
                            data.allergiesNotes.forEach(function (record) {
                                regularText(record);
                            });
                        }
                        separateLine();
                    }
                    if (data.medicalConditions || (data.medicalConditionsNotes && data.medicalConditionsNotes.length > 0)) {
                        drawBlockHeader('Medical Conditions');
                        if ((_f = data.medicalConditions) === null || _f === void 0 ? void 0 : _f.length) {
                            data.medicalConditions.forEach(function (medicalCondition) {
                                pdfClient.drawText(medicalCondition, textStyles.regularText);
                            });
                        }
                        else {
                            pdfClient.drawText('No known medical conditions', textStyles.regularText);
                        }
                        if (data.medicalConditionsNotes && data.medicalConditionsNotes.length > 0) {
                            drawBlockHeader('Medical conditions notes', textStyles.blockSubHeader);
                            data.medicalConditionsNotes.forEach(function (record) {
                                regularText(record);
                            });
                        }
                        separateLine();
                    }
                    if (data.surgicalHistory || (data.surgicalHistoryNotes && data.surgicalHistoryNotes.length > 0)) {
                        drawBlockHeader('Surgical history');
                        if ((_g = data.surgicalHistory) === null || _g === void 0 ? void 0 : _g.length) {
                            data.surgicalHistory.forEach(function (record) {
                                regularText(record);
                            });
                        }
                        else {
                            regularText('No surgical history');
                        }
                        if (data.surgicalHistoryNotes && data.surgicalHistoryNotes.length > 0) {
                            drawBlockHeader('Surgical history notes', textStyles.blockSubHeader);
                            data.surgicalHistoryNotes.forEach(function (record) {
                                regularText(record);
                            });
                        }
                        separateLine();
                    }
                    if (data.hospitalization || (data.hospitalizationNotes && data.hospitalizationNotes.length > 0)) {
                        drawBlockHeader('Hospitalization');
                        if ((_h = data.hospitalization) === null || _h === void 0 ? void 0 : _h.length) {
                            data.hospitalization.forEach(function (record) {
                                regularText(record);
                            });
                        }
                        else {
                            regularText('No hospitalizations');
                        }
                        if (data.hospitalizationNotes && data.hospitalizationNotes.length > 0) {
                            drawBlockHeader('Hospitalization notes', textStyles.blockSubHeader);
                            data.hospitalizationNotes.forEach(function (record) {
                                regularText(record);
                            });
                        }
                        separateLine();
                    }
                    if ((data.inHouseMedications && data.inHouseMedications.length > 0) ||
                        (data.inHouseMedicationsNotes && data.inHouseMedicationsNotes.length > 0)) {
                        drawBlockHeader('In-House Medications');
                        if ((_j = data.inHouseMedications) === null || _j === void 0 ? void 0 : _j.length) {
                            data.inHouseMedications.forEach(function (record) {
                                regularText(record);
                            });
                        }
                        else {
                            regularText('No in-house medications');
                        }
                        if (data.inHouseMedicationsNotes && data.inHouseMedicationsNotes.length > 0) {
                            drawBlockHeader('In-House Medications notes', textStyles.blockSubHeader);
                            data.inHouseMedicationsNotes.forEach(function (record) {
                                regularText(record);
                            });
                        }
                        separateLine();
                    }
                    if (data.immunizationOrders && data.immunizationOrders.length > 0) {
                        drawBlockHeader('Immunization');
                        data.immunizationOrders.forEach(function (record) {
                            regularText(record);
                        });
                        separateLine();
                    }
                    return [4 /*yield*/, pdfClient.embedImage(fs_1.default.readFileSync('./assets/inconclusive.png'))];
                case 9:
                    inconclusiveIcon = _6.sent();
                    return [4 /*yield*/, pdfClient.embedImage(fs_1.default.readFileSync('./assets/abnormal.png'))];
                case 10:
                    abnormalIcon = _6.sent();
                    return [4 /*yield*/, pdfClient.embedImage(fs_1.default.readFileSync('./assets/normal.png'))];
                case 11:
                    normalIcon = _6.sent();
                    regularTextNoLineAfter = __assign(__assign({}, textStyles.regularText), { newLineAfter: false });
                    getFlagsExcludingNeutral = function (flags) {
                        return flags.filter(function (flag) { return flag !== utils_1.NonNormalResult.Neutral; });
                    };
                    getCurBounds = function () { return ({
                        leftBound: pdfClient.getX(),
                        rightBound: pdfClient.getRightBound(),
                    }); };
                    drawResultFlags = function (nonNormalResultContained, labType) {
                        var resultFlagIconStyle = __assign(__assign({}, pdf_consts_1.ICON_STYLE), { margin: { left: 5, right: 5 } });
                        if (nonNormalResultContained && nonNormalResultContained.length > 0) {
                            var flagsExcludingNeutral_1 = getFlagsExcludingNeutral(nonNormalResultContained);
                            if (flagsExcludingNeutral_1 === null || flagsExcludingNeutral_1 === void 0 ? void 0 : flagsExcludingNeutral_1.length) {
                                flagsExcludingNeutral_1.forEach(function (flag, idx) {
                                    var lastFlag = (flagsExcludingNeutral_1 === null || flagsExcludingNeutral_1 === void 0 ? void 0 : flagsExcludingNeutral_1.length) === idx + 1;
                                    var style = lastFlag ? textStyles.regularText : regularTextNoLineAfter;
                                    if (flag === utils_1.NonNormalResult.Abnormal) {
                                        pdfClient.drawImage(abnormalIcon, resultFlagIconStyle, regularTextNoLineAfter);
                                        pdfClient.drawTextSequential('Abnormal', __assign(__assign({}, style), { color: (0, pdf_utils_1.rgbNormalized)(237, 108, 2) }), getCurBounds());
                                    }
                                    else if (flag === utils_1.NonNormalResult.Inconclusive) {
                                        pdfClient.drawImage(inconclusiveIcon, resultFlagIconStyle, regularTextNoLineAfter);
                                        pdfClient.drawTextSequential('Inconclusive', __assign(__assign({}, style), { color: (0, pdf_utils_1.rgbNormalized)(117, 117, 117) }), getCurBounds());
                                    }
                                });
                            }
                        }
                        else if (labType === 'inhouse') {
                            // too hairy to assume normal results for external labs so we will only do this for inhouse
                            pdfClient.drawImage(normalIcon, resultFlagIconStyle, regularTextNoLineAfter);
                            pdfClient.drawTextSequential('Normal', __assign(__assign({}, textStyles.regularText), { color: (0, pdf_utils_1.rgbNormalized)(46, 125, 50) }), getCurBounds());
                        }
                    };
                    getTestNameTextStyle = function (nonNormalResultContained, labType) {
                        // results are normal, no flags
                        if (!nonNormalResultContained) {
                            if (labType === 'inhouse') {
                                // there will be a normal flag therefore the test name should not have a new line after it is written
                                return regularTextNoLineAfter;
                            }
                            else {
                                // no normal flag therefore the test name should have a new line after it is written
                                return textStyles.regularText;
                            }
                        }
                        var flagsExcludingNeutral = getFlagsExcludingNeutral(nonNormalResultContained);
                        if (flagsExcludingNeutral.length > 0) {
                            // results have a flag to display therefore the test name should not have a new line after it is written
                            return regularTextNoLineAfter;
                        }
                        else {
                            // no flags for neutral tests, new line after test name
                            return textStyles.regularText;
                        }
                    };
                    drawInHouseLabs = function () {
                        var _a, _b, _c, _d;
                        pdfClient.drawText('In-House Labs', textStyles.subHeader);
                        if ((_a = data.inHouseLabs) === null || _a === void 0 ? void 0 : _a.orders.length) {
                            pdfClient.drawText('Orders:', textStyles.subHeader);
                            (_b = data.inHouseLabs) === null || _b === void 0 ? void 0 : _b.orders.forEach(function (order) {
                                pdfClient.drawText(order.testItemName, textStyles.regularText);
                            });
                        }
                        if ((_c = data.inHouseLabs) === null || _c === void 0 ? void 0 : _c.results.length) {
                            pdfClient.drawText('Results:', textStyles.subHeader);
                            (_d = data.inHouseLabs) === null || _d === void 0 ? void 0 : _d.results.forEach(function (result) {
                                var testNameTextStyle = getTestNameTextStyle(result.nonNormalResultContained, 'inhouse');
                                pdfClient.drawTextSequential(result.name, testNameTextStyle, {
                                    leftBound: pdfClient.getLeftBound(),
                                    rightBound: pdfClient.getRightBound(),
                                });
                                drawResultFlags(result.nonNormalResultContained, 'inhouse');
                            });
                        }
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawExternalLabs = function () {
                        var _a, _b, _c, _d;
                        pdfClient.drawText('External Labs', textStyles.subHeader);
                        if ((_a = data.externalLabs) === null || _a === void 0 ? void 0 : _a.orders.length) {
                            pdfClient.drawText('Orders:', textStyles.subHeader);
                            (_b = data.externalLabs) === null || _b === void 0 ? void 0 : _b.orders.forEach(function (order) {
                                pdfClient.drawText(order.testItemName, textStyles.regularText);
                            });
                        }
                        if ((_c = data.externalLabs) === null || _c === void 0 ? void 0 : _c.results.length) {
                            pdfClient.drawText('Results:', textStyles.subHeader);
                            (_d = data.externalLabs) === null || _d === void 0 ? void 0 : _d.results.forEach(function (result) {
                                var testNameTextStyle = getTestNameTextStyle(result.nonNormalResultContained, 'external');
                                pdfClient.drawTextSequential(result.name, testNameTextStyle, {
                                    leftBound: pdfClient.getLeftBound(),
                                    rightBound: pdfClient.getRightBound(),
                                });
                                drawResultFlags(result.nonNormalResultContained, 'external');
                            });
                        }
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    if (((_k = data.inHouseLabs) === null || _k === void 0 ? void 0 : _k.orders.length) || ((_l = data.inHouseLabs) === null || _l === void 0 ? void 0 : _l.results.length))
                        drawInHouseLabs();
                    if (((_m = data.externalLabs) === null || _m === void 0 ? void 0 : _m.orders.length) || ((_o = data.externalLabs) === null || _o === void 0 ? void 0 : _o.results.length))
                        drawExternalLabs();
                    if (!isFollowup) {
                        if ((((_p = data.screening) === null || _p === void 0 ? void 0 : _p.additionalQuestions) && Object.keys(data.screening.additionalQuestions).length > 0) ||
                            ((_q = data.screening) === null || _q === void 0 ? void 0 : _q.currentASQ) ||
                            (((_r = data.screening) === null || _r === void 0 ? void 0 : _r.notes) && data.screening.notes.length > 0)) {
                            drawBlockHeader('Additional questions');
                            if ((_s = data.screening) === null || _s === void 0 ? void 0 : _s.additionalQuestions) {
                                (0, utils_1.renderScreeningQuestionsForPDF)(data.screening.additionalQuestions, function (question, formattedValue) {
                                    regularText("".concat(question, " - ").concat(formattedValue));
                                });
                            }
                            if ((_t = data.screening) === null || _t === void 0 ? void 0 : _t.currentASQ) {
                                regularText("ASQ - ".concat(data.screening.currentASQ));
                            }
                            if (((_u = data.screening) === null || _u === void 0 ? void 0 : _u.notes) && data.screening.notes.length > 0) {
                                drawBlockHeader('Screening notes', textStyles.blockSubHeader);
                                data.screening.notes.forEach(function (record) {
                                    regularText(record);
                                });
                            }
                            separateLine();
                        }
                        if (data.intakeNotes && data.intakeNotes.length > 0) {
                            drawBlockHeader('Intake notes');
                            data.intakeNotes.forEach(function (record) {
                                regularText(record);
                            });
                            separateLine();
                        }
                        if (data.vitals && ((_v = Object.values(data.vitals).filter(function (arr) { return arr && arr.length > 0; })) !== null && _v !== void 0 ? _v : []).length > 0) {
                            drawBlockHeader('Vitals');
                            vitalLabelMapper_1 = (_a = {},
                                _a[utils_1.VitalFieldNames.VitalTemperature] = 'Temperature',
                                _a[utils_1.VitalFieldNames.VitalHeartbeat] = 'Heartbeat',
                                _a[utils_1.VitalFieldNames.VitalRespirationRate] = 'Respiration rate',
                                _a[utils_1.VitalFieldNames.VitalBloodPressure] = 'Blood pressure',
                                _a[utils_1.VitalFieldNames.VitalOxygenSaturation] = 'Oxygen saturation',
                                _a[utils_1.VitalFieldNames.VitalWeight] = 'Weight',
                                _a[utils_1.VitalFieldNames.VitalHeight] = 'Height',
                                _a[utils_1.VitalFieldNames.VitalVision] = 'Vision',
                                _a.notes = 'Vitals notes',
                                _a);
                            Object.keys(vitalLabelMapper_1)
                                .filter(function (name) { var _a, _b; return ((_a = data.vitals) === null || _a === void 0 ? void 0 : _a[name]) && ((_b = data.vitals) === null || _b === void 0 ? void 0 : _b[name].length) > 0; })
                                .forEach(function (vitalName) {
                                var _a, _b;
                                drawBlockHeader(vitalLabelMapper_1[vitalName], textStyles.blockSubHeader);
                                (_b = (_a = data.vitals) === null || _a === void 0 ? void 0 : _a[vitalName]) === null || _b === void 0 ? void 0 : _b.forEach(function (record) {
                                    regularText(record);
                                });
                            });
                            separateLine();
                        }
                    }
                    if (!isFollowup) {
                        drawBlockHeader('Examination');
                        examination = data.examination;
                        if (examination && Object.keys(examination).length > 0) {
                            Object.entries(examination).forEach(function (_a) {
                                var sectionKey = _a[0], section = _a[1];
                                if (section.items && section.items.length > 0) {
                                    var sectionLabel = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
                                    drawExaminationCard("".concat(sectionLabel, ":   "), section.items, undefined, section.comment);
                                }
                                else if (section.comment) {
                                    // If there are no items but there's a comment, still show the section
                                    var sectionLabel = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
                                    drawExaminationCard("".concat(sectionLabel, ":   "), [], undefined, section.comment);
                                }
                            });
                        }
                        separateLine();
                        if ((_w = data.assessment) === null || _w === void 0 ? void 0 : _w.primary) {
                            drawBlockHeader('Assessment');
                            drawBlockHeader('Primary:', textStyles.blockSubHeader);
                            regularText((_x = data.assessment) === null || _x === void 0 ? void 0 : _x.primary);
                            if (((_y = data.assessment) === null || _y === void 0 ? void 0 : _y.secondary.length) > 0) {
                                drawBlockHeader('Secondary:', textStyles.blockSubHeader);
                                (_z = data.assessment) === null || _z === void 0 ? void 0 : _z.secondary.forEach(function (assessment) {
                                    regularText(assessment);
                                });
                            }
                            separateLine();
                        }
                        if (data.medicalDecision) {
                            drawBlockHeader('Medical Decision Making');
                            regularText(data.medicalDecision);
                            separateLine();
                        }
                        if (data.emCode) {
                            drawBlockHeader('E&M code');
                            regularText(data.emCode, 'No E&M code provided.');
                            separateLine();
                        }
                        if (data.cptCodes && data.cptCodes.length > 0) {
                            drawBlockHeader('CPT codes');
                            data.cptCodes.forEach(function (cptCode) {
                                regularText(cptCode);
                            });
                            separateLine();
                        }
                    }
                    if (data.procedures && data.procedures.length > 0) {
                        drawBlockHeader('Procedures');
                        data.procedures.forEach(function (procedure) {
                            var _a;
                            drawBlockHeader((_a = procedure.procedureType) !== null && _a !== void 0 ? _a : '', textStyles.blockSubHeader);
                            regularText(procedure.cptCodes != null && procedure.cptCodes.length > 0
                                ? 'CPT: ' + procedure.cptCodes.join('; ')
                                : undefined);
                            regularText(procedure.diagnoses != null && procedure.diagnoses.length > 0
                                ? 'Dx: ' + procedure.diagnoses.join('; ')
                                : undefined);
                            regularText(procedure.procedureDateTime != null
                                ? 'Date and time of the procedure: ' + procedure.procedureDateTime
                                : undefined);
                            regularText(procedure.performerType != null ? 'Performed by: ' + procedure.performerType : undefined);
                            regularText(procedure.medicationUsed != null ? 'Anaesthesia / medication used: ' + procedure.medicationUsed : undefined);
                            regularText(procedure.bodySite != null ? 'Site/location: ' + procedure.bodySite : undefined);
                            regularText(procedure.bodySide != null ? 'Side of body: ' + procedure.bodySide : undefined);
                            regularText(procedure.technique != null ? 'Technique: ' + procedure.technique : undefined);
                            regularText(procedure.suppliesUsed != null ? 'Instruments / supplies used: ' + procedure.suppliesUsed : undefined);
                            regularText(procedure.procedureDetails != null ? 'Procedure details: ' + procedure.procedureDetails : undefined);
                            regularText(procedure.specimenSent != null ? 'Specimen sent: ' + procedure.specimenSent : undefined);
                            regularText(procedure.complications != null ? 'Complications: ' + procedure.complications : undefined);
                            regularText(procedure.patientResponse != null ? 'Patient response: ' + procedure.patientResponse : undefined);
                            regularText(procedure.postInstructions != null ? 'Post-procedure instructions: ' + procedure.postInstructions : undefined);
                            regularText(procedure.timeSpent != null ? 'Time spent: ' + procedure.timeSpent : undefined);
                            regularText(procedure.documentedBy != null ? 'Documented by: ' + procedure.documentedBy : undefined);
                        });
                        separateLine();
                    }
                    if (data.prescriptions && data.prescriptions.length > 0) {
                        drawBlockHeader('Prescriptions');
                        data.prescriptions.forEach(function (prescription) {
                            regularText(prescription);
                        });
                        separateLine();
                    }
                    // drawBlockHeader('General patient education documents');
                    // regularText('To be implemented');
                    // separateLine();
                    if (data.disposition.text ||
                        ((_0 = data.disposition) === null || _0 === void 0 ? void 0 : _0[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD]) ||
                        data.disposition.labService ||
                        data.disposition.virusTest ||
                        data.disposition.followUpIn ||
                        data.disposition.reason ||
                        (data.subSpecialtyFollowUp && data.subSpecialtyFollowUp.length > 0) ||
                        (data.workSchoolExcuse && data.workSchoolExcuse.length > 0)) {
                        drawBlockHeader('Plan');
                        if (data.patientInstructions && data.patientInstructions.length > 0) {
                            drawBlockHeader('Patient instructions', textStyles.blockSubHeader);
                            data.patientInstructions.forEach(function (instruction) {
                                regularText(instruction);
                            });
                            separateLine();
                        }
                        if (data.disposition.text ||
                            ((_1 = data.disposition) === null || _1 === void 0 ? void 0 : _1[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD]) ||
                            data.disposition.labService ||
                            data.disposition.virusTest ||
                            data.disposition.followUpIn ||
                            data.disposition.reason) {
                            drawBlockHeader(data.disposition.header, textStyles.blockSubHeader);
                            if (data.disposition.text) {
                                regularText(data.disposition.text);
                            }
                            if ((_2 = data.disposition) === null || _2 === void 0 ? void 0 : _2[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD]) {
                                regularText(utils_1.NOTHING_TO_EAT_OR_DRINK_LABEL);
                            }
                            if (data.disposition.labService) {
                                regularText("Lab Services: ".concat(data.disposition.labService));
                            }
                            if (data.disposition.virusTest) {
                                regularText("Virus Tests: ".concat(data.disposition.virusTest));
                            }
                            if (typeof data.disposition.followUpIn === 'number') {
                                regularText("Follow-up visit ".concat(data.disposition.followUpIn === 0
                                    ? (_3 = utils_1.followUpInOptions.find(function (option) { return option.value === data.disposition.followUpIn; })) === null || _3 === void 0 ? void 0 : _3.label
                                    : "in ".concat((_4 = utils_1.followUpInOptions.find(function (option) { return option.value === data.disposition.followUpIn; })) === null || _4 === void 0 ? void 0 : _4.label)));
                            }
                            if (data.disposition.reason) {
                                regularText("Reason for transfer: ".concat(data.disposition.reason));
                            }
                            separateLine();
                        }
                        if (data.subSpecialtyFollowUp && data.subSpecialtyFollowUp.length > 0) {
                            drawBlockHeader('Subspecialty follow-up', textStyles.blockSubHeader);
                            data.subSpecialtyFollowUp.forEach(function (followUp) {
                                regularText(followUp);
                            });
                            separateLine();
                        }
                        if (data.workSchoolExcuse && data.workSchoolExcuse.length > 0) {
                            drawBlockHeader('School / Work Excuse', textStyles.blockSubHeader);
                            data.workSchoolExcuse.forEach(function (item) {
                                regularText(item);
                            });
                            separateLine();
                        }
                        if (data.addendumNote) {
                            drawBlockHeader('Addendum', textStyles.blockSubHeader);
                            regularText(data.addendumNote);
                        }
                    }
                    if (isFollowup && encounter) {
                        completedDateTime = ((_5 = encounter.period) === null || _5 === void 0 ? void 0 : _5.end)
                            ? new Date(encounter.period.end).toLocaleString()
                            : new Date().toLocaleString();
                        drawFieldLine('Follow-up completed', completedDateTime);
                    }
                    return [4 /*yield*/, pdfClient.save()];
                case 12: return [2 /*return*/, _6.sent()];
            }
        });
    });
}
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
function createVisitNotePDF(input, patient, secrets, token, isInPersonAppointment, encounter) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfBytes, bucketName, fileName, baseFileUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!patient.id) {
                        throw new Error('No patient id found for consent items');
                    }
                    console.log('Creating pdf bytes');
                    return [4 /*yield*/, createVisitNotePdfBytes(input, isInPersonAppointment, encounter).catch(function (error) {
                            throw new Error('failed creating pdfBytes: ' + error.message);
                        })];
                case 1:
                    pdfBytes = _a.sent();
                    console.debug("Created visit note pdf bytes");
                    bucketName = utils_1.BUCKET_NAMES.VISIT_NOTES;
                    fileName = 'VisitNote.pdf';
                    console.log('Creating base file url');
                    baseFileUrl = (0, presigned_file_urls_1.makeZ3Url)({ secrets: secrets, bucketName: bucketName, patientID: patient.id, fileName: fileName });
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
