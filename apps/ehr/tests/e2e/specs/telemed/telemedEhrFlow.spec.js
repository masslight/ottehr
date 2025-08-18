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
var constants_1 = require("../../../../src/constants");
var data_test_ids_1 = require("../../../../src/constants/data-test-ids");
var telemed_test_helpers_1 = require("../../../e2e-utils/helpers/telemed.test-helpers");
var tests_utils_1 = require("../../../e2e-utils/helpers/tests-utils");
var resource_handler_1 = require("../../../e2e-utils/resource-handler");
var DEFAULT_TIMEOUT = { timeout: 15000 };
function getTestUserQualificationStates(resourceHandler) {
    return __awaiter(this, void 0, void 0, function () {
        var testsUser, telemedLocations, availableStates, userQualificationStates;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, resourceHandler.getTestsUserAndPractitioner()];
                case 1:
                    testsUser = _a.sent();
                    return [4 /*yield*/, (0, utils_1.getTelemedLocations)(resourceHandler.apiClient)];
                case 2:
                    telemedLocations = _a.sent();
                    if (!telemedLocations) {
                        throw new Error('No Telemed locations available');
                    }
                    availableStates = new Set(telemedLocations.filter(function (location) { return location.available; }).map(function (location) { return location.state; }));
                    userQualificationStates = (0, utils_1.allLicensesForPractitioner)(testsUser.practitioner)
                        .filter(function (license) { return license.active && license.state && availableStates.has(license.state); })
                        .map(function (license) { return license.state; });
                    if (userQualificationStates.length < 1)
                        throw new Error('User has no qualification locations');
                    return [2 /*return*/, userQualificationStates];
            }
        });
    });
}
function getTestStateThatNotQualificationsStatesList(apiClient, qualificationStates) {
    return __awaiter(this, void 0, void 0, function () {
        var activeStates, activeStateNotInList;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, utils_1.getTelemedLocations)(apiClient)];
                case 1:
                    activeStates = (_a = (_b.sent())) === null || _a === void 0 ? void 0 : _a.filter(function (location) { return location.available; }).map(function (location) { return location.state; });
                    activeStateNotInList = activeStates === null || activeStates === void 0 ? void 0 : activeStates.find(function (state) { return !qualificationStates.includes(state); });
                    if (!activeStateNotInList)
                        throw new Error("Can't find active test state that not in list of test user qualifications states: ".concat(JSON.stringify(qualificationStates)));
                    return [2 /*return*/, activeStateNotInList];
            }
        });
    });
}
test_1.test.describe('Tests checking data without mutating state', function () {
    var myPatientsProcessId = "telemedEhrFlow.spec.ts-my-patients-non-mutating-".concat(luxon_1.DateTime.now().toMillis());
    var myPatientsTabAppointmentResources = new resource_handler_1.ResourceHandler(myPatientsProcessId, 'telemed');
    var otherPatientsProcessId = "telemedEhrFlow.spec.ts-other-patients-non-mutating-".concat(luxon_1.DateTime.now().toMillis());
    var otherPatientsTabAppointmentResources = new resource_handler_1.ResourceHandler(otherPatientsProcessId, 'telemed');
    var testsUserQualificationState;
    var randomState;
    test_1.test.beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var testsUserStates;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getTestUserQualificationStates(myPatientsTabAppointmentResources)];
                case 1:
                    testsUserStates = _a.sent();
                    testsUserQualificationState = testsUserStates[0];
                    return [4 /*yield*/, getTestStateThatNotQualificationsStatesList(myPatientsTabAppointmentResources.apiClient, testsUserStates)];
                case 2:
                    randomState = _a.sent();
                    return [4 /*yield*/, Promise.all([
                            myPatientsTabAppointmentResources.setResources({
                                telemedLocationState: testsUserQualificationState,
                            }),
                            otherPatientsTabAppointmentResources.setResources({
                                telemedLocationState: randomState,
                            }),
                        ])];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test_1.test.afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        myPatientsTabAppointmentResources.cleanupResources(),
                        otherPatientsTabAppointmentResources.cleanupResources(),
                    ])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)("Appointment should appear correctly in 'my patients' tab", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments")];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTableRow(myPatientsTabAppointmentResources.appointment.id))).toBeVisible({ timeout: 20000 })];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)("Appointment should appear correctly in 'all patients' tab.", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments")];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.allPatientsButton).click()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTableRow(otherPatientsTabAppointmentResources.appointment.id))).toBeVisible()];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Appointment has location label and is in a relevant location group', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var appointmentId, appointmentRow, locationGroup;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments")];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
                case 2:
                    _c.sent();
                    appointmentId = myPatientsTabAppointmentResources.appointment.id;
                    appointmentRow = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTableRow(appointmentId));
                    return [4 /*yield*/, appointmentRow.getAttribute('data-location-group')];
                case 3:
                    locationGroup = _c.sent();
                    (0, test_1.expect)(locationGroup === null || locationGroup === void 0 ? void 0 : locationGroup.toLowerCase()).toEqual(testsUserQualificationState.toLowerCase());
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('All appointments in my-patients section has appropriate assign buttons', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var table, allButtonsNames;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments")];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
                case 2:
                    _c.sent();
                    table = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
                    return [4 /*yield*/, table.getByRole('button').allTextContents()];
                case 3:
                    allButtonsNames = (_c.sent()).join(', ');
                    (0, test_1.expect)(allButtonsNames).not.toEqual(new RegExp('View'));
                    return [2 /*return*/];
            }
        });
    }); });
});
test_1.test.describe('Tests interacting with appointment state', function () {
    test_1.test.describe.configure({ mode: 'serial' });
    var PROCESS_ID = "telemedEhrFlow.spec.ts-appointment-state-".concat(luxon_1.DateTime.now().toMillis());
    var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientConditionPhotosStepAnswers;
        var patientInfo = _b.patientInfo, appointmentId = _b.appointmentId, authToken = _b.authToken, zambdaUrl = _b.zambdaUrl, projectId = _b.projectId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, test_utils_1.getPatientConditionPhotosStepAnswers)({
                        appointmentId: appointmentId,
                        authToken: authToken,
                        zambdaUrl: zambdaUrl,
                        projectId: projectId,
                        fileName: 'Landscape_1.jpg',
                    })];
                case 1:
                    patientConditionPhotosStepAnswers = _c.sent();
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
                            (0, utils_1.getMedicationsStepAnswers)(),
                            (0, utils_1.getAllergiesStepAnswers)(),
                            (0, utils_1.getMedicalConditionsStepAnswers)(),
                            (0, utils_1.getSurgicalHistoryStepAnswers)(),
                            (0, utils_1.getAdditionalQuestionsAnswers)(),
                            (0, utils_1.getPaymentOptionSelfPayAnswers)(),
                            (0, utils_1.getResponsiblePartyStepAnswers)({}),
                            (0, utils_1.getSchoolWorkNoteStepAnswers)(),
                            (0, utils_1.getConsentStepAnswers)({}),
                            (0, utils_1.getInviteParticipantStepAnswers)(),
                            patientConditionPhotosStepAnswers,
                        ]];
            }
        });
    }); });
    var context;
    var page;
    test_1.test.beforeAll(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
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
                    return [4 /*yield*/, context.close()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, page.close()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Appointment is present in tracking board, can be assigned and connection to patient is happening', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments")];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('Find and assign my appointment', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var table, appointmentRow;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        table = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
                                        appointmentRow = table.locator('tbody tr').filter({ hasText: (_a = resourceHandler.appointment) === null || _a === void 0 ? void 0 : _a.id });
                                        return [4 /*yield*/, (0, test_1.expect)(appointmentRow.filter({ has: page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardAssignButton) })).toBeVisible(DEFAULT_TIMEOUT)];
                                    case 1:
                                        _b.sent();
                                        return [4 /*yield*/, appointmentRow.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardAssignButton).click(DEFAULT_TIMEOUT)];
                                    case 2:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, tests_utils_1.telemedDialogConfirm)(page)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('Appointment has connect-to-patient button', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var statusChip;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        statusChip = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentStatusChip);
                                        return [4 /*yield*/, (0, test_1.expect)(statusChip).toBeVisible(DEFAULT_TIMEOUT)];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(statusChip).toHaveText(utils_1.TelemedAppointmentStatusEnum['pre-video'])];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible(DEFAULT_TIMEOUT)];
                                    case 3:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Buttons on visit page should appear, in assigned appointment', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonUnassign)).toBeVisible()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.cancelThisVisitButton)).toBeVisible()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.inviteParticipant)).toBeVisible()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.editPatientButtonSideBar)).toBeVisible()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Assigned appointment should be in "provider" tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments")];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(utils_1.ApptTelemedTab.provider)).click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id))).toBeVisible()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Unassign appointment, and check in "Ready for provider"', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonUnassign).click()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, tests_utils_1.telemedDialogConfirm)(page)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id))).toBeVisible()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test_1.test.skip('Check message for patient', { tag: '@flaky' }, function () { return __awaiter(void 0, void 0, void 0, function () {
        var expectedSms;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardChatButton(resourceHandler.appointment.id)).click()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.chatModalDescription)).toBeVisible()];
                case 2:
                    _a.sent();
                    expectedSms = 'Thank you for your patience. We apologize, but the provider is unexpectedly no longer available. You will receive an update when another provider is available';
                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(expectedSms).first()).toBeVisible({ timeout: 25000 })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Buttons on visit page should not appear', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).not.toBeVisible()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonUnassign)).not.toBeVisible()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.cancelThisVisitButton)).not.toBeVisible()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.inviteParticipant)).not.toBeVisible()];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.editPatientButtonSideBar)).not.toBeVisible()];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Assign my appointment back', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, telemed_test_helpers_1.assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo)(page, { forceWaitForAssignButton: true })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Patient provided hpi data', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, test_1.test.step('Medical conditions provided by patient', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionPatientProvidedList).getByText('Constipation')).toBeVisible()];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('Current medications provided by patient', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var list;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        list = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsPatientProvidedList);
                                        return [4 /*yield*/, (0, test_1.expect)(list.getByText('Amoxicillin')).toBeVisible()];
                                    case 1:
                                        _a.sent();
                                        // cSpell:disable-next Cetirizine
                                        return [4 /*yield*/, (0, test_1.expect)(list.getByText('Cetirizine/ Zyrtec')).toBeVisible()];
                                    case 2:
                                        // cSpell:disable-next Cetirizine
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('Known allergies provided by patient', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var list;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        list = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesPatientProvidedList);
                                        // cSpell:disable-next Azithromycin
                                        return [4 /*yield*/, (0, test_1.expect)(list.getByText('Azithromycin (medication)')).toBeVisible()];
                                    case 1:
                                        // cSpell:disable-next Azithromycin
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(list.getByText('Fish/ Fish Oil (other)')).toBeVisible()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('Surgical history provided by patient', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var list;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        list = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryPatientProvidedList);
                                        return [4 /*yield*/, (0, test_1.expect)(list.getByText('Circumcision')).toBeVisible()];
                                    case 1:
                                        _a.sent();
                                        // cSpell:disable-next Myringotomy
                                        return [4 /*yield*/, (0, test_1.expect)(list.getByText('Ear tube placement (Myringotomy)')).toBeVisible()];
                                    case 2:
                                        // cSpell:disable-next Myringotomy
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('Additional questions provided by patient', function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, test_1.expect)(page
                                            .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(utils_1.AdditionalBooleanQuestionsFieldsNames.CovidSymptoms))
                                            .getByText('No')).toBeVisible()];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(utils_1.AdditionalBooleanQuestionsFieldsNames.TestedPositiveCovid))
                                                .getByText('Yes')).toBeVisible()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(utils_1.AdditionalBooleanQuestionsFieldsNames.TravelUsa))
                                                .getByText('No')).toBeVisible()];
                                    case 3:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('Reason for visit provided by patient', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiReasonForVisit)).toHaveText((_a = resourceHandler.appointment.description) !== null && _a !== void 0 ? _a : '')];
                                    case 1:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('Condition photo provided by patient', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var block, image, imageSrc, zoomedImage;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        block = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiPatientConditionPhotos);
                                        image = block.locator('img');
                                        return [4 /*yield*/, (0, test_1.expect)(image).toHaveCount(1)];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, image.getAttribute('src')];
                                    case 2:
                                        imageSrc = _a.sent();
                                        (0, test_1.expect)(imageSrc).toContain(resourceHandler.patient.id);
                                        return [4 /*yield*/, image.click()];
                                    case 3:
                                        _a.sent();
                                        zoomedImage = page.locator("div[role='dialog'] img[alt='Patient condition photo #1']");
                                        return [4 /*yield*/, (0, test_1.expect)(zoomedImage).toBeVisible()];
                                    case 4:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should test appointment hpi fields', function () { return __awaiter(void 0, void 0, void 0, function () {
        var medicalConditionsPattern, surgicalHistoryPattern, surgicalNote, chiefComplaintNotes, chiefComplaintRos;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    medicalConditionsPattern = 'Z3A';
                    surgicalHistoryPattern = '44950';
                    surgicalNote = 'surgical note';
                    chiefComplaintNotes = 'chief complaint';
                    chiefComplaintRos = 'chief ros';
                    return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('await until hpi fields are ready', function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput)).toBeVisible()];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton)
                                                .first()).not.toBeVisible()];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('filling up all editable fields', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var _i, ADDITIONAL_QUESTIONS_1, question, _a, ADDITIONAL_QUESTIONS_2, question, chiefComplaintResponsePromise, rosResponsePromise;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, (0, test_utils_1.fillWaitAndSelectDropdown)(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput, medicalConditionsPattern)];
                                    case 1:
                                        _b.sent();
                                        // TODO: uncomment when erx is enabled
                                        // await fillWaitAndSelectDropdown(page, dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, knownAllergyPattern);
                                        return [4 /*yield*/, (0, test_utils_1.fillWaitAndSelectDropdown)(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryInput, surgicalHistoryPattern)];
                                    case 2:
                                        // TODO: uncomment when erx is enabled
                                        // await fillWaitAndSelectDropdown(page, dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, knownAllergyPattern);
                                        _b.sent();
                                        return [4 /*yield*/, page
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote)
                                                .locator('textarea')
                                                .first()
                                                .fill(surgicalNote)];
                                    case 3:
                                        _b.sent();
                                        _i = 0, ADDITIONAL_QUESTIONS_1 = constants_1.ADDITIONAL_QUESTIONS;
                                        _b.label = 4;
                                    case 4:
                                        if (!(_i < ADDITIONAL_QUESTIONS_1.length)) return [3 /*break*/, 7];
                                        question = ADDITIONAL_QUESTIONS_1[_i];
                                        // HERE WE TAKE ALL QUESTIONS ROWS AND SELECT TRUE LABELED RADIO BUTTON
                                        return [4 /*yield*/, page
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))
                                                .locator('input[type="radio"][value="true"]')
                                                .click()];
                                    case 5:
                                        // HERE WE TAKE ALL QUESTIONS ROWS AND SELECT TRUE LABELED RADIO BUTTON
                                        _b.sent();
                                        _b.label = 6;
                                    case 6:
                                        _i++;
                                        return [3 /*break*/, 4];
                                    case 7:
                                        _a = 0, ADDITIONAL_QUESTIONS_2 = constants_1.ADDITIONAL_QUESTIONS;
                                        _b.label = 8;
                                    case 8:
                                        if (!(_a < ADDITIONAL_QUESTIONS_2.length)) return [3 /*break*/, 11];
                                        question = ADDITIONAL_QUESTIONS_2[_a];
                                        return [4 /*yield*/, (0, test_1.expect)(page
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))
                                                .locator('input[type="radio"][value="true"]')).toBeEnabled()];
                                    case 9:
                                        _b.sent();
                                        _b.label = 10;
                                    case 10:
                                        _a++;
                                        return [3 /*break*/, 8];
                                    case 11:
                                        chiefComplaintResponsePromise = (0, test_utils_1.waitForSaveChartDataResponse)(page, function (json) { var _a; return !!((_a = json.chartData.chiefComplaint) === null || _a === void 0 ? void 0 : _a.resourceId); });
                                        rosResponsePromise = (0, test_utils_1.waitForSaveChartDataResponse)(page, function (json) { var _a; return !!((_a = json.chartData.ros) === null || _a === void 0 ? void 0 : _a.resourceId); });
                                        return [4 /*yield*/, page
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes)
                                                .locator('textarea')
                                                .first()
                                                .fill(chiefComplaintNotes)];
                                    case 12:
                                        _b.sent();
                                        return [4 /*yield*/, page
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintRos)
                                                .locator('textarea')
                                                .first()
                                                .fill(chiefComplaintRos)];
                                    case 13:
                                        _b.sent();
                                        return [4 /*yield*/, chiefComplaintResponsePromise];
                                    case 14:
                                        _b.sent();
                                        return [4 /*yield*/, rosResponsePromise];
                                    case 15:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('reload and wait until data is loaded', function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, page.reload()];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton)
                                                .first()).not.toBeVisible()];
                                    case 3:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('check medical conditions list', function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible()];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(RegExp(medicalConditionsPattern))];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 5:
                    _a.sent();
                    // TODO: uncomment when erx is enabled
                    // await test.step('check known allergies list', async () => {
                    //   await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible();
                    //   await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toHaveText(
                    //     RegExp(knownAllergyPattern)
                    //   );
                    // });
                    return [4 /*yield*/, test_1.test.step('check surgical history list and note', function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote).locator('textarea').first()).toHaveText(surgicalNote)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 6:
                    // TODO: uncomment when erx is enabled
                    // await test.step('check known allergies list', async () => {
                    //   await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible();
                    //   await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toHaveText(
                    //     RegExp(knownAllergyPattern)
                    //   );
                    // });
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('check additional questions', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var _i, ADDITIONAL_QUESTIONS_3, question;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _i = 0, ADDITIONAL_QUESTIONS_3 = constants_1.ADDITIONAL_QUESTIONS;
                                        _a.label = 1;
                                    case 1:
                                        if (!(_i < ADDITIONAL_QUESTIONS_3.length)) return [3 /*break*/, 4];
                                        question = ADDITIONAL_QUESTIONS_3[_i];
                                        return [4 /*yield*/, (0, test_1.expect)(page
                                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))
                                                .locator('input[value=true]')).toBeChecked()];
                                    case 2:
                                        _a.sent();
                                        _a.label = 3;
                                    case 3:
                                        _i++;
                                        return [3 /*break*/, 1];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('chief complaint notes and ros', function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes).locator('textarea').first()).toHaveText(chiefComplaintNotes)];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).locator('textarea').first()).toHaveText(chiefComplaintRos)];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should test connect to patient is working', function () { return __awaiter(void 0, void 0, void 0, function () {
        var connectButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    connectButton = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
                    return [4 /*yield*/, (0, test_1.expect)(connectButton).toBeVisible(DEFAULT_TIMEOUT)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, connectButton.click(DEFAULT_TIMEOUT)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, tests_utils_1.telemedDialogConfirm)(page)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible(DEFAULT_TIMEOUT)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
