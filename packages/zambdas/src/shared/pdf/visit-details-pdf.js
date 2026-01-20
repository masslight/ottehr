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
exports.createVisitDetailsPdf = void 0;
var utils_1 = require("utils");
var pdf_common_1 = require("./pdf-common");
var pdf_utils_1 = require("./pdf-utils");
var sections_1 = require("./sections");
var primaryCarePhysician_1 = require("./sections/primaryCarePhysician");
var composeVisitDetailsData = function (input) {
    var patient = input.patient, emergencyContactResource = input.emergencyContactResource, employerOrganization = input.employerOrganization, appointment = input.appointment, encounter = input.encounter, location = input.location, timezone = input.timezone, physician = input.physician, pharmacy = input.pharmacy, coverages = input.coverages, insuranceOrgs = input.insuranceOrgs, guarantorResource = input.guarantorResource, documents = input.documents, consents = input.consents, questionnaireResponse = input.questionnaireResponse, payments = input.payments;
    return {
        patient: (0, sections_1.composePatientData)({ patient: patient, appointment: appointment }),
        visit: (0, sections_1.composeVisitData)({ appointment: appointment, location: location, timezone: timezone }),
        contact: (0, sections_1.composeContactData)({ patient: patient, appointment: appointment }),
        details: (0, sections_1.composePatientDetailsData)({ patient: patient }),
        pcp: (0, primaryCarePhysician_1.composePrimaryCarePhysicianData)({ physician: physician }),
        pharmacy: (0, sections_1.composePharmacyData)(pharmacy),
        insurances: (0, sections_1.composeInsuranceData)({ coverages: coverages, insuranceOrgs: insuranceOrgs }),
        responsibleParty: (0, sections_1.composeResponsiblePartyData)({ guarantorResource: guarantorResource }),
        consentForms: (0, sections_1.composeConsentFormsData)({ encounter: encounter, consents: consents, questionnaireResponse: questionnaireResponse, timezone: timezone }),
        documents: (0, sections_1.composeDocumentsData)(documents),
        emergencyContact: (0, sections_1.composeEmergencyContactData)({ emergencyContactResource: emergencyContactResource }),
        employer: (0, sections_1.composeEmployerData)({ employer: employerOrganization }),
        paymentHistory: (0, sections_1.composePatientPaymentsData)({ payments: payments }),
    };
};
var visitDetailsAssetPaths = {
    fonts: {
        regular: './assets/Rubik-Regular.otf',
        bold: './assets/Rubik-Medium.ttf',
    },
};
var createVisitDetailsStyles = function (assets) { return ({
    textStyles: {
        header: {
            fontSize: 16,
            font: assets.fonts.bold,
            side: 'right',
            spacing: 5,
            newLineAfter: true,
        },
        subHeader: {
            fontSize: 14,
            font: assets.fonts.bold,
            spacing: 5,
            newLineAfter: true,
        },
        regular: {
            fontSize: 11,
            font: assets.fonts.regular,
            spacing: 2,
            newLineAfter: true,
        },
        patientName: {
            fontSize: 16,
            font: assets.fonts.bold,
            spacing: 5,
            newLineAfter: true,
        },
    },
    lineStyles: {
        separator: {
            thickness: 1,
            color: (0, pdf_utils_1.rgbNormalized)(227, 230, 239),
            margin: { top: 8, bottom: 8 },
        },
    },
}); };
var visitDetailsRenderConfig = {
    header: {
        title: 'VISIT DETAILS',
        leftSection: (0, sections_1.createPatientHeader)(),
        rightSection: (0, sections_1.createVisitInfoSection)(),
    },
    assetPaths: visitDetailsAssetPaths,
    styleFactory: createVisitDetailsStyles,
    sections: [
        __assign(__assign({}, (0, sections_1.createPatientInfoSection)()), { preferredWidth: 'column' }),
        __assign(__assign({}, (0, sections_1.createPrimaryInsuranceSection)()), { preferredWidth: 'column' }),
        __assign(__assign({}, (0, sections_1.createContactInfoSection)()), { preferredWidth: 'column' }),
        __assign(__assign({}, (0, sections_1.createPharmacyFormsSection)()), { preferredWidth: 'column' }),
        __assign(__assign({}, (0, sections_1.createSecondaryInsuranceSection)()), { preferredWidth: 'column' }),
        __assign(__assign({}, (0, sections_1.createPatientDetailsSection)()), { preferredWidth: 'column' }),
        __assign(__assign({}, (0, primaryCarePhysician_1.createPrimaryCarePhysicianSection)()), { preferredWidth: 'column' }),
        __assign(__assign({}, (0, sections_1.createResponsiblePartySection)()), { preferredWidth: 'column' }),
        __assign(__assign({}, (0, sections_1.createEmployerInfoSection)()), { preferredWidth: 'column' }),
        __assign(__assign({}, (0, sections_1.createEmergencyContactInfoSection)()), { preferredWidth: 'column' }),
        __assign(__assign({}, (0, sections_1.createConsentFormsSection)()), { preferredWidth: 'column' }),
        __assign(__assign({}, (0, sections_1.createPatientPaymentsSection)()), { preferredWidth: 'column' }),
        (0, sections_1.createDocumentsSection)(),
    ],
};
var createVisitDetailsPdf = function (input, secrets, token) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (0, pdf_common_1.generatePdf)(input, composeVisitDetailsData, visitDetailsRenderConfig, {
                patientId: input.patient.id,
                fileName: 'VisitDetails.pdf',
                bucketName: utils_1.BUCKET_NAMES.VISIT_NOTES,
            }, secrets, token)];
    });
}); };
exports.createVisitDetailsPdf = createVisitDetailsPdf;
