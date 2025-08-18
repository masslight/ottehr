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
var test_utils_1 = require("test-utils");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../src/constants/data-test-ids");
var constants_1 = require("../../e2e-utils/resource/constants");
var resource_handler_1 = require("../../e2e-utils/resource-handler");
var AddPatientPage_1 = require("../page/AddPatientPage");
var DiscardChangesDialog_1 = require("../page/patient-information/DiscardChangesDialog");
var PatientInformationPage_1 = require("../page/PatientInformationPage");
var PatientRecordPage_1 = require("../page/PatientRecordPage");
var PatientsPage_1 = require("../page/PatientsPage");
var NEW_PATIENT_LAST_NAME = 'Test_last_name';
var NEW_PATIENT_FIRST_NAME = 'Test_first_name';
var NEW_PATIENT_MIDDLE_NAME = 'Test_middle';
var NEW_PATIENT_SUFFIX = 'Mrs';
var NEW_PATIENT_PREFERRED_NAME = 'Test_pref';
var NEW_PATIENT_DATE_OF_BIRTH = '01/01/2024';
var NEW_PATIENT_PREFERRED_PRONOUNS = 'They/them';
var NEW_PATIENT_BIRTH_SEX = 'Female';
var NEW_STREET_ADDRESS = 'Test address, 1';
var NEW_STREET_ADDRESS_OPTIONAL = 'test, optional';
var NEW_CITY = 'New York';
var NEW_STATE = 'CA';
var NEW_ZIP = '05000';
var NEW_PATIENT_EMAIL = 'testemail@getMaxListeners.com';
var NEW_PATIENT_MOBILE = '2027139680';
var NEW_PATIENT_ETHNICITY = 'Hispanic or Latino';
var NEW_PATIENT_RACE = 'Asian';
var NEW_PATIENT_SEXUAL_ORIENTATION = 'Straight';
var NEW_PATIENT_GENDER_IDENTITY = 'Female';
var NEW_PATIENT_HOW_DID_YOU_HEAR = 'Webinar';
var NEW_SEND_MARKETING_MESSAGES = 'No';
var NEW_PREFERRED_LANGUAGE = 'Spanish';
var NEW_COMMON_WELL_CONSENT = 'Yes';
var NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER = 'Parent';
var NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER = 'First name';
var NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER = 'Last name';
var NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER = '10/10/2000';
var NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER = 'Male';
var NEW_PHONE_FROM_RESPONSIBLE_CONTAINER = '(202) 111-1111';
var NEW_ADDRESS_RESPONSIBLE_PARTY = '123 fake lane';
var NEW_CITY_RESPONSIBLE_PARTY = 'Los Angeles';
var NEW_STATE_RESPONSIBLE_PARTY = 'NY';
var NEW_ZIP_RESPONSIBLE_PARTY = '10003';
var NEW_PROVIDER_FIRST_NAME = 'John';
var NEW_PROVIDER_LAST_NAME = 'Doe';
var NEW_PRACTICE_NAME = 'Dental';
var NEW_PHYSICIAN_ADDRESS = '5th avenue';
var NEW_PHYSICIAN_MOBILE = '(202) 222-2222';
var NEW_PATIENT_DETAILS_PLEASE_SPECIFY_FIELD = 'testing gender';
//const RELEASE_OF_INFO = 'Yes, Release Allowed';
//const RX_HISTORY_CONSENT = 'Rx history consent signed by the patient';
test_1.test.describe('Patient Record Page non-mutating tests', function () {
    var PROCESS_ID = "patientRecordPage-non-mutating-".concat(luxon_1.DateTime.now().toMillis());
    var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID);
    test_1.test.beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
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
                    return [4 /*yield*/, resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    }); });
    test_1.test.afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, resourceHandler.cleanupResources()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Click on "See all patient info button", Patient Info Page is opened', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientRecordPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patient/' + resourceHandler.patient.id)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientRecordPage_1.expectPatientRecordPage)(resourceHandler.patient.id, page)];
                case 2:
                    patientRecordPage = _c.sent();
                    return [4 /*yield*/, patientRecordPage.clickSeeAllPatientInfoButton()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientInformationPage_1.expectPatientInformationPage)(page, resourceHandler.patient.id)];
                case 4:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Verify required data from Patient info block is displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientLastName(resource_handler_1.PATIENT_LAST_NAME)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientFirstName(resource_handler_1.PATIENT_FIRST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientDateOfBirth(resource_handler_1.PATIENT_BIRTH_DATE_SHORT)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientBirthSex(resource_handler_1.PATIENT_GENDER)];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Verify required data from Contact info block is displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyStreetAddress(utils_1.DEMO_VISIT_STREET_ADDRESS)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyAddressLineOptional(utils_1.DEMO_VISIT_STREET_ADDRESS_OPTIONAL)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyCity(utils_1.DEMO_VISIT_CITY)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyState(utils_1.DEMO_VISIT_STATE)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyZip(utils_1.DEMO_VISIT_ZIP)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientEmail(resource_handler_1.PATIENT_EMAIL)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientMobile(resource_handler_1.PATIENT_PHONE_NUMBER)];
                case 8:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Verify data from Responsible party information block is displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyRelationshipFromResponsibleContainer(utils_1.DEMO_VISIT_RESPONSIBLE_RELATIONSHIP)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyFirstNameFromResponsibleContainer(utils_1.DEMO_VISIT_RESPONSIBLE_FIRST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyLastNameFromResponsibleContainer(utils_1.DEMO_VISIT_RESPONSIBLE_LAST_NAME)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyDateOfBirthFromResponsibleContainer(utils_1.DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_MONTH +
                            '/' +
                            utils_1.DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_DAY +
                            '/' +
                            utils_1.DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_YEAR)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyBirthSexFromResponsibleContainer(utils_1.DEMO_VISIT_RESPONSIBLE_BIRTH_SEX)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPhoneFromResponsibleContainer(utils_1.DEMO_VISIT_RESPONSIBLE_PHONE)];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Verify entered by patient data from Patient details block is displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientEthnicity(utils_1.DEMO_VISIT_PATIENT_ETHNICITY)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientRace(utils_1.DEMO_VISIT_PATIENT_RACE)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyHowDidYouHear(utils_1.DEMO_VISIT_POINT_OF_DISCOVERY)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyMarketingMessaging(utils_1.DEMO_VISIT_MARKETING_MESSAGING ? 'Yes' : 'No')];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPreferredLanguage(utils_1.DEMO_VISIT_PREFERRED_LANGUAGE)];
                case 6:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Verify data from Primary Care Physician block is displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyFirstNameFromPcp(utils_1.DEMO_VISIT_PROVIDER_FIRST_NAME)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyLastNameFromPcp(utils_1.DEMO_VISIT_PROVIDER_LAST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPracticeNameFromPcp(utils_1.DEMO_VISIT_PRACTICE_NAME)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyAddressFromPcp(utils_1.DEMO_VISIT_PHYSICIAN_ADDRESS)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyMobileFromPcp(utils_1.DEMO_VISIT_PHYSICIAN_MOBILE)];
                case 6:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check all fields from Primary Care Physician block are hidden when checkbox is checked', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.setCheckboxOn()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyFirstNameFromPcpIsNotVisible()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyLastNameFromPcpIsNotVisible()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPracticeNameFromPcpIsNotVisible()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyAddressFromPcpIsNotVisible()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyMobileFromPcpIsNotVisible()];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test_1.test.skip('Check all fields from Primary Care Physician block after toggling the checkbox on and off', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.setCheckboxOn()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.setCheckboxOff()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyFirstNameFromPcp(utils_1.DEMO_VISIT_PROVIDER_FIRST_NAME)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyLastNameFromPcp(utils_1.DEMO_VISIT_PROVIDER_LAST_NAME)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPracticeNameFromPcp(utils_1.DEMO_VISIT_PRACTICE_NAME)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyAddressFromPcp(utils_1.DEMO_VISIT_PHYSICIAN_ADDRESS)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyMobileFromPcp(utils_1.DEMO_VISIT_PHYSICIAN_MOBILE)];
                case 8:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check validation error is displayed for invalid phone number from Primary Care Physician block', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearMobileFromPcp()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterMobileFromPcp('2222245')];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorInvalidPhoneFromPcp()];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    //to do: uncomment when https://github.com/masslight/ottehr/issues/2200 will be fixed
    /* test('Click [x] from Patient info page without updating any data, Patient Record page is opened', async ({
      page,
    }) => {
      const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
      await patientInformationPage.clickCloseButton();
      await expectPatientRecordPage(resourceHandler.patient.id!, page);
    });
  
    test('Click [x] from Patient info page after updating any field and reverting this changes, Patient Record page is opened', async ({
      page,
    }) => {
      const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
      await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
      await patientInformationPage.enterPatientFirstName(PATIENT_FIRST_NAME);
      await patientInformationPage.clickCloseButton();
      await expectPatientRecordPage(resourceHandler.patient.id!, page);
    });*/
    (0, test_1.test)('Click on Patients Name breadcrumb, Patient Record page is opened', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var _c, _d, _e, _f;
        var page = _b.page;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _g.sent();
                    return [4 /*yield*/, patientInformationPage.clickPatientNameBreadcrumb(((_e = (_d = (_c = resourceHandler.patient.name) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.given) === null || _e === void 0 ? void 0 : _e[0]) + ' ' + ((_f = resourceHandler.patient.name) === null || _f === void 0 ? void 0 : _f[0].family))];
                case 2:
                    _g.sent();
                    return [4 /*yield*/, (0, PatientRecordPage_1.expectPatientRecordPage)(resourceHandler.patient.id, page)];
                case 3:
                    _g.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Click on Patients breadcrumb, Patients page is opened', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickPatientsBreadcrumb()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Click on [Discard changes] button, Patient Record page is opened', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, discardChangesDialog;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patient/' + resourceHandler.patient.id)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 2:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickCloseButton()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, (0, DiscardChangesDialog_1.expectDiscardChangesDialog)(page)];
                case 5:
                    discardChangesDialog = _c.sent();
                    return [4 /*yield*/, discardChangesDialog.clickDiscardChangesButton()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientRecordPage_1.expectPatientRecordPage)(resourceHandler.patient.id, page)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 8:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientFirstName(resource_handler_1.PATIENT_FIRST_NAME)];
                case 9:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Click on [Cancel] button, user stays on Patient Information page', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, discardChangesDialog;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickCloseButton()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, (0, DiscardChangesDialog_1.expectDiscardChangesDialog)(page)];
                case 4:
                    discardChangesDialog = _c.sent();
                    return [4 /*yield*/, discardChangesDialog.clickCancelButton()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientInformationPage_1.expectPatientInformationPage)(page, resourceHandler.patient.id)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientFirstName(NEW_PATIENT_FIRST_NAME)];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Click on [x] icon, user stays on Patient Information page', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, discardChangesDialog;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickCloseButton()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, (0, DiscardChangesDialog_1.expectDiscardChangesDialog)(page)];
                case 4:
                    discardChangesDialog = _c.sent();
                    return [4 /*yield*/, discardChangesDialog.clickCloseButton()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientInformationPage_1.expectPatientInformationPage)(page, resourceHandler.patient.id)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientFirstName(NEW_PATIENT_FIRST_NAME)];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
