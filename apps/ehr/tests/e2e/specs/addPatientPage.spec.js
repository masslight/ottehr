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
var constants_1 = require("../../e2e-utils/resource/constants");
var resource_handler_1 = require("../../e2e-utils/resource-handler");
var AddPatientPage_1 = require("../page/AddPatientPage");
var VisitsPage_1 = require("../page/VisitsPage");
var PATIENT_PREFILL_NAME = resource_handler_1.PATIENT_FIRST_NAME + ' ' + resource_handler_1.PATIENT_LAST_NAME;
var PATIENT_INPUT_BIRTHDAY = resource_handler_1.PATIENT_BIRTH_DATE_SHORT;
var REASON_FOR_VISIT = resource_handler_1.PATIENT_REASON_FOR_VISIT;
// todo: remove hardcoded values, use constants from resource-handler
var NEW_PATIENT_1_LAST_NAME = 'new_1' + resource_handler_1.PATIENT_LAST_NAME;
var NEW_PATIENT_2_LAST_NAME = 'new_2' + resource_handler_1.PATIENT_LAST_NAME;
var NEW_PATIENT_3_LAST_NAME = 'new_3' + resource_handler_1.PATIENT_LAST_NAME;
var PATIENT_INPUT_GENDER = 'Male';
var VISIT_TYPES = {
    WALK_IN: 'Walk-in In Person Visit',
    PRE_BOOK: 'Pre-booked In Person Visit',
    POST_TELEMED: 'Post Telemed lab Only',
};
var PROCESS_ID = "addPatientPage.spec.ts-".concat(luxon_1.DateTime.now().toMillis());
var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID);
test_1.test.beforeEach(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto('/visits/add')];
            case 1:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Open "Add patient page", click "Cancel", navigates back to visits page', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var addPatientPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, AddPatientPage_1.expectAddPatientPage)(page)];
            case 1:
                addPatientPage = _c.sent();
                return [4 /*yield*/, addPatientPage.clickCancelButton()];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, VisitsPage_1.expectVisitsPage)(page)];
            case 3:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Open "Add patient page", click "Search patient", validation error on "Mobile phone" field shown', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var addPatientPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, AddPatientPage_1.expectAddPatientPage)(page)];
            case 1:
                addPatientPage = _c.sent();
                return [4 /*yield*/, addPatientPage.clickSearchForPatientsButton()];
            case 2:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyMobilePhoneNumberValidationErrorShown()];
            case 3:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Open "Add patient page" then enter invalid phone number, click "Search patient", validation error on "Mobile phone" field shown', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var addPatientPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, AddPatientPage_1.expectAddPatientPage)(page)];
            case 1:
                addPatientPage = _c.sent();
                return [4 /*yield*/, addPatientPage.enterMobilePhone('123')];
            case 2:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickSearchForPatientsButton()];
            case 3:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyMobilePhoneNumberValidationErrorShown()];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Add button does nothing when any required field is empty', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var addPatientPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, AddPatientPage_1.expectAddPatientPage)(page)];
            case 1:
                addPatientPage = _c.sent();
                return [4 /*yield*/, addPatientPage.clickAddButton()];
            case 2:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyPageStillOpened()];
            case 3:
                _c.sent();
                return [4 /*yield*/, addPatientPage.selectOffice(constants_1.ENV_LOCATION_NAME)];
            case 4:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickAddButton()];
            case 5:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyPageStillOpened()];
            case 6:
                _c.sent();
                return [4 /*yield*/, addPatientPage.enterMobilePhone(resource_handler_1.PATIENT_PHONE_NUMBER)];
            case 7:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickAddButton()];
            case 8:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifySearchForPatientsErrorShown()];
            case 9:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyPageStillOpened()];
            case 10:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickSearchForPatientsButton()];
            case 11:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickPatientNotFoundButton()];
            case 12:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickAddButton()];
            case 13:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyPageStillOpened()];
            case 14:
                _c.sent();
                return [4 /*yield*/, addPatientPage.enterFirstName(resource_handler_1.PATIENT_FIRST_NAME)];
            case 15:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickAddButton()];
            case 16:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyPageStillOpened()];
            case 17:
                _c.sent();
                return [4 /*yield*/, addPatientPage.enterLastName(resource_handler_1.PATIENT_LAST_NAME)];
            case 18:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickAddButton()];
            case 19:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyPageStillOpened()];
            case 20:
                _c.sent();
                return [4 /*yield*/, addPatientPage.enterDateOfBirth(PATIENT_INPUT_BIRTHDAY)];
            case 21:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickAddButton()];
            case 22:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyPageStillOpened()];
            case 23:
                _c.sent();
                return [4 /*yield*/, addPatientPage.selectSexAtBirth(PATIENT_INPUT_GENDER)];
            case 24:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickAddButton()];
            case 25:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyPageStillOpened()];
            case 26:
                _c.sent();
                return [4 /*yield*/, addPatientPage.selectReasonForVisit(REASON_FOR_VISIT)];
            case 27:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickAddButton()];
            case 28:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyPageStillOpened()];
            case 29:
                _c.sent();
                return [4 /*yield*/, addPatientPage.selectVisitType(VISIT_TYPES.PRE_BOOK)];
            case 30:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickAddButton()];
            case 31:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickCloseSelectDateWarningDialog()];
            case 32:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyPageStillOpened()];
            case 33:
                _c.sent();
                return [4 /*yield*/, addPatientPage.selectVisitType(VISIT_TYPES.POST_TELEMED)];
            case 34:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickAddButton()];
            case 35:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickCloseSelectDateWarningDialog()];
            case 36:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyPageStillOpened()];
            case 37:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Open "Add patient page" then enter invalid date of birth, click "Add", validation error on "Date of Birth" field shown', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var addPatientPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, AddPatientPage_1.expectAddPatientPage)(page)];
            case 1:
                addPatientPage = _c.sent();
                return [4 /*yield*/, addPatientPage.selectOffice(constants_1.ENV_LOCATION_NAME)];
            case 2:
                _c.sent();
                return [4 /*yield*/, addPatientPage.enterMobilePhone(resource_handler_1.PATIENT_PHONE_NUMBER)];
            case 3:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickSearchForPatientsButton()];
            case 4:
                _c.sent();
                return [4 /*yield*/, addPatientPage.clickPatientNotFoundButton()];
            case 5:
                _c.sent();
                return [4 /*yield*/, addPatientPage.enterDateOfBirth('3')];
            case 6:
                _c.sent();
                return [4 /*yield*/, addPatientPage.verifyDateFormatValidationErrorShown()];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