test_1.test.describe('Telemed appointment with two locations (physical and virtual)', function () {
    test_1.test.describe('Tests not interacting with appointment state', function () {
        var PROCESS_ID = "telemedEhrFlow.spec.ts-2-locs-no-appointment-state-".concat(luxon_1.DateTime.now().toMillis());
        var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
        var location;
        test_1.test.beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, createAppointmentWithVirtualAndPhysicalLocations(resourceHandler)];
                    case 1:
                        location = _a.sent();
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
        (0, test_1.test)('Appointment is present in tracking board and searchable by location filter', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var page = _b.page;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, page.goto("telemed/appointments")];
                    case 1:
                        _c.sent();
                        return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
                    case 2:
                        _c.sent();
                        return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardLocationsSelect).locator('input').click()];
                    case 3:
                        _c.sent();
                        return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardLocationsSelectOption(location.id)).click()];
                    case 4:
                        _c.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id))).toBeVisible(DEFAULT_TIMEOUT)];
                    case 5:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    test_1.test.describe('Tests interacting with appointment state', function () {
        var PROCESS_ID = "telemedEhrFlow.spec.ts-2-locs-appointment-state-".concat(luxon_1.DateTime.now().toMillis());
        var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
        test_1.test.beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, createAppointmentWithVirtualAndPhysicalLocations(resourceHandler)];
                    case 1:
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
        (0, test_1.test)('Appointment is present in tracking board, can be assigned and connection to patient is happening', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var page = _b.page;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, page.goto("telemed/appointments")];
                    case 1:
                        _c.sent();
                        return [4 /*yield*/, (0, tests_utils_1.awaitAppointmentsTableToBeVisible)(page)];
                    case 2:
                        _c.sent();
                        return [4 /*yield*/, test_1.test.step('Find and assign my appointment', function () { return __awaiter(void 0, void 0, void 0, function () {
                                var table, appointmentRow;
                                var _a, _b;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            table = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
                                            appointmentRow = table.locator('tbody tr').filter({ hasText: (_b = (_a = resourceHandler.appointment) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : '' });
                                            return [4 /*yield*/, (0, test_1.expect)(appointmentRow.filter({ has: page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardAssignButton) })).toBeVisible(DEFAULT_TIMEOUT)];
                                        case 1:
                                            _c.sent();
                                            return [4 /*yield*/, appointmentRow.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardAssignButton).click(DEFAULT_TIMEOUT)];
                                        case 2:
                                            _c.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 3:
                        _c.sent();
                        return [4 /*yield*/, (0, tests_utils_1.telemedDialogConfirm)(page)];
                    case 4:
                        _c.sent();
                        return [4 /*yield*/, test_1.test.step('Appointment has connect-to-patient button', function () { return __awaiter(void 0, void 0, void 0, function () {
                                var statusChip;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            statusChip = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentStatusChip);
                                            return [4 /*yield*/, (0, test_1.expect)(statusChip).toBeVisible(DEFAULT_TIMEOUT)];
                                        case 1:
                                            _a.sent();
                                            // todo: is it ok to have check like this that rely on status text??
                                            return [4 /*yield*/, (0, test_1.expect)(statusChip).toHaveText(utils_1.TelemedAppointmentStatusEnum['pre-video'])];
                                        case 2:
                                            // todo: is it ok to have check like this that rely on status text??
                                            _a.sent();
                                            return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible(DEFAULT_TIMEOUT)];
                                        case 3:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 5:
                        _c.sent();
                        return [4 /*yield*/, test_1.test.step('Connect to patient', function () { return __awaiter(void 0, void 0, void 0, function () {
                                var connectButton;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            connectButton = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
                                            return [4 /*yield*/, (0, test_1.expect)(connectButton).toBeVisible(DEFAULT_TIMEOUT)];
                                        case 1:
                                            _a.sent();
                                            return [4 /*yield*/, connectButton.click(DEFAULT_TIMEOUT)];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, (0, tests_utils_1.telemedDialogConfirm)(page)];
                                        case 3:
                                            _a.sent();
                                            return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible(DEFAULT_TIMEOUT)];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 6:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
function createAppointmentWithVirtualAndPhysicalLocations(resourceHandler) {
    return __awaiter(this, void 0, void 0, function () {
        var oystehr, physicalLocation, _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, resource_handler_1.ResourceHandler.getOystehr()];
                case 1:
                    oystehr = _d.sent();
                    _b = (_a = Promise).all;
                    _c = [new Promise(function (resolve, reject) {
                            oystehr.fhir
                                .search({
                                resourceType: 'Location',
                                params: [
                                    {
                                        name: '_count',
                                        value: '1000',
                                    },
                                ],
                            })
                                .then(function (locations) {
                                var nonVirtualLocation = locations
                                    .unbundle()
                                    .filter(function (location) { return location.resourceType === 'Location'; })
                                    .find(function (location) { return !(0, utils_1.isLocationVirtual)(location); });
                                if (!nonVirtualLocation) {
                                    throw new Error('No non-virtual location found');
                                }
                                resolve(nonVirtualLocation);
                            })
                                .catch(function (error) {
                                reject(error);
                            });
                        })];
                    return [4 /*yield*/, resourceHandler.setResources()];
                case 2: return [4 /*yield*/, _b.apply(_a, [_c.concat([
                            _d.sent()
                        ])])];
                case 3:
                    physicalLocation = (_d.sent())[0];
                    return [4 /*yield*/, oystehr.fhir.patch({
                            resourceType: 'Appointment',
                            id: resourceHandler.appointment.id,
                            operations: [
                                {
                                    op: 'add',
                                    path: '/participant/-',
                                    value: {
                                        actor: {
                                            reference: "Location/".concat(physicalLocation.id),
                                        },
                                        status: 'accepted',
                                    },
                                },
                            ],
                        })];
                case 4:
                    _d.sent();
                    return [2 /*return*/, physicalLocation];
            }
        });
    });
}
//# sourceMappingURL=telemedEhrFlow.spec.js.map