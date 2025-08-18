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
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../src/constants/data-test-ids");
var resource_handler_1 = require("../../e2e-utils/resource-handler");
var PatientInformationPage_1 = require("../page/PatientInformationPage");
var POLICY_HOLDER_DATE_OF_BIRTH = '01/01/1990';
var POLICY_HOLDER_2_DATE_OF_BIRTH = '01/01/1991';
var NEW_PATIENT_INSURANCE_MEMBER_ID = 'abc1234567';
var NEW_PATIENT_INSURANCE_MEMBER_ID_2 = '125897ftr';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS = 'street 21';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE = 'additional2';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX = 'Intersex';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_CITY = 'Las Vegas';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH = '03/03/1993';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME = 'Alice';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME = 'Wonder';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME = 'Louisa';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED = 'Child';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_STATE = 'NJ';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP = '32567';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS = 'street 17';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE = 'additional';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX = 'Intersex';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_CITY = 'Anchorage';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH = '04/04/1992';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME = 'James';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME = 'Cannoli';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME = 'Bob';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED = 'Common Law Spouse';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_STATE = 'AK';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_ZIP = '78956';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO = 'testing';
var NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2 = 'testing2';
var NEW_PATIENT_INSURANCE_CARRIER = '6 Degrees Health Incorporated';
var NEW_PATIENT_INSURANCE_CARRIER_2 = 'AAA - Minnesota/Iowa';
test_1.test.describe('Insurance Information Section non-mutating tests', function () {
    var resourceHandler;
    var primaryInsuranceCarrier;
    var secondaryInsuranceCarrier;
    test_1.test.beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, createdResourceHandler, createdPrimaryInsuranceCarrier, createdSecondaryInsuranceCarrier;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, createResourceHandler()];
                case 1:
                    _a = _b.sent(), createdResourceHandler = _a[0], createdPrimaryInsuranceCarrier = _a[1], createdSecondaryInsuranceCarrier = _a[2];
                    resourceHandler = createdResourceHandler;
                    primaryInsuranceCarrier = createdPrimaryInsuranceCarrier;
                    secondaryInsuranceCarrier = createdSecondaryInsuranceCarrier;
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
    (0, test_1.test)('Verify data from Primary and Secondary Insurances blocks are displayed correctly', { tag: '@flaky' }, function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, primaryInsuranceCard, secondaryInsuranceCard;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
                    return [4 /*yield*/, primaryInsuranceCard.verifyAlwaysShownFieldsAreVisible()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyAdditionalFieldsAreHidden()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceType('Primary')];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceCarrier(primaryInsuranceCarrier)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyMemberId(resource_handler_1.PATIENT_INSURANCE_MEMBER_ID)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clickShowMoreButton()];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyAdditionalFieldsAreVisible()];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyAlwaysShownFieldsAreVisible()];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersFirstName(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME)];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersLastName(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME)];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersMiddleName(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME)];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersDateOfBirth(POLICY_HOLDER_DATE_OF_BIRTH)];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersSex(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX)];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceStreetAddress(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS)];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceAddressLine2(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE)];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceCity(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_CITY)];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceState(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_STATE)];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceZip(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_ZIP)];
                case 19:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPatientsRelationshipToInjured(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED)];
                case 20:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyAdditionalInsuranceInformation('')];
                case 21:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clickShowMoreButton()];
                case 22:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyAdditionalFieldsAreHidden()];
                case 23:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyAlwaysShownFieldsAreVisible()];
                case 24:
                    _c.sent();
                    secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
                    return [4 /*yield*/, secondaryInsuranceCard.verifyAlwaysShownFieldsAreVisible()];
                case 25:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyAdditionalFieldsAreHidden()];
                case 26:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyAlwaysShownFieldsAreVisible()];
                case 27:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceType('Secondary')];
                case 28:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceCarrier(secondaryInsuranceCarrier)];
                case 29:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyMemberId(resource_handler_1.PATIENT_INSURANCE_MEMBER_ID_2)];
                case 30:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clickShowMoreButton()];
                case 31:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyAdditionalFieldsAreVisible()];
                case 32:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyAlwaysShownFieldsAreVisible()];
                case 33:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersFirstName(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME)];
                case 34:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersLastName(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME)];
                case 35:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersMiddleName(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME)];
                case 36:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersDateOfBirth(POLICY_HOLDER_2_DATE_OF_BIRTH)];
                case 37:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersSex(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX)];
                case 38:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceStreetAddress(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS)];
                case 39:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceAddressLine2(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE)];
                case 40:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceCity(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_CITY)];
                case 41:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceState(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_STATE)];
                case 42:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceZip(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP)];
                case 43:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPatientsRelationshipToInjured(resource_handler_1.PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED)];
                case 44:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyAdditionalInsuranceInformation('')];
                case 45:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clickShowMoreButton()];
                case 46:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyAdditionalFieldsAreHidden()];
                case 47:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyAlwaysShownFieldsAreVisible()];
                case 48:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check validation error is displayed if any required field in Insurance information block is missing', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, primaryInsuranceCard, secondaryInsuranceCard;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
                    return [4 /*yield*/, primaryInsuranceCard.clickShowMoreButton()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clearMemberIdField()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clearPolicyHolderFirstNameField()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clearPolicyHolderLastNameField()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clearDateOfBirthFromInsuranceContainer()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clearStreetAddressFromInsuranceContainer()];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clearCityFromInsuranceContainer()];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clearZipFromInsuranceContainer()];
                case 9:
                    _c.sent();
                    secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
                    return [4 /*yield*/, secondaryInsuranceCard.clickShowMoreButton()];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clearMemberIdField()];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clearPolicyHolderFirstNameField()];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clearPolicyHolderLastNameField()];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clearDateOfBirthFromInsuranceContainer()];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clearStreetAddressFromInsuranceContainer()];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clearCityFromInsuranceContainer()];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clearZipFromInsuranceContainer()];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.memberId)];
                case 19:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersFirstName)];
                case 20:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersLastName)];
                case 21:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersDateOfBirth)];
                case 22:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.streetAddress)];
                case 23:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.city)];
                case 24:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.zip)];
                case 25:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.memberId)];
                case 26:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersFirstName)];
                case 27:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersLastName)];
                case 28:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersDateOfBirth)];
                case 29:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.streetAddress)];
                case 30:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.city)];
                case 31:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyValidationErrorShown(data_test_ids_1.dataTestIds.insuranceContainer.zip)];
                case 32:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
