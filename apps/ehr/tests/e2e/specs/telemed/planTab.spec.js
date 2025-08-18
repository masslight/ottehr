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
var telemed_test_helpers_1 = require("../../../e2e-utils/helpers/telemed.test-helpers");
var tests_utils_1 = require("../../../e2e-utils/helpers/tests-utils");
var resource_handler_1 = require("../../../e2e-utils/resource-handler");
test_1.test.describe('Disposition', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        test_1.test.describe('Primary Care Physician', function () { return __awaiter(void 0, void 0, void 0, function () {
            var PROCESS_ID, resourceHandler, page, defaultNote, updatedNote, followUpMenuOption, followUpMessage;
            return __generator(this, function (_a) {
                PROCESS_ID = "planTab.spec.ts-disposition-".concat(luxon_1.DateTime.now().toMillis());
                resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
                defaultNote = 'Please see your Primary Care Physician as discussed.';
                updatedNote = 'Lorem ipsum';
                followUpMenuOption = '3 days';
                followUpMessage = 'Follow-up visit in 3 days';
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
                                return [4 /*yield*/, resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id)];
                            case 4:
                                _c.sent();
                                return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                            case 5:
                                _c.sent();
                                return [4 /*yield*/, (0, telemed_test_helpers_1.assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo)(page, { forceWaitForAssignButton: true })];
                            case 6:
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
                (0, test_1.test)("Should check 'Primary Care Physician' is selected by default", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var primaryCarePhysicianButton, attribute;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.plan)).click()];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionContainer)).toBeVisible()];
                            case 2:
                                _a.sent();
                                primaryCarePhysicianButton = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionToggleButton('pcp-no-type'));
                                return [4 /*yield*/, primaryCarePhysicianButton.getAttribute('aria-pressed')];
                            case 3:
                                attribute = _a.sent();
                                (0, test_1.expect)(attribute).toBe('true');
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)("Should check 'Follow up visit in' drop down and 'Note' field are present for 'Primary Care Physician' selected", function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown)).toBeVisible()];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionNote)).toBeVisible()];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)("Should check 'Note' section has pre-filled text for 'Primary Care Physician'", function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionNote)).toHaveText(new RegExp(defaultNote))];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)("Should select some 'Follow up visit in' option", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var option;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown).click()];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, (0, tests_utils_1.getDropdownOption)(page, followUpMenuOption)];
                            case 2:
                                option = _a.sent();
                                return [4 /*yield*/, option.click()];
                            case 3:
                                _a.sent();
                                return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                            case 4:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)("Should update 'Primary Care Physician' 'Note' section", function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page
                                    .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionNote)
                                    .locator('textarea')
                                    .first()
                                    .fill(updatedNote)];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)('Should check follow up message and note are saved on Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var patientInstructionsContainer;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                            case 1:
                                _a.sent();
                                patientInstructionsContainer = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabPatientInstructionsContainer);
                                return [4 /*yield*/, (0, test_1.expect)(patientInstructionsContainer).toBeVisible()];
                            case 2:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(patientInstructionsContainer).toHaveText(new RegExp(updatedNote))];
                            case 3:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(patientInstructionsContainer).toHaveText(new RegExp(followUpMessage))];
                            case 4:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/];
            });
        }); });
        test_1.test.describe('Transfer to another location', function () { return __awaiter(void 0, void 0, void 0, function () {
            var PROCESS_ID, resourceHandler, page, defaultNote, updatedNote, reasonForTransferOption;
            return __generator(this, function (_a) {
                PROCESS_ID = "planTab.spec.ts-transfer-".concat(luxon_1.DateTime.now().toMillis());
                resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
                defaultNote = 'Please proceed to the ABC Office as advised.';
                updatedNote = 'Lorem ipsum';
                reasonForTransferOption = 'Equipment availability';
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
                                return [4 /*yield*/, resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id)];
                            case 4:
                                _c.sent();
                                return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                            case 5:
                                _c.sent();
                                return [4 /*yield*/, (0, telemed_test_helpers_1.assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo)(page, { forceWaitForAssignButton: true })];
                            case 6:
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
                (0, test_1.test)("Should check 'Reason for transfer' drop down and 'Note' field are present for 'Transfer to another location' selected", function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.plan)).click()];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionContainer)).toBeVisible()];
                            case 2:
                                _a.sent();
                                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionToggleButton('another')).click()];
                            case 3:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionReasonForTransferDropdown)).toBeVisible()];
                            case 4:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionNote)).toBeVisible()];
                            case 5:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)("Should check 'Note' section has pre-filled text for 'Transfer to another location' selected", function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionNote)).toHaveText(new RegExp(defaultNote))];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)("Should select some 'Reason for transfer' option", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var option;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionReasonForTransferDropdown).click()];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, (0, tests_utils_1.getDropdownOption)(page, reasonForTransferOption)];
                            case 2:
                                option = _a.sent();
                                return [4 /*yield*/, option.click()];
                            case 3:
                                _a.sent();
                                return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                            case 4:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)('Should edit transfer Note', function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionNote)).toHaveText(new RegExp(defaultNote))];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, page
                                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionNote)
                                        .locator('textarea')
                                        .first()
                                        .fill(updatedNote)];
                            case 2:
                                _a.sent();
                                return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                            case 3:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)('Should check reason for transfer and note are saved on Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var patientInstructionsContainer;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                            case 1:
                                _a.sent();
                                patientInstructionsContainer = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabPatientInstructionsContainer);
                                return [4 /*yield*/, (0, test_1.expect)(patientInstructionsContainer).toHaveText(new RegExp(updatedNote))];
                            case 2:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(patientInstructionsContainer).toHaveText(new RegExp(reasonForTransferOption))];
                            case 3:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/];
            });
        }); });
        test_1.test.describe('Specialty transfer', function () { return __awaiter(void 0, void 0, void 0, function () {
            var PROCESS_ID, resourceHandler, page, updatedNote, followUpMenuOption, followUpMessage;
            return __generator(this, function (_a) {
                PROCESS_ID = "planTab.spec.ts-specialty-transfer-".concat(luxon_1.DateTime.now().toMillis());
                resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
                updatedNote = 'Lorem ipsum';
                followUpMenuOption = '3 days';
                followUpMessage = 'Follow-up visit in 3 days';
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
                                return [4 /*yield*/, resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id)];
                            case 4:
                                _c.sent();
                                return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                            case 5:
                                _c.sent();
                                return [4 /*yield*/, (0, telemed_test_helpers_1.assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo)(page, { forceWaitForAssignButton: true })];
                            case 6:
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
                (0, test_1.test)("Should check 'Follow up visit in' drop down and 'Note' field are present for 'Specialty transfer' selected", function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.plan)).click()];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionContainer)).toBeVisible()];
                            case 2:
                                _a.sent();
                                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionToggleButton('specialty')).click()];
                            case 3:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown)).toBeVisible()];
                            case 4:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionNote)).toBeVisible()];
                            case 5:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)("Should check 'Note' field is empty by default for 'Specialty transfer' selected", function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionNote).locator('textarea').first()).toHaveText('')];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)("Should select some 'Follow up visit in' option", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var option;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown).click()];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, (0, tests_utils_1.getDropdownOption)(page, followUpMenuOption)];
                            case 2:
                                option = _a.sent();
                                return [4 /*yield*/, option.click()];
                            case 3:
                                _a.sent();
                                return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                            case 4:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)('Should edit transfer note', function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page
                                    .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.planTabDispositionNote)
                                    .locator('textarea')
                                    .first()
                                    .fill(updatedNote)];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                (0, test_1.test)('Should check follow up message and transfer note are saved on Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var patientInstructionsContainer;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                            case 1:
                                _a.sent();
                                patientInstructionsContainer = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabPatientInstructionsContainer);
                                return [4 /*yield*/, (0, test_1.expect)(patientInstructionsContainer).toHaveText(new RegExp(updatedNote))];
                            case 2:
                                _a.sent();
                                return [4 /*yield*/, (0, test_1.expect)(patientInstructionsContainer).toHaveText(new RegExp(followUpMessage))];
                            case 3:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/];
            });
        }); });
        return [2 /*return*/];
    });
}); });
//# sourceMappingURL=planTab.spec.js.map