test_1.test.describe('Patient Record Page mutating tests', function () {
    var PROCESS_ID = "patientRecordPage-mutating-".concat(luxon_1.DateTime.now().toMillis());
    var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID);
    test_1.test.beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, resourceHandler.setResources()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test_1.test.afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, resourceHandler.cleanupResources()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Fill and save required values on Patient Info Page, values are saved and updated successfully- Happy path', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientLastName(NEW_PATIENT_LAST_NAME)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectPatientBirthSex(NEW_PATIENT_BIRTH_SEX)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterStreetAddress(NEW_STREET_ADDRESS)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterCity(NEW_CITY)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectState(NEW_STATE)];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterZip(NEW_ZIP)];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientEmail(NEW_PATIENT_EMAIL)];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientMobile(NEW_PATIENT_MOBILE)];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectPatientEthnicity(NEW_PATIENT_ETHNICITY)];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectPatientRace(NEW_PATIENT_RACE)];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectRelationshipFromResponsibleContainer(NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER)];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER)];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER)];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER)];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectBirthSexFromResponsibleContainer(NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER)];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER)];
                case 19:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterStreetLine1FromResponsibleContainer(NEW_ADDRESS_RESPONSIBLE_PARTY)];
                case 20:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterResponsiblePartyCity(NEW_CITY_RESPONSIBLE_PARTY)];
                case 21:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectResponsiblePartyState(NEW_STATE_RESPONSIBLE_PARTY)];
                case 22:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterResponsiblePartyZip(NEW_ZIP_RESPONSIBLE_PARTY)];
                case 23:
                    _c.sent();
                    // await patientInformationPage.selectReleaseOfInfo(RELEASE_OF_INFO);
                    // await patientInformationPage.selectRxHistoryConsent(RX_HISTORY_CONSENT);
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 24:
                    // await patientInformationPage.selectReleaseOfInfo(RELEASE_OF_INFO);
                    // await patientInformationPage.selectRxHistoryConsent(RX_HISTORY_CONSENT);
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 25:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 26:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientLastName(NEW_PATIENT_LAST_NAME)];
                case 27:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientFirstName(NEW_PATIENT_FIRST_NAME)];
                case 28:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH)];
                case 29:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientBirthSex(NEW_PATIENT_BIRTH_SEX)];
                case 30:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyStreetAddress(NEW_STREET_ADDRESS)];
                case 31:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyCity(NEW_CITY)];
                case 32:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyState(NEW_STATE)];
                case 33:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyZip(NEW_ZIP)];
                case 34:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientEmail(NEW_PATIENT_EMAIL)];
                case 35:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientMobile(NEW_PATIENT_MOBILE)];
                case 36:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientEthnicity(NEW_PATIENT_ETHNICITY)];
                case 37:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientRace(NEW_PATIENT_RACE)];
                case 38:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyRelationshipFromResponsibleContainer(NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER)];
                case 39:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER)];
                case 40:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER)];
                case 41:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER)];
                case 42:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyBirthSexFromResponsibleContainer(NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER)];
                case 43:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER)];
                case 44:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check validation error is displayed if any required field in Patient info block is missing', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearPatientLastName()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearPatientFirstName()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearPatientDateOfBirth()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.PATIENT_LAST_NAME)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.PATIENT_FIRST_NAME)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.PATIENT_DOB)];
                case 8:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Updated values from Patient info block are saved and displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientLastName(NEW_PATIENT_LAST_NAME)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientMiddleName(NEW_PATIENT_MIDDLE_NAME)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientSuffix(NEW_PATIENT_SUFFIX)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientPreferredName(NEW_PATIENT_PREFERRED_NAME)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectPatientPreferredPronouns(NEW_PATIENT_PREFERRED_PRONOUNS)];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectPatientBirthSex(NEW_PATIENT_BIRTH_SEX)];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientLastName(NEW_PATIENT_LAST_NAME)];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientFirstName(NEW_PATIENT_FIRST_NAME)];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientMiddleName(NEW_PATIENT_MIDDLE_NAME)];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientSuffix(NEW_PATIENT_SUFFIX)];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientPreferredName(NEW_PATIENT_PREFERRED_NAME)];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH)];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientPreferredPronouns(NEW_PATIENT_PREFERRED_PRONOUNS)];
                case 19:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientBirthSex(NEW_PATIENT_BIRTH_SEX)];
                case 20:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check validation error is displayed if any required field in Contact info block is missing', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearStreetAddress()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearCity()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearZip()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearPatientEmail()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearPatientMobile()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_STREET_ADDRESS)];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_CITY)];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_ZIP)];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.PATIENT_EMAIL)];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.PATIENT_PHONE_NUMBER)];
                case 12:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Enter invalid email,zip and mobile on Contract info block, validation errors are shown', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterZip('11')];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorZipField()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterZip('11223344')];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorZipField()];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientEmail('testEmailGetMaxListeners.com')];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorInvalidEmail()];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientEmail('@testEmailGetMaxListeners.com')];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorInvalidEmail()];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientEmail('testEmailGetMaxListeners@.com')];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorInvalidEmail()];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearPatientMobile()];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientMobile('111')];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 19:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorInvalidMobile()];
                case 20:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Updated values from Contact info block are saved and displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterStreetAddress(NEW_STREET_ADDRESS)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterAddressLineOptional(NEW_STREET_ADDRESS_OPTIONAL)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterCity(NEW_CITY)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectState(NEW_STATE)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterZip(NEW_ZIP)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientEmail(NEW_PATIENT_EMAIL)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPatientMobile(NEW_PATIENT_MOBILE)];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyStreetAddress(NEW_STREET_ADDRESS)];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyAddressLineOptional(NEW_STREET_ADDRESS_OPTIONAL)];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyCity(NEW_CITY)];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyState(NEW_STATE)];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyZip(NEW_ZIP)];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientEmail(NEW_PATIENT_EMAIL)];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientMobile(NEW_PATIENT_MOBILE)];
                case 18:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check validation error is displayed if any required field in Responsible party information block is missing or phone number is invalid', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearFirstNameFromResponsibleContainer()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearLastNameFromResponsibleContainer()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearDateOfBirthFromResponsibleContainer()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearPhoneFromResponsibleContainer()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_RESPONSIBLE_FIRST_NAME)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_RESPONSIBLE_LAST_NAME)];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_RESPONSIBLE_BIRTHDATE)];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPhoneFromResponsibleContainer('111')];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterDateOfBirthFromResponsibleContainer('10/10/2024')];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorInvalidPhoneFromResponsibleContainer()];
                case 13:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Updated values from Responsible party information block  are saved and displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectRelationshipFromResponsibleContainer(NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectBirthSexFromResponsibleContainer(NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyRelationshipFromResponsibleContainer(NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER)];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER)];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER)];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER)];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyBirthSexFromResponsibleContainer(NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER)];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPhoneFromResponsibleContainer(NEW_PHONE_FROM_RESPONSIBLE_CONTAINER)];
                case 16:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Updated values from Patient details  block  are saved and displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectPatientEthnicity(NEW_PATIENT_ETHNICITY)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectPatientRace(NEW_PATIENT_RACE)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectSexualOrientation(NEW_PATIENT_SEXUAL_ORIENTATION)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectGenderIdentity(NEW_PATIENT_GENDER_IDENTITY)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectHowDidYouHear(NEW_PATIENT_HOW_DID_YOU_HEAR)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectMarketingMessaging(NEW_SEND_MARKETING_MESSAGES)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectPreferredLanguage(NEW_PREFERRED_LANGUAGE)];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectCommonWellConsent(NEW_COMMON_WELL_CONSENT)];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientEthnicity(NEW_PATIENT_ETHNICITY)];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPatientRace(NEW_PATIENT_RACE)];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifySexualOrientation(NEW_PATIENT_SEXUAL_ORIENTATION)];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyGenderIdentity(NEW_PATIENT_GENDER_IDENTITY)];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyHowDidYouHear(NEW_PATIENT_HOW_DID_YOU_HEAR)];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyMarketingMessaging(NEW_SEND_MARKETING_MESSAGES)];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPreferredLanguage(NEW_PREFERRED_LANGUAGE)];
                case 19:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyCommonWellConsent(NEW_COMMON_WELL_CONSENT)];
                case 20:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('If "Other" gender is selected from Patient details  block, additional field appears and it is required', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectGenderIdentity('Other')];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyOtherGenderFieldIsVisible()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.GENDER_IDENTITY_ADDITIONAL_FIELD)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterOtherGenderField(NEW_PATIENT_DETAILS_PLEASE_SPECIFY_FIELD)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyGenderIdentity('Other')];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyOtherGenderInput(NEW_PATIENT_DETAILS_PLEASE_SPECIFY_FIELD)];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.selectGenderIdentity(NEW_PATIENT_GENDER_IDENTITY)];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyOtherGenderFieldIsNotVisible()];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyGenderIdentity(NEW_PATIENT_GENDER_IDENTITY)];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyOtherGenderFieldIsNotVisible()];
                case 18:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check all fields from Primary Care Physician block are visible and required when checkbox is unchecked', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyCheckboxOff()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyFirstNameFromPcpIsVisible()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyLastNameFromPcpIsVisible()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPracticeNameFromPcpIsVisible()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyAddressFromPcpIsVisible()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyMobileFromPcpIsVisible()];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearFirstNameFromPcp()];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_PROVIDER_FIRST_NAME)];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterFirstNameFromPcp(NEW_PROVIDER_FIRST_NAME)];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearLastNameFromPcp()];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_PROVIDER_LAST_NAME)];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterLastNameFromPcp(NEW_PROVIDER_LAST_NAME)];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearPracticeNameFromPcp()];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_PRACTICE_NAME)];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPracticeNameFromPcp(NEW_PRACTICE_NAME)];
                case 19:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearAddressFromPcp()];
                case 20:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 21:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_PHYSICIAN_ADDRESS)];
                case 22:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterAddressFromPcp(NEW_PHYSICIAN_ADDRESS)];
                case 23:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clearMobileFromPcp()];
                case 24:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 25:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyValidationErrorInvalidPhoneFromPcp()];
                case 26:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Updated values from Primary Care Physician block are saved and displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterFirstNameFromPcp(NEW_PROVIDER_FIRST_NAME)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterLastNameFromPcp(NEW_PROVIDER_LAST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterPracticeNameFromPcp(NEW_PRACTICE_NAME)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterAddressFromPcp(NEW_PHYSICIAN_ADDRESS)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.enterMobileFromPcp(NEW_PHYSICIAN_MOBILE)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyFirstNameFromPcp(NEW_PROVIDER_FIRST_NAME)];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyLastNameFromPcp(NEW_PROVIDER_LAST_NAME)];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyPracticeNameFromPcp(NEW_PRACTICE_NAME)];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyAddressFromPcp(NEW_PHYSICIAN_ADDRESS)];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyMobileFromPcp(NEW_PHYSICIAN_MOBILE)];
                case 14:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    var INSURANCE_MEMBER_ID = 'abc1234567';
    var INSURANCE_POLICY_HOLDER_ADDRESS = 'street 17';
    var INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE = 'additional';
    var INSURANCE_POLICY_HOLDER_BIRTH_SEX = 'Intersex';
    var INSURANCE_POLICY_HOLDER_CITY = 'Anchorage';
    var INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH = '04/04/1992';
    var INSURANCE_POLICY_HOLDER_FIRST_NAME = 'James';
    var INSURANCE_POLICY_HOLDER_LAST_NAME = 'Cannoli';
    var INSURANCE_POLICY_HOLDER_MIDDLE_NAME = 'Bob';
    var INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED = 'Common Law Spouse';
    var INSURANCE_POLICY_HOLDER_STATE = 'AK';
    var INSURANCE_POLICY_HOLDER_ZIP = '78956';
    var INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO = 'testing';
    var INSURANCE_CARRIER = '6 Degrees Health Incorporated';
    var INSURANCE_MEMBER_ID_2 = '987548ert';
    var INSURANCE_POLICY_HOLDER_ADDRESS_2 = 'second street';
    var INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE_2 = 'additional2';
    var INSURANCE_POLICY_HOLDER_BIRTH_SEX_2 = 'Male';
    var INSURANCE_POLICY_HOLDER_CITY_2 = 'Denver';
    var INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH_2 = '03/03/1991';
    var INSURANCE_POLICY_HOLDER_FIRST_NAME_2 = 'David';
    var INSURANCE_POLICY_HOLDER_LAST_NAME_2 = 'Sorbet';
    var INSURANCE_POLICY_HOLDER_MIDDLE_NAME_2 = 'Roger';
    var INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED_2 = 'Injured Party';
    var INSURANCE_POLICY_HOLDER_STATE_2 = 'CO';
    var INSURANCE_POLICY_HOLDER_ZIP_2 = '21211';
    var INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2 = 'testing2';
    var INSURANCE_CARRIER_2 = 'ACTIN Care Groups';
    (0, test_1.test)('Check validation error is displayed if any required field in Add insurance dialog is missing', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, addInsuranceDialog;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickAddInsuranceButton()];
                case 2:
                    addInsuranceDialog = _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY)];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterZipFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_ZIP)];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorShown(data_test_ids_1.dataTestIds.addInsuranceDialog.insuranceCarrier)];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorShown(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersSex)];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorShown(data_test_ids_1.dataTestIds.addInsuranceDialog.relationship)];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorShown(data_test_ids_1.dataTestIds.addInsuranceDialog.state)];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectInsuranceCarrier(INSURANCE_CARRIER)];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectPolicyHoldersBirthSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX)];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectPatientsRelationship(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED)];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectPolicyHoldersState(INSURANCE_POLICY_HOLDER_STATE)];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clearMemberId()];
                case 19:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 20:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorShown(data_test_ids_1.dataTestIds.addInsuranceDialog.memberId)];
                case 21:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID)];
                case 22:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clearPolicyHolderFirstName()];
                case 23:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 24:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorShown(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersFirstName)];
                case 25:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME)];
                case 26:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clearPolicyHolderLastName()];
                case 27:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 28:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorShown(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersLastName)];
                case 29:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME)];
                case 30:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clearDateOfBirthFromAddInsuranceDialog()];
                case 31:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 32:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorShown(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersDateOfBirth)];
                case 33:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH)];
                case 34:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clearPolicyHolderStreetAddress()];
                case 35:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 36:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorShown(data_test_ids_1.dataTestIds.addInsuranceDialog.streetAddress)];
                case 37:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS)];
                case 38:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clearPolicyHolderCity()];
                case 39:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 40:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorShown(data_test_ids_1.dataTestIds.addInsuranceDialog.city)];
                case 41:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY)];
                case 42:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clearZipFromAddInsuranceDialog()];
                case 43:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 44:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorShown(data_test_ids_1.dataTestIds.addInsuranceDialog.zip)];
                case 45:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check validation error is displayed for invalid zip', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, addInsuranceDialog;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickAddInsuranceButton()];
                case 2:
                    addInsuranceDialog = _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterZipFromAddInsuranceDialog('11')];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorZipFieldFromAddInsurance()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterZipFromAddInsuranceDialog('11223344')];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyValidationErrorZipFieldFromAddInsurance()];
                case 8:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Fill fields and add primary and secondary insurances, verify insurances are saved successfully with correct data', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, addInsuranceDialog, primaryInsuranceCard, secondaryInsuranceCard;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickAddInsuranceButton()];
                case 2:
                    addInsuranceDialog = _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectInsuranceType('Primary')];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderMiddleName(INSURANCE_POLICY_HOLDER_MIDDLE_NAME)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH)];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS)];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderAddressLine2(INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE)];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY)];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterZipFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_ZIP)];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectInsuranceCarrier(INSURANCE_CARRIER)];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectPolicyHoldersBirthSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX)];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectPatientsRelationship(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED)];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectPolicyHoldersState(INSURANCE_POLICY_HOLDER_STATE)];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO)];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 19:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 20:
                    _c.sent();
                    primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
                    return [4 /*yield*/, primaryInsuranceCard.clickShowMoreButton()];
                case 21:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceType('Primary')];
                case 22:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceCarrier(INSURANCE_CARRIER)];
                case 23:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyMemberId(INSURANCE_MEMBER_ID)];
                case 24:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME)];
                case 25:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersLastName(INSURANCE_POLICY_HOLDER_LAST_NAME)];
                case 26:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersMiddleName(INSURANCE_POLICY_HOLDER_MIDDLE_NAME)];
                case 27:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersDateOfBirth(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH)];
                case 28:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX)];
                case 29:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS)];
                case 30:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceAddressLine2(INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE)];
                case 31:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceCity(INSURANCE_POLICY_HOLDER_CITY)];
                case 32:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceState(INSURANCE_POLICY_HOLDER_STATE)];
                case 33:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceZip(INSURANCE_POLICY_HOLDER_ZIP)];
                case 34:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPatientsRelationshipToInjured(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED)];
                case 35:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO)];
                case 36:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickAddInsuranceButton()];
                case 37:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyTypeField('Secondary', false)];
                case 38:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID_2)];
                case 39:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME_2)];
                case 40:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderMiddleName(INSURANCE_POLICY_HOLDER_MIDDLE_NAME_2)];
                case 41:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME_2)];
                case 42:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH_2)];
                case 43:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS_2)];
                case 44:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderAddressLine2(INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE_2)];
                case 45:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY_2)];
                case 46:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterZipFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_ZIP_2)];
                case 47:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectInsuranceCarrier(INSURANCE_CARRIER_2)];
                case 48:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectPolicyHoldersBirthSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX_2)];
                case 49:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectPatientsRelationship(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED_2)];
                case 50:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.selectPolicyHoldersState(INSURANCE_POLICY_HOLDER_STATE_2)];
                case 51:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.enterAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2)];
                case 52:
                    _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog()];
                case 53:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 54:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 55:
                    _c.sent();
                    secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
                    return [4 /*yield*/, secondaryInsuranceCard.clickShowMoreButton()];
                case 56:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceType('Secondary')];
                case 57:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceCarrier(INSURANCE_CARRIER_2)];
                case 58:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyMemberId(INSURANCE_MEMBER_ID_2)];
                case 59:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME_2)];
                case 60:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersLastName(INSURANCE_POLICY_HOLDER_LAST_NAME_2)];
                case 61:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersMiddleName(INSURANCE_POLICY_HOLDER_MIDDLE_NAME_2)];
                case 62:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersDateOfBirth(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH_2)];
                case 63:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX_2)];
                case 64:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS_2)];
                case 65:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceAddressLine2(INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE_2)];
                case 66:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceCity(INSURANCE_POLICY_HOLDER_CITY_2)];
                case 67:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceState(INSURANCE_POLICY_HOLDER_STATE_2)];
                case 68:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceZip(INSURANCE_POLICY_HOLDER_ZIP_2)];
                case 69:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPatientsRelationshipToInjured(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED_2)];
                case 70:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2)];
                case 71:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
