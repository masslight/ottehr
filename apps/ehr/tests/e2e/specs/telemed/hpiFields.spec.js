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
function checkDropdownNoOptions(page, dropdownTestId, searchOption, message) {
    return __awaiter(this, void 0, void 0, function () {
        var input, dropdownNoOptions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    input = page.getByTestId(dropdownTestId).locator('input');
                    return [4 /*yield*/, input.click()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, page.waitForTimeout(10000)];
                case 2:
                    _a.sent(); // todo something async causes flakiness here
                    return [4 /*yield*/, input.fill(searchOption)];
                case 3:
                    _a.sent();
                    dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
                    return [4 /*yield*/, dropdownNoOptions.waitFor()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(dropdownNoOptions).toHaveText(message)];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
test_1.test.describe('Check all hpi fields common functionality, without changing data', function () {
    var PROCESS_ID = "hpiFields.spec.ts-common-func-".concat(luxon_1.DateTime.now().toMillis());
    var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
    var startTypingMessage = 'Start typing to load results';
    var searchOptionThatNotInList = 'undefined';
    var noOptionsMessage = 'Nothing found for this search criteria';
    test_1.test.beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
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
    test_1.test.beforeEach(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, telemed_test_helpers_1.assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo)(page)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.telemedNewOrExistingPatient)).toBeVisible()];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Medical conditions. Should display message before typing in field', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput).locator('input').click()];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.locator('.MuiAutocomplete-noOptions')).toHaveText(startTypingMessage)];
                case 2:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Medical conditions. Should check not-in-list item search try', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, checkDropdownNoOptions(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput, searchOptionThatNotInList, noOptionsMessage)];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Current medications. Should display message before typing in field', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput).locator('input').click()];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.locator('.MuiAutocomplete-noOptions')).toHaveText(startTypingMessage)];
                case 2:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Current medications. Should check not-in-list item search try', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, checkDropdownNoOptions(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput, searchOptionThatNotInList, noOptionsMessage)];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Known allergies. Should display message before typing in field', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, checkDropdownNoOptions(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, '', startTypingMessage)];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Known allergies. Should check not-in-list item search try', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var input, option;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    input = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput).locator('input');
                    return [4 /*yield*/, input.click()];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, page.waitForTimeout(10000)];
                case 2:
                    _c.sent(); // todo something async causes flakiness here
                    return [4 /*yield*/, input.fill(noOptionsMessage)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, (0, tests_utils_1.getDropdownOption)(page, 'Other')];
                case 4:
                    option = _c.sent();
                    return [4 /*yield*/, (0, test_1.expect)(option).toBeVisible()];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Surgical history. Should check not-in-list item search try', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, checkDropdownNoOptions(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryInput, searchOptionThatNotInList, noOptionsMessage)];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
