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
var test_1 = require("@playwright/test");
var luxon_1 = require("luxon");
var CssHeader_1 = require("tests/e2e/page/CssHeader");
var utils_1 = require("utils");
var constants_1 = require("../../../e2e-utils/resource/constants");
var resource_handler_1 = require("../../../e2e-utils/resource-handler");
var InPersonAssessmentPage_1 = require("../../page/in-person/InPersonAssessmentPage");
var InPersonProgressNotePage_1 = require("../../page/in-person/InPersonProgressNotePage");
var PatientInfo_1 = require("../../page/PatientInfo");
var VisitsPage_1 = require("../../page/VisitsPage");
// cSpell:disable-next inversus
var DIAGNOSIS = 'Situs inversus';
var EM_CODE = '99201 New Patient - E/M Level 1';
test_1.test.describe('Book appointment', function () { return __awaiter(void 0, void 0, void 0, function () {
    var PROCESS_ID, resourceHandler;
    return __generator(this, function (_a) {
        PROCESS_ID = "inPersonVisitMainFlow.spec.ts-".concat(luxon_1.DateTime.now().toMillis());
        resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID);
        test_1.test.beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(process.env.INTEGRATION_TEST === 'true')) return [3 /*break*/, 2];
                        return [4 /*yield*/, resourceHandler.setResourcesFast()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 2: return [4 /*yield*/, resourceHandler.setResources()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        }); });
        test_1.test.afterEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, resourceHandler.cleanupResources()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Book appointment, start and complete Intake, check statuses', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var patientInfoPage;
            var page = _b.page;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, intakeTestAppointment(page, resourceHandler)];
                    case 1:
                        patientInfoPage = _c.sent();
                        return [4 /*yield*/, patientInfoPage.cssHeader().verifyStatus('intake')];
                    case 2:
                        _c.sent();
                        return [4 /*yield*/, patientInfoPage.sideMenu().clickCompleteIntakeButton()];
                    case 3:
                        _c.sent();
                        return [4 /*yield*/, patientInfoPage.cssHeader().verifyStatus('ready for provider')];
                    case 4:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Book appointment, go to Hospitalization page and complete Intake, check statuses', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var patientInfoPage, hospitalizationPage;
            var page = _b.page;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, intakeTestAppointment(page, resourceHandler)];
                    case 1:
                        patientInfoPage = _c.sent();
                        return [4 /*yield*/, patientInfoPage.sideMenu().clickHospitalization()];
                    case 2:
                        hospitalizationPage = _c.sent();
                        return [4 /*yield*/, hospitalizationPage.clickCompleteIntakeButton()];
                    case 3:
                        _c.sent();
                        return [4 /*yield*/, patientInfoPage.cssHeader().verifyStatus('ready for provider')];
                    case 4:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Book appointment,fill required fields for signing the visit, review and sign progress note', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var page = _b.page;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, BookAppointmentFillInfoSignProgressNote(page, resourceHandler)];
                    case 1:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