test_1.test.describe('For new patient', function () {
    (0, test_1.test)('Add walk-in visit for new patient', {
        tag: '@skipOnIntegration',
    }, function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var appointmentId, visitsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, createAppointment(page, VISIT_TYPES.WALK_IN, false, NEW_PATIENT_1_LAST_NAME)];
                case 1:
                    appointmentId = (_c.sent()).appointmentId;
                    return [4 /*yield*/, (0, VisitsPage_1.expectVisitsPage)(page)];
                case 2:
                    visitsPage = _c.sent();
                    return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, visitsPage.clickInOfficeTab()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, visitsPage.verifyVisitPresent(appointmentId)];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Add pre-book visit for new patient', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var _c, appointmentId, slotTime, visitsPage;
        var page = _b.page;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, createAppointment(page, VISIT_TYPES.PRE_BOOK, false, NEW_PATIENT_2_LAST_NAME)];
                case 1:
                    _c = _d.sent(), appointmentId = _c.appointmentId, slotTime = _c.slotTime;
                    return [4 /*yield*/, (0, VisitsPage_1.expectVisitsPage)(page)];
                case 2:
                    visitsPage = _d.sent();
                    return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
                case 3:
                    _d.sent();
                    return [4 /*yield*/, visitsPage.clickPrebookedTab()];
                case 4:
                    _d.sent();
                    return [4 /*yield*/, visitsPage.verifyVisitPresent(appointmentId, slotTime)];
                case 5:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test_1.test.skip('Add post-telemed visit for new patient', { tag: '@flaky' }, function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var _c, appointmentId, slotTime, visitsPage;
        var page = _b.page;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, createAppointment(page, VISIT_TYPES.POST_TELEMED, false, NEW_PATIENT_3_LAST_NAME)];
                case 1:
                    _c = _d.sent(), appointmentId = _c.appointmentId, slotTime = _c.slotTime;
                    return [4 /*yield*/, (0, VisitsPage_1.expectVisitsPage)(page)];
                case 2:
                    visitsPage = _d.sent();
                    return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
                case 3:
                    _d.sent();
                    return [4 /*yield*/, visitsPage.clickPrebookedTab()];
                case 4:
                    _d.sent();
                    return [4 /*yield*/, visitsPage.verifyVisitPresent(appointmentId, slotTime)];
                case 5:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