test_1.test.describe('Medical conditions', function () { return __awaiter(void 0, void 0, void 0, function () {
    var PROCESS_ID, resourceHandler, page, conditionName, conditionIcdCode;
    return __generator(this, function (_a) {
        PROCESS_ID = "hpiFields.spec.ts-medical-conditions-".concat(luxon_1.DateTime.now().toMillis());
        resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
        conditionName = 'anemia';
        conditionIcdCode = 'D60';
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
        (0, test_1.test)('Should search medical condition, and select it', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, tests_utils_1.checkDropdownHasOptionAndSelectIt)(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput, conditionName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Should search medical condition by ICD10 code, and select it', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, tests_utils_1.checkDropdownHasOptionAndSelectIt)(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput, conditionIcdCode)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Reload and check medical conditions are saved in HPI tab', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, test_1.test.step('reload and wait until data is loaded', function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, page.reload()];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)).toBeVisible()];
                                    case 3:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible()];
                                    case 4:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step('check medical condition saved', function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(RegExp(conditionName, 'i'))];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step('check medical condition searched by ICD10 code saved', function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(RegExp(conditionIcdCode, 'i'))];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Should check medical conditions appear in Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer)).toHaveText(new RegExp(conditionName, 'i'))];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer)).toHaveText(new RegExp(conditionIcdCode, 'i'))];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Should delete medical condition', function () { return __awaiter(void 0, void 0, void 0, function () {
            var medicalConditionListItem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible()];
                    case 2:
                        _a.sent();
                        medicalConditionListItem = page
                            .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionListItem)
                            .filter({ hasText: new RegExp(conditionName, 'i') })
                            .first();
                        return [4 /*yield*/, medicalConditionListItem.getByTestId(data_test_ids_1.dataTestIds.deleteOutlinedIcon).click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(medicalConditionListItem).not.toBeVisible()];
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Should confirm medical condition deleted, in HPI and in Review&Sign tabs', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, test_1.test.step('Confirm deletion in hpi tab', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var column;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, page.reload()];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                                    case 2:
                                        _a.sent();
                                        column = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn);
                                        return [4 /*yield*/, (0, test_1.expect)(column).toBeVisible()];
                                    case 3:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(column.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()).not.toBeVisible({
                                                timeout: 30000,
                                            })];
                                    case 4:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByText(new RegExp(conditionName, 'i'))).not.toBeVisible()];
                                    case 5:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step('Confirm deletion in Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                                        case 1:
                                            _a.sent();
                                            return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.visitNoteCard)).toBeVisible()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer)).toBeVisible()];
                                        case 3:
                                            _a.sent();
                                            return [4 /*yield*/, (0, test_1.expect)(page.getByText(new RegExp(conditionName, 'i'))).not.toBeVisible()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
// TODO: uncomment when erx is enabled
test_1.test.describe.skip('Current medications', function () {
    var PROCESS_ID = "hpiFields.spec.ts-current-meds-".concat(luxon_1.DateTime.now().toMillis());
    var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
    var page;
    var scheduledMedicationName = 'aspirin';
    var scheduledMedicationDose = '100';
    var scheduledMedicationDate = '01/01/2025';
    var scheduledMedicationTime = '10:00 AM';
    var asNeededMedicationName = 'ibuprofen';
    var asNeededMedicationDose = '200';
    var asNeededMedicationDate = '01/01/2025';
    var asNeededMedicationTime = '10:00 AM';
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
                    if (!(process.env.INTEGRATION_TEST === 'true')) return [3 /*break*/, 4];
                    return [4 /*yield*/, resourceHandler.setResourcesFast()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 7];
                case 4: return [4 /*yield*/, resourceHandler.setResources()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id)];
                case 6:
                    _c.sent();
                    _c.label = 7;
                case 7: return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, (0, telemed_test_helpers_1.assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo)(page, { forceWaitForAssignButton: true })];
                case 9:
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
    (0, test_1.test)('Should create scheduled medication', function () { return __awaiter(void 0, void 0, void 0, function () {
        var dateLocator;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, tests_utils_1.checkDropdownHasOptionAndSelectIt)(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput, scheduledMedicationName)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, page
                            .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDoseInput)
                            .locator('input')
                            .fill(scheduledMedicationDose)];
                case 2:
                    _a.sent();
                    dateLocator = page
                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDateTimeInput)
                        .locator('input');
                    return [4 /*yield*/, dateLocator.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, dateLocator.pressSequentially(scheduledMedicationDate.concat(' ', scheduledMedicationTime))];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton).click()];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton)).toBeEnabled()];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check scheduled medication is saved in HPI tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scheduledMedicationList;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    scheduledMedicationList = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledList);
                    return [4 /*yield*/, (0, test_1.expect)(scheduledMedicationList).toHaveText(RegExp(scheduledMedicationName, 'i'))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(scheduledMedicationList).toHaveText(RegExp(scheduledMedicationDose, 'i'))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(scheduledMedicationList).toHaveText(RegExp(scheduledMedicationDate, 'i'))];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(scheduledMedicationList).toHaveText(RegExp(scheduledMedicationTime, 'i'))];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should create as needed medication', function () { return __awaiter(void 0, void 0, void 0, function () {
        var dateLocator;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededRadioButton).click()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, tests_utils_1.checkDropdownHasOptionAndSelectIt)(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput, asNeededMedicationName)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, page
                            .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDoseInput)
                            .locator('input')
                            .fill(asNeededMedicationDose)];
                case 3:
                    _a.sent();
                    dateLocator = page
                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDateTimeInput)
                        .locator('input');
                    return [4 /*yield*/, dateLocator.click()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, dateLocator.pressSequentially(asNeededMedicationDate.concat(' ', asNeededMedicationTime))];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton).click()];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton)).toBeEnabled()];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check as needed medication is saved in HPI tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        var asNeededMedicationList;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    asNeededMedicationList = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededList);
                    return [4 /*yield*/, (0, test_1.expect)(asNeededMedicationList).toHaveText(RegExp(asNeededMedicationName, 'i'))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(asNeededMedicationList).toHaveText(RegExp(asNeededMedicationDose, 'i'))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(asNeededMedicationList).toHaveText(RegExp(asNeededMedicationDate, 'i'))];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(asNeededMedicationList).toHaveText(RegExp(asNeededMedicationTime, 'i'))];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should test required fields validation works', function () { return __awaiter(void 0, void 0, void 0, function () {
        var medicationInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    medicationInput = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput);
                    return [4 /*yield*/, (0, test_1.expect)(medicationInput.locator('label')).toHaveClass(/Mui-required/)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(medicationInput.locator('input[required]:invalid')).toBeVisible()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton).click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton)).toBeEnabled()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check medications appear on Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer)).toBeVisible()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(RegExp(scheduledMedicationName, 'i'))).toBeVisible()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(RegExp(asNeededMedicationName, 'i'))).toBeVisible()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should delete scheduled medication', function () { return __awaiter(void 0, void 0, void 0, function () {
        var scheduledMedicationListItem;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('scheduled'))).toBeVisible()];
                case 2:
                    _a.sent();
                    scheduledMedicationListItem = page
                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsListItem(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('scheduled')))
                        .filter({ hasText: new RegExp(scheduledMedicationName, 'i') })
                        .first();
                    return [4 /*yield*/, scheduledMedicationListItem.getByTestId(data_test_ids_1.dataTestIds.deleteOutlinedIcon).click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(scheduledMedicationListItem).not.toBeVisible()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should delete as needed medication', function () { return __awaiter(void 0, void 0, void 0, function () {
        var asNeededMedicationListItem;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('as-needed'))).toBeVisible()];
                case 1:
                    _a.sent();
                    asNeededMedicationListItem = page
                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsListItem(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('as-needed')))
                        .filter({ hasText: new RegExp(asNeededMedicationName, 'i') })
                        .first();
                    return [4 /*yield*/, asNeededMedicationListItem.getByTestId(data_test_ids_1.dataTestIds.deleteOutlinedIcon).click()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(asNeededMedicationListItem).not.toBeVisible()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should confirm medications are deleted on Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer)).toBeVisible()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(RegExp(scheduledMedicationName, 'i'))).not.toBeVisible()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer)).toBeVisible()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(RegExp(asNeededMedicationName, 'i'))).not.toBeVisible()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