test_1.test.describe('Patient Record Page tests with zero patient data filled in', function () { return __awaiter(void 0, void 0, void 0, function () {
    var PROCESS_ID, resourceHandler, context, page;
    return __generator(this, function (_a) {
        PROCESS_ID = "patientRecordPage-zero-data-".concat(luxon_1.DateTime.now().toMillis());
        resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID);
        test_1.test.beforeAll(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var browser = _b.browser;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, resourceHandler.setResources()];
                    case 1:
                        _c.sent();
                        return [4 /*yield*/, browser.newContext()];
                    case 2:
                        context = _c.sent();
                        return [4 /*yield*/, context.newPage()];
                    case 3:
                        page = _c.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test_1.test.afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, resourceHandler.cleanupResources()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Check state, ethnicity, race, relationship to patient are required', function () { return __awaiter(void 0, void 0, void 0, function () {
            var addPatientPage, appointmentCreationResponse, response, _a, appointmentId, patientId, patientInformationPage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, page.goto('/patient/' + resourceHandler.patient.id)];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, (0, AddPatientPage_1.openAddPatientPage)(page)];
                    case 2:
                        addPatientPage = _b.sent();
                        return [4 /*yield*/, addPatientPage.selectOffice(constants_1.ENV_LOCATION_NAME)];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, addPatientPage.enterMobilePhone(NEW_PATIENT_MOBILE)];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, addPatientPage.clickSearchForPatientsButton()];
                    case 5:
                        _b.sent();
                        return [4 /*yield*/, addPatientPage.clickPatientNotFoundButton()];
                    case 6:
                        _b.sent();
                        return [4 /*yield*/, addPatientPage.enterFirstName(NEW_PATIENT_FIRST_NAME)];
                    case 7:
                        _b.sent();
                        return [4 /*yield*/, addPatientPage.enterLastName(NEW_PATIENT_FIRST_NAME)];
                    case 8:
                        _b.sent();
                        return [4 /*yield*/, addPatientPage.enterDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH)];
                    case 9:
                        _b.sent();
                        return [4 /*yield*/, addPatientPage.selectSexAtBirth(NEW_PATIENT_BIRTH_SEX)];
                    case 10:
                        _b.sent();
                        return [4 /*yield*/, addPatientPage.selectReasonForVisit('Injury to head')];
                    case 11:
                        _b.sent();
                        return [4 /*yield*/, addPatientPage.selectVisitType('Walk-in In Person Visit')];
                    case 12:
                        _b.sent();
                        appointmentCreationResponse = (0, test_utils_1.waitForResponseWithData)(page, /\/create-appointment\//);
                        return [4 /*yield*/, addPatientPage.clickAddButton()];
                    case 13:
                        _b.sent();
                        _a = utils_1.unpackFhirResponse;
                        return [4 /*yield*/, appointmentCreationResponse];
                    case 14: return [4 /*yield*/, _a.apply(void 0, [_b.sent()])];
                    case 15:
                        response = _b.sent();
                        appointmentId = response.appointmentId;
                        if (!appointmentId) {
                            throw new Error('Appointment ID should be present in the response');
                        }
                        return [4 /*yield*/, resourceHandler.patientIdByAppointmentId(appointmentId)];
                    case 16:
                        patientId = _b.sent();
                        return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, patientId)];
                    case 17:
                        patientInformationPage = _b.sent();
                        return [4 /*yield*/, patientInformationPage.enterStreetAddress(NEW_STREET_ADDRESS)];
                    case 18:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.enterCity(NEW_CITY)];
                    case 19:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.enterPatientEmail(NEW_PATIENT_EMAIL)];
                    case 20:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.enterPatientMobile(NEW_PATIENT_MOBILE)];
                    case 21:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.enterFirstNameFromResponsibleContainer(NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER)];
                    case 22:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.enterLastNameFromResponsibleContainer(NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER)];
                    case 23:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.enterDateOfBirthFromResponsibleContainer(NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER)];
                    case 24:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.selectBirthSexFromResponsibleContainer(NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER)];
                    case 25:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                    case 26:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_STATE)];
                    case 27:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_PATIENT_ETHNICITY)];
                    case 28:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_PATIENT_RACE)];
                    case 29:
                        _b.sent();
                        return [4 /*yield*/, patientInformationPage.verifyValidationErrorShown(PatientInformationPage_1.Field.DEMO_VISIT_RESPONSIBLE_RELATIONSHIP)];
                    case 30:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
//# sourceMappingURL=patientRecordPage.spec.js.map