test_1.test.describe.skip('For existing patient', {
    tag: '@flaky',
}, function () {
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
                    return [4 /*yield*/, resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id)];
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
    (0, test_1.test)('Add walk-in visit for existing patient', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var appointmentId, visitsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, createAppointment(page, VISIT_TYPES.WALK_IN, true)];
                case 1:
                    appointmentId = (_c.sent()).appointmentId;
                    return [4 /*yield*/, (0, VisitsPage_1.expectVisitsPage)(page)];
                case 2:
                    visitsPage = _c.sent();
                    return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, visitsPage.clickInOfficeTab()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, visitsPage.verifyVisitPresent(appointmentId)];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Add pre-book visit for existing patient', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var _c, appointmentId, slotTime, visitsPage;
        var page = _b.page;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, createAppointment(page, VISIT_TYPES.PRE_BOOK, true)];
                case 1:
                    _c = _d.sent(), appointmentId = _c.appointmentId, slotTime = _c.slotTime;
                    return [4 /*yield*/, (0, VisitsPage_1.expectVisitsPage)(page)];
                case 2:
                    visitsPage = _d.sent();
                    return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
                case 3:
                    _d.sent();
                    return [4 /*yield*/, visitsPage.clickPrebookedTab()];
                case 4:
                    _d.sent();
                    return [4 /*yield*/, visitsPage.verifyVisitPresent(appointmentId, slotTime)];
                case 5:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Add post-telemed visit for existing patient', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var _c, appointmentId, slotTime, visitsPage;
        var page = _b.page;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, createAppointment(page, VISIT_TYPES.POST_TELEMED, true)];
                case 1:
                    _c = _d.sent(), appointmentId = _c.appointmentId, slotTime = _c.slotTime;
                    return [4 /*yield*/, (0, VisitsPage_1.expectVisitsPage)(page)];
                case 2:
                    visitsPage = _d.sent();
                    return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
                case 3:
                    _d.sent();
                    return [4 /*yield*/, visitsPage.clickPrebookedTab()];
                case 4:
                    _d.sent();
                    return [4 /*yield*/, visitsPage.verifyVisitPresent(appointmentId, slotTime)];
                case 5:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
// todo: don't write this here, create function in resource-handler
function createAppointment(page_1, visitType_1) {
    return __awaiter(this, arguments, void 0, function (page, visitType, existingPatient, lastName) {
        var addPatientPage, slotTime, appointmentCreationResponse, response, _a;
        if (existingPatient === void 0) { existingPatient = false; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, AddPatientPage_1.expectAddPatientPage)(page)];
                case 1:
                    addPatientPage = _b.sent();
                    return [4 /*yield*/, addPatientPage.selectOffice(constants_1.ENV_LOCATION_NAME)];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.enterMobilePhone(resource_handler_1.PATIENT_PHONE_NUMBER)];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.clickSearchForPatientsButton()];
                case 4:
                    _b.sent();
                    if (!existingPatient) return [3 /*break*/, 12];
                    return [4 /*yield*/, addPatientPage.selectExistingPatient(PATIENT_PREFILL_NAME)];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.clickPrefillForButton()];
                case 6:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.verifyPrefilledPatientName(PATIENT_PREFILL_NAME)];
                case 7:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.verifyPrefilledPatientBirthday(resource_handler_1.PATIENT_BIRTH_DATE_LONG)];
                case 8:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.verifyPrefilledPatientBirthSex(PATIENT_INPUT_GENDER)];
                case 9:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.verifyPrefilledPatientEmail(resource_handler_1.PATIENT_EMAIL)];
                case 10:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.selectReasonForVisit(resource_handler_1.PATIENT_REASON_FOR_VISIT)];
                case 11:
                    _b.sent();
                    return [3 /*break*/, 19];
                case 12: return [4 /*yield*/, addPatientPage.clickPatientNotFoundButton()];
                case 13:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.enterFirstName(resource_handler_1.PATIENT_FIRST_NAME)];
                case 14:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.enterLastName(lastName || '')];
                case 15:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.enterDateOfBirth(resource_handler_1.PATIENT_BIRTH_DATE_SHORT)];
                case 16:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.selectSexAtBirth(PATIENT_INPUT_GENDER)];
                case 17:
                    _b.sent();
                    return [4 /*yield*/, addPatientPage.selectReasonForVisit(resource_handler_1.PATIENT_REASON_FOR_VISIT)];
                case 18:
                    _b.sent();
                    _b.label = 19;
                case 19: return [4 /*yield*/, addPatientPage.selectVisitType(visitType)];
                case 20:
                    _b.sent();
                    if (!(visitType !== VISIT_TYPES.WALK_IN)) return [3 /*break*/, 22];
                    return [4 /*yield*/, addPatientPage.selectFirstAvailableSlot()];
                case 21:
                    slotTime = _b.sent();
                    _b.label = 22;
                case 22:
                    appointmentCreationResponse = (0, test_utils_1.waitForResponseWithData)(page, /\/create-appointment\//);
                    return [4 /*yield*/, addPatientPage.clickAddButton()];
                case 23:
                    _b.sent();
                    _a = utils_1.unpackFhirResponse;
                    return [4 /*yield*/, appointmentCreationResponse];
                case 24: return [4 /*yield*/, _a.apply(void 0, [_b.sent()])];
                case 25:
                    response = _b.sent();
                    if (!response.appointmentId) {
                        throw new Error('Appointment ID should be present in the response');
                    }
                    return [2 /*return*/, { appointmentId: response.appointmentId, slotTime: slotTime }];
            }
        });
    });
}
//# sourceMappingURL=addPatientPage.spec.js.map