// TODO: uncomment when erx is enabled
test_1.test.describe.skip('Known allergies', function () {
    var PROCESS_ID = "hpiFields.spec.ts-known-allergies-".concat(luxon_1.DateTime.now().toMillis());
    var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
    var page;
    var knownAllergyName = 'penicillin';
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
                    if (!(process.env.INTEGRATION_TEST === 'true')) return [3 /*break*/, 4];
                    return [4 /*yield*/, resourceHandler.setResourcesFast()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 7];
                case 4: return [4 /*yield*/, resourceHandler.setResources()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id)];
                case 6:
                    _c.sent();
                    _c.label = 7;
                case 7: return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, (0, telemed_test_helpers_1.assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo)(page, { forceWaitForAssignButton: true })];
                case 9:
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
    (0, test_1.test)('Should search known allergy, and select it', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, tests_utils_1.checkDropdownHasOptionAndSelectIt)(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, knownAllergyName)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check known allergies are saved in HPI tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, test_1.test.step('reload and wait until data is loaded', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page.reload()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn)).toBeVisible()];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible()];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('check known allergy saved', function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toHaveText(RegExp(knownAllergyName, 'i'))];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check known allergy appear in Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabKnownAllergiesContainer)).toHaveText(new RegExp(knownAllergyName, 'i'))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should delete known allergy', function () { return __awaiter(void 0, void 0, void 0, function () {
        var knownAllergyListItem;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible()];
                case 2:
                    _a.sent();
                    knownAllergyListItem = page
                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesListItem)
                        .filter({ hasText: new RegExp(knownAllergyName, 'i') })
                        .first();
                    return [4 /*yield*/, knownAllergyListItem.getByTestId(data_test_ids_1.dataTestIds.deleteOutlinedIcon).click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(knownAllergyListItem).not.toBeVisible()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should confirm known allergy deleted', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, test_1.test.step('Confirm deletion in hpi tab', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var column;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page.reload()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                                case 2:
                                    _a.sent();
                                    column = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn);
                                    return [4 /*yield*/, (0, test_1.expect)(column).toBeVisible()];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(column.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()).not.toBeVisible({
                                            timeout: 30000,
                                        })];
                                case 4:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(new RegExp(knownAllergyName, 'i'))).not.toBeVisible()];
                                case 5:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('Confirm deletion in Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.visitNoteCard)).toBeVisible()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabKnownAllergiesContainer)).toBeVisible({
                                                timeout: 30000,
                                            })];
                                    case 3:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByText(new RegExp(knownAllergyName, 'i'))).not.toBeVisible()];
                                    case 4:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
