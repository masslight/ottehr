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
var data_test_ids_1 = require("../../../../src/constants/data-test-ids");
var tests_utils_1 = require("../../../e2e-utils/helpers/tests-utils");
var resource_handler_1 = require("../../../e2e-utils/resource-handler");
var PROCESS_ID = "videoCallFlow.spec.ts-".concat(luxon_1.DateTime.now().toMillis());
var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
var page;
test_1.test.beforeAll(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var context;
    var browser = _b.browser;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, browser.newContext()];
            case 1:
                context = _c.sent();
                return [4 /*yield*/, context.newPage()];
            case 2:
                page = _c.sent();
                return [4 /*yield*/, resourceHandler.setResources()];
            case 3:
                _c.sent();
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
test_1.test.describe.configure({ mode: 'serial' });
(0, test_1.test)('Should assign visit to practitioner', function () { return __awaiter(void 0, void 0, void 0, function () {
    var statusChip;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, page.goto("telemed/appointments")];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
            case 2:
                _a.sent();
                return [4 /*yield*/, page
                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id))
                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardAssignButton)
                        .click()];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, tests_utils_1.telemedDialogConfirm)(page)];
            case 4:
                _a.sent();
                statusChip = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentStatusChip);
                return [4 /*yield*/, (0, test_1.expect)(statusChip).toBeVisible()];
            case 5:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(statusChip).toHaveText(utils_1.TelemedAppointmentStatusEnum['pre-video'])];
            case 6:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Should start video call', function () { return __awaiter(void 0, void 0, void 0, function () {
    var connectButton;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                connectButton = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
                return [4 /*yield*/, (0, test_1.expect)(connectButton).toBeVisible()];
            case 1:
                _a.sent();
                return [4 /*yield*/, connectButton.click()];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, tests_utils_1.telemedDialogConfirm)(page)];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible()];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Appointment status should be "on-video" during the call', function () { return __awaiter(void 0, void 0, void 0, function () {
    var statusChip;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                statusChip = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentStatusChip);
                return [4 /*yield*/, (0, test_1.expect)(statusChip).toBeVisible()];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(statusChip).toHaveText(utils_1.TelemedAppointmentStatusEnum['on-video'])];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Should end video call and check status "unsigned"', function () { return __awaiter(void 0, void 0, void 0, function () {
    var statusChip;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.endVideoCallButton).click()];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, tests_utils_1.telemedDialogConfirm)(page)];
            case 2:
                _a.sent();
                statusChip = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentStatusChip);
                return [4 /*yield*/, (0, test_1.expect)(statusChip).toBeVisible()];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(statusChip).toHaveText(utils_1.TelemedAppointmentStatusEnum['unsigned'])];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Visit should be in "unsigned" tab on the tracking board', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, page.goto("telemed/appointments")];
            case 1:
                _a.sent();
                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(utils_1.ApptTelemedTab['not-signed'])).click()];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id))).toBeVisible()];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Should fill all required fields', function () { return __awaiter(void 0, void 0, void 0, function () {
    var diagnosisAutocomplete, dropdownOptions, emAutocomplete, patientInfoConfirmationCheckbox, confirmationChecked;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
            case 1:
                _a.sent();
                return [4 /*yield*/, page
                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.assessment))
                        .click()];
            case 2:
                _a.sent();
                diagnosisAutocomplete = page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.diagnosisDropdown);
                return [4 /*yield*/, (0, test_1.expect)(diagnosisAutocomplete).toBeVisible()];
            case 3:
                _a.sent();
                return [4 /*yield*/, diagnosisAutocomplete.click()];
            case 4:
                _a.sent();
                return [4 /*yield*/, diagnosisAutocomplete.locator('input').fill('fever')];
            case 5:
                _a.sent();
                dropdownOptions = page.getByRole('option');
                return [4 /*yield*/, dropdownOptions.first().waitFor()];
            case 6:
                _a.sent();
                return [4 /*yield*/, page.keyboard.press('ArrowDown')];
            case 7:
                _a.sent();
                return [4 /*yield*/, page.keyboard.press('Enter')];
            case 8:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(diagnosisAutocomplete.locator('input')).toBeEnabled()];
            case 9:
                _a.sent();
                emAutocomplete = page.getByTestId(data_test_ids_1.dataTestIds.assessmentCard.emCodeDropdown);
                return [4 /*yield*/, (0, test_1.expect)(emAutocomplete).toBeVisible()];
            case 10:
                _a.sent();
                return [4 /*yield*/, emAutocomplete.click()];
            case 11:
                _a.sent();
                return [4 /*yield*/, emAutocomplete.locator('input').fill('1')];
            case 12:
                _a.sent();
                dropdownOptions = page.getByRole('option');
                return [4 /*yield*/, dropdownOptions.first().waitFor()];
            case 13:
                _a.sent();
                return [4 /*yield*/, page.keyboard.press('ArrowDown')];
            case 14:
                _a.sent();
                return [4 /*yield*/, page.keyboard.press('Enter')];
            case 15:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(emAutocomplete.locator('input')).toBeEnabled()];
            case 16:
                _a.sent();
                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
            case 17:
                _a.sent();
                return [4 /*yield*/, (0, test_utils_1.waitForGetChartDataResponse)(page, function (json) { return !!json.prescribedMedications; })];
            case 18:
                _a.sent();
                patientInfoConfirmationCheckbox = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.patientInfoConfirmationCheckbox);
                return [4 /*yield*/, patientInfoConfirmationCheckbox.isChecked()];
            case 19:
                confirmationChecked = _a.sent();
                if (!!confirmationChecked) return [3 /*break*/, 23];
                return [4 /*yield*/, (0, test_1.expect)(patientInfoConfirmationCheckbox).toBeVisible()];
            case 20:
                _a.sent();
                return [4 /*yield*/, patientInfoConfirmationCheckbox.click()];
            case 21:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(patientInfoConfirmationCheckbox).toBeEnabled()];
            case 22:
                _a.sent();
                _a.label = 23;
            case 23: return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Should sign visit', function () { return __awaiter(void 0, void 0, void 0, function () {
    var statusChip;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.reviewAndSignButton).click()];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, tests_utils_1.telemedDialogConfirm)(page)];
            case 2:
                _a.sent();
                statusChip = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentStatusChip);
                return [4 /*yield*/, (0, test_1.expect)(statusChip).toBeVisible()];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(statusChip).toHaveText(utils_1.TelemedAppointmentStatusEnum['complete'])];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
//# sourceMappingURL=videoCallFlow.spec.js.map