test_1.test.describe('Insurance Information Section mutating tests', function () {
    var resourceHandler;
    test_1.test.beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, createdResourceHandler, _createdPrimaryInsuranceCarrier, _createdSecondaryInsuranceCarrier;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, createResourceHandler()];
                case 1:
                    _a = _b.sent(), createdResourceHandler = _a[0], _createdPrimaryInsuranceCarrier = _a[1], _createdSecondaryInsuranceCarrier = _a[2];
                    resourceHandler = createdResourceHandler;
                    return [2 /*return*/];
            }
        });
    }); });
    test_1.test.beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, resourceHandler.setResources()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
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
    (0, test_1.test)('Enter invalid zip on Insurance information block, validation error are shown', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, primaryInsuranceCard, secondaryInsuranceCard;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
                    return [4 /*yield*/, primaryInsuranceCard.clickShowMoreButton()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterZipFromInsuranceContainer('11')];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterZipFromInsuranceContainer('11223344')];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance()];
                case 8:
                    _c.sent();
                    secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
                    return [4 /*yield*/, secondaryInsuranceCard.clickShowMoreButton()];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterZipFromInsuranceContainer('11')];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance()];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterZipFromInsuranceContainer('11223344')];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyValidationErrorZipFieldFromInsurance()];
                case 15:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Updated values from Insurance information block are saved and displayed correctly', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, primaryInsuranceCard, secondaryInsuranceCard;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
                    return [4 /*yield*/, primaryInsuranceCard.clickShowMoreButton()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.selectInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterMemberId(NEW_PATIENT_INSURANCE_MEMBER_ID)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterPolicyHolderFirstName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterPolicyHolderMiddleName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterPolicyHolderLastName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterDateOfBirthFromInsuranceContainer(NEW_PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH)];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.selectPolicyHoldersBirthSex(NEW_PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX)];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterPolicyHolderStreetAddress(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS)];
                case 10:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterPolicyHolderAddressLine2(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE)];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterPolicyHolderCity(NEW_PATIENT_INSURANCE_POLICY_HOLDER_CITY)];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.selectPolicyHoldersState(NEW_PATIENT_INSURANCE_POLICY_HOLDER_STATE)];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterZipFromInsuranceContainer(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ZIP)];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.selectPatientsRelationship(NEW_PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED)];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterAdditionalInsuranceInformation(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO)];
                case 16:
                    _c.sent();
                    secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
                    return [4 /*yield*/, secondaryInsuranceCard.clickShowMoreButton()];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.selectInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER_2)];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterMemberId(NEW_PATIENT_INSURANCE_MEMBER_ID_2)];
                case 19:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterPolicyHolderFirstName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME)];
                case 20:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterPolicyHolderMiddleName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME)];
                case 21:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterPolicyHolderLastName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME)];
                case 22:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterDateOfBirthFromInsuranceContainer(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH)];
                case 23:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.selectPolicyHoldersBirthSex(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX)];
                case 24:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterPolicyHolderStreetAddress(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS)];
                case 25:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterPolicyHolderAddressLine2(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE)];
                case 26:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterPolicyHolderCity(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_CITY)];
                case 27:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.selectPolicyHoldersState(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_STATE)];
                case 28:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterZipFromInsuranceContainer(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP)];
                case 29:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.selectPatientsRelationship(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED)];
                case 30:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterAdditionalInsuranceInformation(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2)];
                case 31:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 32:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 33:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 34:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 35:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clickShowMoreButton()];
                case 36:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clickShowMoreButton()];
                case 37:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER)];
                case 38:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyMemberId(NEW_PATIENT_INSURANCE_MEMBER_ID)];
                case 39:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersFirstName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME)];
                case 40:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersMiddleName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME)];
                case 41:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersLastName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME)];
                case 42:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersDateOfBirth(NEW_PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH)];
                case 43:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPolicyHoldersSex(NEW_PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX)];
                case 44:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceStreetAddress(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS)];
                case 45:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceAddressLine2(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE)];
                case 46:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceCity(NEW_PATIENT_INSURANCE_POLICY_HOLDER_CITY)];
                case 47:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceState(NEW_PATIENT_INSURANCE_POLICY_HOLDER_STATE)];
                case 48:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyInsuranceZip(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ZIP)];
                case 49:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyPatientsRelationshipToInjured(NEW_PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED)];
                case 50:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyAdditionalInsuranceInformation(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO)];
                case 51:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceCarrier(NEW_PATIENT_INSURANCE_CARRIER_2)];
                case 52:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyMemberId(NEW_PATIENT_INSURANCE_MEMBER_ID_2)];
                case 53:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersFirstName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME)];
                case 54:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersMiddleName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME)];
                case 55:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersLastName(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME)];
                case 56:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersDateOfBirth(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH)];
                case 57:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPolicyHoldersSex(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX)];
                case 58:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceStreetAddress(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS)];
                case 59:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceAddressLine2(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE)];
                case 60:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceCity(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_CITY)];
                case 61:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceState(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_STATE)];
                case 62:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyInsuranceZip(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP)];
                case 63:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyPatientsRelationshipToInjured(NEW_PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED)];
                case 64:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyAdditionalInsuranceInformation(NEW_PATIENT_INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2)];
                case 65:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Set and remove Additional Insurance Information for both primary and secondary insurance, then verify it is cleared after save', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, primaryInsuranceCard, secondaryInsuranceCard;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
                    secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
                    return [4 /*yield*/, primaryInsuranceCard.clickShowMoreButton()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clickShowMoreButton()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterAdditionalInsuranceInformation('Primary test info')];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterAdditionalInsuranceInformation('Secondary test info')];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.waitUntilInsuranceCarrierIsRendered()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.waitUntilInsuranceCarrierIsRendered()];
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
                    return [4 /*yield*/, primaryInsuranceCard.waitUntilInsuranceCarrierIsRendered()];
                case 11:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.waitUntilInsuranceCarrierIsRendered()];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clickShowMoreButton()];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clickShowMoreButton()];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyAdditionalInsuranceInformation('Primary test info')];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyAdditionalInsuranceInformation('Secondary test info')];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.enterAdditionalInsuranceInformation('')];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.enterAdditionalInsuranceInformation('')];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickSaveChangesButton()];
                case 19:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyUpdatedSuccessfullyMessageShown()];
                case 20:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.reloadPatientInformationPage()];
                case 21:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clickShowMoreButton()];
                case 22:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clickShowMoreButton()];
                case 23:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.verifyAdditionalInsuranceInformation('')];
                case 24:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.verifyAdditionalInsuranceInformation('')];
                case 25:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check [Add insurance] button is hidden when both primary and secondary insurances are present,[Add insurance] button is present if primary insurance is removed and "Type" on "Add insurance" screen is pre-filled with "Primary"', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, primaryInsuranceCard, addInsuranceDialog;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyAddInsuranceButtonIsHidden()];
                case 2:
                    _c.sent();
                    primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
                    return [4 /*yield*/, primaryInsuranceCard.clickShowMoreButton()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, primaryInsuranceCard.clickRemoveInsuranceButton()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyCoverageRemovedMessageShown()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickAddInsuranceButton()];
                case 6:
                    addInsuranceDialog = _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyTypeField('Primary', false)];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check [Add insurance] button is present if Primary insurance is removed and "Type" on "Add insurance" screen is pre-filled with "Secondary"', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, secondaryInsuranceCard, addInsuranceDialog;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.openPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
                    return [4 /*yield*/, secondaryInsuranceCard.clickShowMoreButton()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, secondaryInsuranceCard.clickRemoveInsuranceButton()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.verifyCoverageRemovedMessageShown()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientInformationPage.clickAddInsuranceButton()];
                case 5:
                    addInsuranceDialog = _c.sent();
                    return [4 /*yield*/, addInsuranceDialog.verifyTypeField('Secondary', false)];
                case 6:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