test_1.test.describe('Surgical history', function () {
    var PROCESS_ID = "hpiFields.spec.ts-surg-history-".concat(luxon_1.DateTime.now().toMillis());
    var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
    var page;
    var surgery = 'feeding';
    var providerNote = 'lorem ipsum';
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
    (0, test_1.test)('Should add provider notes', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page
                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote)
                        .locator('textarea')
                        .first()
                        .fill(providerNote)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should search surgery and select it', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, tests_utils_1.checkDropdownHasOptionAndSelectIt)(page, data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryInput, surgery)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check surgical history are saved in HPI tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, test_1.test.step('reload and wait until data is loaded', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page.reload()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryColumn)).toBeVisible()];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toBeVisible()];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('Should check surgical history saved', function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toHaveText(RegExp(surgery, 'i'))];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check provider note saved in HPI tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote).locator('textarea').first()).toHaveText(providerNote)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check surgical history appear in Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabSurgicalHistoryContainer)).toHaveText(new RegExp(surgery, 'i'))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check provider note saved in Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabSurgicalHistoryContainer)).toHaveText(new RegExp(providerNote, 'i'))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should delete provider note', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toBeVisible()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote).locator('textarea').first().fill('')];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should delete surgery record', function () { return __awaiter(void 0, void 0, void 0, function () {
        var knownAllergyListItem;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    knownAllergyListItem = page
                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryListItem)
                        .filter({ hasText: new RegExp(surgery, 'i') })
                        .first();
                    return [4 /*yield*/, knownAllergyListItem.getByTestId(data_test_ids_1.dataTestIds.deleteOutlinedIcon).click()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(knownAllergyListItem).not.toBeVisible()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check surgical history record deleted from HPI and Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, test_1.test.step('Confirm deletion in hpi tab', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var column;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page.reload()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                                case 2:
                                    _a.sent();
                                    column = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryColumn);
                                    return [4 /*yield*/, (0, test_1.expect)(column).toBeVisible()];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(column.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()).not.toBeVisible({
                                            timeout: 30000,
                                        })];
                                case 4:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(new RegExp(surgery, 'i'))).not.toBeVisible()];
                                case 5:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, test_1.test.step('Confirm deletion in Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.visitNoteCard)).toBeVisible()];
                                    case 2:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabSurgicalHistoryContainer)).toBeVisible({
                                                timeout: 30000,
                                            })];
                                    case 3:
                                        _a.sent();
                                        return [4 /*yield*/, (0, test_1.expect)(page.getByText(new RegExp(surgery, 'i'))).not.toBeVisible()];
                                    case 4:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check provider note deleted on Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabSurgicalHistoryContainer)).toBeVisible({
                        timeout: 30000,
                    })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(new RegExp(providerNote, 'i'))).not.toBeVisible()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