test_1.test.describe('Book appointment filling insurances information on payment option step', function () { return __awaiter(void 0, void 0, void 0, function () {
    var insuranceCarrier1, insuranceCarrier2, subProcessId, resourceHandler;
    return __generator(this, function (_a) {
        test_1.test.beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
            var oystehr, insuranceCarriersOptionsResponse, insuranceCarriersOptions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, resource_handler_1.ResourceHandler.getOystehr()];
                    case 1:
                        oystehr = _a.sent();
                        return [4 /*yield*/, oystehr.zambda.execute({
                                id: process.env.GET_ANSWER_OPTIONS_ZAMBDA_ID,
                                answerSource: {
                                    resourceType: 'InsurancePlan',
                                    query: "status=active&_tag=".concat(utils_1.INSURANCE_PLAN_PAYER_META_TAG_CODE),
                                },
                            })];
                    case 2:
                        insuranceCarriersOptionsResponse = _a.sent();
                        insuranceCarriersOptions = (0, utils_1.chooseJson)(insuranceCarriersOptionsResponse);
                        insuranceCarrier1 = insuranceCarriersOptions.at(0);
                        insuranceCarrier2 = insuranceCarriersOptions.at(1);
                        return [2 /*return*/];
                }
            });
        }); });
        subProcessId = "inPersonVisitMainFlow.spec.ts-SUB-".concat(luxon_1.DateTime.now().toMillis());
        resourceHandler = new resource_handler_1.ResourceHandler(subProcessId, 'in-person', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var patientInfo = _b.patientInfo;
            return __generator(this, function (_c) {
                return [2 /*return*/, [
                        (0, utils_1.getContactInformationAnswers)({
                            firstName: patientInfo.firstName,
                            lastName: patientInfo.lastName,
                            birthDate: (0, utils_1.isoToDateObject)(patientInfo.dateOfBirth || '') || undefined,
                            email: patientInfo.email,
                            phoneNumber: patientInfo.phoneNumber,
                            birthSex: patientInfo.sex,
                        }),
                        (0, utils_1.getPatientDetailsStepAnswers)({}),
                        (0, utils_1.getPaymentOptionInsuranceAnswers)({
                            insuranceCarrier: insuranceCarrier1,
                            insuranceMemberId: resource_handler_1.PATIENT_INSURANCE_MEMBER_ID,
                            insurancePolicyHolderFirstName: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME,
                            insurancePolicyHolderLastName: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME,
                            insurancePolicyHolderMiddleName: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME,
                            insurancePolicyHolderDateOfBirth: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH,
                            insurancePolicyHolderBirthSex: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX,
                            insurancePolicyHolderAddressAsPatient: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_AS_PATIENT,
                            insurancePolicyHolderAddress: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS,
                            insurancePolicyHolderAddressAdditionalLine: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE,
                            insurancePolicyHolderCity: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_CITY,
                            insurancePolicyHolderState: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_STATE,
                            insurancePolicyHolderZip: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_ZIP,
                            insurancePolicyHolderRelationshipToInsured: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED,
                            insuranceCarrier2: insuranceCarrier2,
                            insuranceMemberId2: resource_handler_1.PATIENT_INSURANCE_MEMBER_ID,
                            insurancePolicyHolderFirstName2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME,
                            insurancePolicyHolderLastName2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME,
                            insurancePolicyHolderMiddleName2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME,
                            insurancePolicyHolderDateOfBirth2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH,
                            insurancePolicyHolderBirthSex2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX,
                            insurancePolicyHolderAddressAsPatient2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_AS_PATIENT,
                            insurancePolicyHolderAddress2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS,
                            insurancePolicyHolderAddressAdditionalLine2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE,
                            insurancePolicyHolderCity2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_CITY,
                            insurancePolicyHolderState2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_STATE,
                            insurancePolicyHolderZip2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP,
                            insurancePolicyHolderRelationshipToInsured2: resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED,
                        }),
                        (0, utils_1.getResponsiblePartyStepAnswers)({}),
                        (0, utils_1.getConsentStepAnswers)({}),
                    ]];
            });
        }); });
        test_1.test.beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(process.env.INTEGRATION_TEST === 'true')) return [3 /*break*/, 2];
                        return [4 /*yield*/, resourceHandler.setResourcesFast()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, resourceHandler.setResources()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        test_1.test.afterEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, resourceHandler.cleanupResources()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Book appointment, fill required fields for signing the visit, review and sign progress note', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var page = _b.page;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, BookAppointmentFillInfoSignProgressNote(page, resourceHandler)];
                    case 1:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
function intakeTestAppointment(page, resourceHandler) {
    return __awaiter(this, void 0, void 0, function () {
        var visitsPage, cssHeader;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, VisitsPage_1.openVisitsPage)(page)];
                case 1:
                    visitsPage = _a.sent();
                    return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, visitsPage.clickPrebookedTab()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, visitsPage.clickArrivedButton(resourceHandler.appointment.id)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, visitsPage.clickInOfficeTab()];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, visitsPage.clickIntakeButton(resourceHandler.appointment.id)];
                case 6:
                    _a.sent();
                    cssHeader = new CssHeader_1.CssHeader(page);
                    return [4 /*yield*/, cssHeader.selectIntakePractitioner()];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, cssHeader.selectProviderPractitioner()];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, (0, PatientInfo_1.expectPatientInfoPage)(resourceHandler.appointment.id, page)];
                case 9: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function BookAppointmentFillInfoSignProgressNote(page, resourceHandler) {
    return __awaiter(this, void 0, void 0, function () {
        var patientInfoPage, progressNotePage, assessmentPage, visitsPage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, intakeTestAppointment(page, resourceHandler)];
                case 2:
                    patientInfoPage = _a.sent();
                    return [4 /*yield*/, patientInfoPage.sideMenu().clickCompleteIntakeButton()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, patientInfoPage.cssHeader().clickSwitchModeButton('provider')];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, patientInfoPage.cssHeader().changeStatus('provider')];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, (0, InPersonProgressNotePage_1.expectInPersonProgressNotePage)(page)];
                case 6:
                    progressNotePage = _a.sent();
                    return [4 /*yield*/, progressNotePage.verifyReviewAndSignButtonDisabled()];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, patientInfoPage.sideMenu().clickAssessment()];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, (0, InPersonAssessmentPage_1.expectAssessmentPage)(page)];
                case 9:
                    assessmentPage = _a.sent();
                    return [4 /*yield*/, assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS })];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, assessmentPage.selectEmCode(EM_CODE)];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, patientInfoPage.sideMenu().clickProgressNote()];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, progressNotePage.clickDischargeButton()];
                case 13:
                    _a.sent();
                    return [4 /*yield*/, progressNotePage.clickReviewAndSignButton()];
                case 14:
                    _a.sent();
                    return [4 /*yield*/, progressNotePage.clickSignButton()];
                case 15:
                    _a.sent();
                    return [4 /*yield*/, patientInfoPage.cssHeader().verifyStatus('completed')];
                case 16:
                    _a.sent();
                    return [4 /*yield*/, (0, VisitsPage_1.openVisitsPage)(page)];
                case 17:
                    visitsPage = _a.sent();
                    return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
                case 18:
                    _a.sent();
                    return [4 /*yield*/, visitsPage.clickDischargedTab()];
                case 19:
                    _a.sent();
                    return [4 /*yield*/, visitsPage.verifyVisitPresent(resourceHandler.appointment.id)];
                case 20:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
//# sourceMappingURL=inPersonVisitMainFlow.spec.js.map