function createResourceHandler() {
    return __awaiter(this, void 0, void 0, function () {
        var insuranceCarrier1, insuranceCarrier2, PROCESS_ID, resourceHandler, oystehr, insuranceCarriersOptionsResponse, insuranceCarriersOptions;
        var _this = this;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    insuranceCarrier1 = undefined;
                    insuranceCarrier2 = undefined;
                    PROCESS_ID = "patientRecordInsuranceSection-".concat(luxon_1.DateTime.now().toMillis());
                    resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'in-person', function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
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
                                        insuranceMemberId2: resource_handler_1.PATIENT_INSURANCE_MEMBER_ID_2,
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
                                    (0, utils_1.getPrimaryCarePhysicianStepAnswers)({}),
                                ]];
                        });
                    }); });
                    return [4 /*yield*/, resource_handler_1.ResourceHandler.getOystehr()];
                case 1:
                    oystehr = _e.sent();
                    return [4 /*yield*/, oystehr.zambda.execute({
                            id: 'get-answer-options',
                            answerSource: {
                                resourceType: 'Organization',
                                query: "active=true&type=".concat(utils_1.ORG_TYPE_CODE_SYSTEM, "|").concat(utils_1.ORG_TYPE_PAYER_CODE),
                            },
                        })];
                case 2:
                    insuranceCarriersOptionsResponse = _e.sent();
                    insuranceCarriersOptions = (0, utils_1.chooseJson)(insuranceCarriersOptionsResponse);
                    insuranceCarrier1 = insuranceCarriersOptions.at(0);
                    insuranceCarrier2 = insuranceCarriersOptions.at(1);
                    return [4 /*yield*/, resourceHandler.setResources()];
                case 3:
                    _e.sent();
                    return [4 /*yield*/, Promise.all([
                            resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id),
                            resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id),
                        ])];
                case 4:
                    _e.sent();
                    return [2 /*return*/, [
                            resourceHandler,
                            (_b = (_a = insuranceCarrier1 === null || insuranceCarrier1 === void 0 ? void 0 : insuranceCarrier1.valueReference) === null || _a === void 0 ? void 0 : _a.display) !== null && _b !== void 0 ? _b : '',
                            (_d = (_c = insuranceCarrier2 === null || insuranceCarrier2 === void 0 ? void 0 : insuranceCarrier2.valueReference) === null || _c === void 0 ? void 0 : _c.display) !== null && _d !== void 0 ? _d : '',
                        ]];
            }
        });
    });
}
//# sourceMappingURL=patientRecordPageInsuranceSection.spec.js.map