test_1.test.describe('Additional questions', function () {
    var PROCESS_ID = "hpiFields.spec.ts-additional-Qs-".concat(luxon_1.DateTime.now().toMillis());
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
    (0, test_1.test)('Should check the list of questions is the same for patient and provider', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _i, ADDITIONAL_QUESTIONS_1, question;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _i = 0, ADDITIONAL_QUESTIONS_1 = constants_1.ADDITIONAL_QUESTIONS;
                    _a.label = 1;
                case 1:
                    if (!(_i < ADDITIONAL_QUESTIONS_1.length)) return [3 /*break*/, 5];
                    question = ADDITIONAL_QUESTIONS_1[_i];
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))).toHaveText(new RegExp(question.label))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(question.field))).toHaveText(new RegExp(question.label))];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check provider has the same answers as Patient provided. Patient answered', function () { return __awaiter(void 0, void 0, void 0, function () {
        var answers, _loop_1, _i, ADDITIONAL_QUESTIONS_2, question;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    answers = (0, utils_1.getAdditionalQuestionsAnswers)().item;
                    _loop_1 = function (question) {
                        var answer;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    answer = (_d = (_c = (_b = (_a = answers === null || answers === void 0 ? void 0 : answers.find(function (item) { return item.linkId === question.field; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString) !== null && _d !== void 0 ? _d : '';
                                    return [4 /*yield*/, (0, test_1.expect)(page
                                            .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(question.field))
                                            .getByText(answer)).toBeVisible()];
                                case 1:
                                    _f.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, ADDITIONAL_QUESTIONS_2 = constants_1.ADDITIONAL_QUESTIONS;
                    _e.label = 1;
                case 1:
                    if (!(_i < ADDITIONAL_QUESTIONS_2.length)) return [3 /*break*/, 4];
                    question = ADDITIONAL_QUESTIONS_2[_i];
                    return [5 /*yield**/, _loop_1(question)];
                case 2:
                    _e.sent();
                    _e.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    }); });
});
test_1.test.describe("Additional questions. Check cases where patient didn't answered on additional questions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var PROCESS_ID, resourceHandlerWithoutAdditionalAnswers, page;
    return __generator(this, function (_a) {
        PROCESS_ID = "hpiFields.spec.ts-no-additional-Qs-".concat(luxon_1.DateTime.now().toMillis());
        resourceHandlerWithoutAdditionalAnswers = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
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
                        (0, utils_1.getMedicationsStepAnswers)(),
                        (0, utils_1.getAllergiesStepAnswers)(),
                        (0, utils_1.getMedicalConditionsStepAnswers)(),
                        (0, utils_1.getSurgicalHistoryStepAnswers)(),
                        (0, utils_1.getPaymentOptionSelfPayAnswers)(),
                        (0, utils_1.getResponsiblePartyStepAnswers)({}),
                        (0, utils_1.getSchoolWorkNoteStepAnswers)(),
                        (0, utils_1.getConsentStepAnswers)({}),
                        (0, utils_1.getInviteParticipantStepAnswers)(),
                    ]];
            });
        }); });
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
                        return [4 /*yield*/, resourceHandlerWithoutAdditionalAnswers.setResources()];
                    case 3:
                        _c.sent();
                        return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandlerWithoutAdditionalAnswers.appointment.id))];
                    case 4:
                        _c.sent();
                        return [4 /*yield*/, (0, telemed_test_helpers_1.assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo)(page, { forceWaitForAssignButton: true })];
                    case 5:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test_1.test.afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, resourceHandlerWithoutAdditionalAnswers.cleanupResources()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        test_1.test.describe.configure({ mode: 'serial' });
        (0, test_1.test)("Should check provider doesn't have selected by default option. Patient didn't answer", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _i, ADDITIONAL_QUESTIONS_3, question, patientAnswer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _i = 0, ADDITIONAL_QUESTIONS_3 = constants_1.ADDITIONAL_QUESTIONS;
                        _a.label = 1;
                    case 1:
                        if (!(_i < ADDITIONAL_QUESTIONS_3.length)) return [3 /*break*/, 5];
                        question = ADDITIONAL_QUESTIONS_3[_i];
                        patientAnswer = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(question.field));
                        return [4 /*yield*/, (0, test_1.expect)(patientAnswer).toBeVisible()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(patientAnswer).toHaveText(question.label)];
                    case 3:
                        _a.sent(); // here we're checking strictly for question text without answer
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Update answers', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _i, ADDITIONAL_QUESTIONS_4, question, questionRadioLocator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _i = 0, ADDITIONAL_QUESTIONS_4 = constants_1.ADDITIONAL_QUESTIONS;
                        _a.label = 1;
                    case 1:
                        if (!(_i < ADDITIONAL_QUESTIONS_4.length)) return [3 /*break*/, 5];
                        question = ADDITIONAL_QUESTIONS_4[_i];
                        questionRadioLocator = page
                            .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))
                            .locator('input[value=true]');
                        return [4 /*yield*/, questionRadioLocator.click()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(questionRadioLocator).toBeEnabled()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Updated answers appears correctly on Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _i, ADDITIONAL_QUESTIONS_5, question;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn)).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, page.reload()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.visitNoteCard)).toBeVisible()];
                    case 4:
                        _a.sent();
                        _i = 0, ADDITIONAL_QUESTIONS_5 = constants_1.ADDITIONAL_QUESTIONS;
                        _a.label = 5;
                    case 5:
                        if (!(_i < ADDITIONAL_QUESTIONS_5.length)) return [3 /*break*/, 8];
                        question = ADDITIONAL_QUESTIONS_5[_i];
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabAdditionalQuestion(question.field))).toHaveText(new RegExp('Yes'))];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 5];
                    case 8: return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
test_1.test.describe('Chief complaint', function () {
    var PROCESS_ID = "hpiFields.spec.ts-chief-complaint-".concat(luxon_1.DateTime.now().toMillis());
    var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
    var page;
    var providerNote = 'Lorem ipsum';
    var ROS = 'ROS Lorem ipsum';
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
                    return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, (0, telemed_test_helpers_1.assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo)(page, { forceWaitForAssignButton: true })];
                case 5:
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
    (0, test_1.test)('Should add HPI provider notes and ROS', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page
                        .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes)
                        .locator('textarea')
                        .first()
                        .fill(providerNote)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).locator('textarea').first().fill(ROS)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check HPI provider notes and ROS are saved on Review&Sign page', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.reload()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.visitNoteCard)).toBeVisible()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabChiefComplaintContainer)).toHaveText(new RegExp(providerNote))];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabRosContainer)).toHaveText(new RegExp(ROS))];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should remove HPI provider notes and ROS', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto("telemed/appointments/".concat(resourceHandler.appointment.id))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes)).toBeVisible()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes).locator('textarea').first().fill('')];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).click()];
                case 4:
                    _a.sent(); // Click empty space to blur the focused input
                    return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).locator('textarea').first().fill('')];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes).click()];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Should check HPI provider notes and ROS are removed from "Review and sign\' tab', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.reload()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.visitNoteCard)).toBeVisible()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabChiefComplaintContainer)).not.toBeVisible()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabRosContainer)).not.toBeVisible()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=hpiFields.spec.js.map