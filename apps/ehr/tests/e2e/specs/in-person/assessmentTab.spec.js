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
var resource_handler_1 = require("../../../e2e-utils/resource-handler");
var CssHeader_1 = require("../../page/CssHeader");
var InPersonAssessmentPage_1 = require("../../page/in-person/InPersonAssessmentPage");
var InPersonProgressNotePage_1 = require("../../page/in-person/InPersonProgressNotePage");
var SideMenu_1 = require("../../page/SideMenu");
var PROCESS_ID = "assessmentTab.spec.ts-".concat(luxon_1.DateTime.now().toMillis());
var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'in-person');
var assessmentPage;
var progressNotePage;
var sideMenu;
var cssHeader;
var context;
var page;
var DEFAULT_TIMEOUT = { timeout: 15000 };
var DIAGNOSIS_CODE = 'J45.901';
var DIAGNOSIS_NAME = 'injury';
var E_M_CODE = '99201';
var CPT_CODE = '24640';
var CPT_CODE_2 = '72146';
test_1.test.describe.configure({ mode: 'serial' });
test_1.test.beforeAll(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var browser = _b.browser;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!(process.env.INTEGRATION_TEST === 'true')) return [3 /*break*/, 2];
                return [4 /*yield*/, resourceHandler.setResourcesFast()];
            case 1:
                _c.sent();
                return [3 /*break*/, 5];
            case 2: return [4 /*yield*/, resourceHandler.setResources()];
            case 3:
                _c.sent();
                return [4 /*yield*/, resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id)];
            case 4:
                _c.sent();
                _c.label = 5;
            case 5: return [4 /*yield*/, browser.newContext()];
            case 6:
                context = _c.sent();
                return [4 /*yield*/, context.newPage()];
            case 7:
                page = _c.sent();
                assessmentPage = new InPersonAssessmentPage_1.InPersonAssessmentPage(page);
                progressNotePage = new InPersonProgressNotePage_1.InPersonProgressNotePage(page);
                sideMenu = new SideMenu_1.SideMenu(page);
                cssHeader = new CssHeader_1.CssHeader(page);
                return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/progress-note"))];
            case 8:
                _c.sent();
                return [4 /*yield*/, cssHeader.verifyStatus('pending')];
            case 9:
                _c.sent();
                return [4 /*yield*/, cssHeader.selectIntakePractitioner()];
            case 10:
                _c.sent();
                return [4 /*yield*/, cssHeader.selectProviderPractitioner()];
            case 11:
                _c.sent();
                return [4 /*yield*/, cssHeader.clickSwitchModeButton('provider')];
            case 12:
                _c.sent();
                return [4 /*yield*/, progressNotePage.expectLoaded()];
            case 13:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
test_1.test.afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, page.close()];
            case 1:
                _a.sent();
                return [4 /*yield*/, context.close()];
            case 2:
                _a.sent();
                return [4 /*yield*/, resourceHandler.cleanupResources()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Check assessment page initial state and default MDM saving', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/assessment"))];
            case 1:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectDiagnosisDropdown()];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.primaryDiagnosis)).not.toBeVisible()];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.secondaryDiagnosis)).not.toBeVisible()];
            case 4:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectMdmField({ text: utils_1.MDM_FIELD_DEFAULT_TEXT })];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Remove MDM and check missing required fields on review and sign page', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/assessment"))];
            case 1:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectMdmField({ text: utils_1.MDM_FIELD_DEFAULT_TEXT })];
            case 2:
                _a.sent();
                return [4 /*yield*/, assessmentPage.fillMdmField('')];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
            case 4:
                _a.sent();
                return [4 /*yield*/, sideMenu.clickProgressNote()];
            case 5:
                _a.sent();
                return [4 /*yield*/, progressNotePage.expectLoaded()];
            case 6:
                _a.sent();
                return [4 /*yield*/, progressNotePage.verifyReviewAndSignButtonDisabled()];
            case 7:
                _a.sent();
                return [4 /*yield*/, test_1.test.step('Verify missing card is visible and has all required missing fields', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.missingCard)).toBeVisible()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.emCodeLink)).toBeVisible()];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.medicalDecisionLink)).toBeVisible()];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.primaryDiagnosisLink)).toBeVisible()];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 8:
                _a.sent();
                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.primaryDiagnosisLink).click()];
            case 9:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectDiagnosisDropdown()];
            case 10:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectEmCodeDropdown()];
            case 11:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectMdmField()];
            case 12:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Search and select diagnoses', function () { return __awaiter(void 0, void 0, void 0, function () {
    var primaryDiagnosisValue, primaryDiagnosis, secondaryDiagnosis, secondaryDiagnosisValue;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/assessment"))];
            case 1:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectDiagnosisDropdown()];
            case 2:
                _a.sent();
                // Test ICD 10 code search
                return [4 /*yield*/, test_1.test.step('Search for ICD 10 code', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, assessmentPage.selectDiagnosis({ diagnosisCode: DIAGNOSIS_CODE })];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page, function (json) { var _a; return !!((_a = json.chartData.diagnosis) === null || _a === void 0 ? void 0 : _a.some(function (x) { return x.code.toLocaleLowerCase().includes(DIAGNOSIS_CODE.toLocaleLowerCase()); })); })];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 3:
                // Test ICD 10 code search
                _a.sent();
                primaryDiagnosisValue = null;
                primaryDiagnosis = null;
                return [4 /*yield*/, test_1.test.step('Verify primary diagnosis is visible', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    primaryDiagnosis = page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.primaryDiagnosis);
                                    return [4 /*yield*/, (0, test_1.expect)(primaryDiagnosis).toBeVisible()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, primaryDiagnosis.textContent()];
                                case 2:
                                    primaryDiagnosisValue = _a.sent();
                                    (0, test_1.expect)(primaryDiagnosisValue).toContain(DIAGNOSIS_CODE);
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 4:
                _a.sent();
                // Test diagnosis name search
                return [4 /*yield*/, test_1.test.step('Search for diagnosis name', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, assessmentPage.selectDiagnosis({ diagnosisNamePart: DIAGNOSIS_NAME })];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page, function (json) {
                                            var _a;
                                            return !!((_a = json.chartData.diagnosis) === null || _a === void 0 ? void 0 : _a.some(function (x) {
                                                return x.display.toLocaleLowerCase().includes(DIAGNOSIS_NAME.toLocaleLowerCase());
                                            }));
                                        })];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 5:
                // Test diagnosis name search
                _a.sent();
                secondaryDiagnosis = null;
                secondaryDiagnosisValue = null;
                return [4 /*yield*/, test_1.test.step('Verify secondary diagnosis is visible', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    secondaryDiagnosis = page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.secondaryDiagnosis);
                                    return [4 /*yield*/, (0, test_1.expect)(secondaryDiagnosis).toBeVisible()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, secondaryDiagnosis.textContent()];
                                case 2:
                                    secondaryDiagnosisValue = _a.sent();
                                    (0, test_1.expect)(secondaryDiagnosisValue === null || secondaryDiagnosisValue === void 0 ? void 0 : secondaryDiagnosisValue.toLocaleLowerCase()).toContain(DIAGNOSIS_NAME.toLocaleLowerCase());
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 6:
                _a.sent();
                // Verify diagnoses on Review and Sign page
                return [4 /*yield*/, test_1.test.step('Verify diagnoses on Review and Sign page', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, sideMenu.clickProgressNote()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, progressNotePage.expectLoaded()];
                                case 2:
                                    _a.sent();
                                    // Verify both diagnoses are present
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(primaryDiagnosisValue, { exact: false })).toBeVisible()];
                                case 3:
                                    // Verify both diagnoses are present
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(secondaryDiagnosisValue, { exact: false })).toBeVisible()];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 7:
                // Verify diagnoses on Review and Sign page
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Change primary diagnosis', function () { return __awaiter(void 0, void 0, void 0, function () {
    var initialPrimaryDiagnosis, initialSecondaryDiagnosis, initialPrimaryValue, initialSecondaryValue;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, sideMenu.clickAssessment()];
            case 1:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectDiagnosisDropdown()];
            case 2:
                _a.sent();
                initialPrimaryDiagnosis = page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.primaryDiagnosis);
                initialSecondaryDiagnosis = page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.secondaryDiagnosis);
                return [4 /*yield*/, initialPrimaryDiagnosis.textContent()];
            case 3:
                initialPrimaryValue = _a.sent();
                return [4 /*yield*/, initialSecondaryDiagnosis.textContent()];
            case 4:
                initialSecondaryValue = _a.sent();
                // Make secondary diagnosis primary
                return [4 /*yield*/, test_1.test.step('Make secondary diagnosis primary', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var newPrimaryDiagnosis, newSecondaryDiagnosis;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.makePrimaryButton).click()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                                case 2:
                                    _a.sent();
                                    newPrimaryDiagnosis = page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.primaryDiagnosis);
                                    newSecondaryDiagnosis = page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.secondaryDiagnosis);
                                    return [4 /*yield*/, (0, test_1.expect)(newPrimaryDiagnosis).toHaveText(initialSecondaryValue, { ignoreCase: true })];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(newSecondaryDiagnosis).toHaveText(initialPrimaryValue, { ignoreCase: true })];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 5:
                // Make secondary diagnosis primary
                _a.sent();
                // Verify on Review and Sign page
                return [4 /*yield*/, test_1.test.step('Verify swapped diagnoses on Review and Sign page', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, sideMenu.clickProgressNote()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, progressNotePage.expectLoaded()];
                                case 2:
                                    _a.sent();
                                    // Verify both diagnoses are present
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(initialSecondaryValue, { exact: false })).toBeVisible()];
                                case 3:
                                    // Verify both diagnoses are present
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(initialPrimaryValue, { exact: false })).toBeVisible()];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 6:
                // Verify on Review and Sign page
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Delete primary diagnosis', function () { return __awaiter(void 0, void 0, void 0, function () {
    var primaryDiagnosis, primaryDiagnosisValue, secondaryDiagnosis, secondaryDiagnosisValue;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, sideMenu.clickAssessment()];
            case 1:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectDiagnosisDropdown()];
            case 2:
                _a.sent();
                primaryDiagnosis = page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.primaryDiagnosis);
                return [4 /*yield*/, primaryDiagnosis.textContent()];
            case 3:
                primaryDiagnosisValue = _a.sent();
                secondaryDiagnosis = page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.secondaryDiagnosis);
                return [4 /*yield*/, secondaryDiagnosis.textContent()];
            case 4:
                secondaryDiagnosisValue = _a.sent();
                // Delete primary diagnosis
                return [4 /*yield*/, test_1.test.step('Delete primary diagnosis', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var newPrimaryDiagnosis, newPrimaryValue;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.primaryDiagnosisDeleteButton).first().click()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                                case 3:
                                    _a.sent();
                                    // Verify secondary diagnosis is promoted to primary
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.primaryDiagnosis)).toBeVisible()];
                                case 4:
                                    // Verify secondary diagnosis is promoted to primary
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.secondaryDiagnosis)).not.toBeVisible()];
                                case 5:
                                    _a.sent();
                                    newPrimaryDiagnosis = page.getByTestId(data_test_ids_1.dataTestIds.diagnosisContainer.primaryDiagnosis);
                                    return [4 /*yield*/, newPrimaryDiagnosis.textContent()];
                                case 6:
                                    newPrimaryValue = _a.sent();
                                    (0, test_1.expect)(newPrimaryValue === null || newPrimaryValue === void 0 ? void 0 : newPrimaryValue.toLocaleLowerCase()).toEqual(secondaryDiagnosisValue === null || secondaryDiagnosisValue === void 0 ? void 0 : secondaryDiagnosisValue.toLocaleLowerCase());
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 5:
                // Delete primary diagnosis
                _a.sent();
                // Verify on Review and Sign page
                return [4 /*yield*/, test_1.test.step('Verify promoted diagnosis on Review and Sign page, deleted diagnosis is not present', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, sideMenu.clickProgressNote()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, progressNotePage.expectLoaded()];
                                case 2:
                                    _a.sent();
                                    // Verify only one diagnosis is present
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(secondaryDiagnosisValue, { exact: false })).toBeVisible()];
                                case 3:
                                    // Verify only one diagnosis is present
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(primaryDiagnosisValue, { exact: false })).not.toBeVisible(DEFAULT_TIMEOUT)];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 6:
                // Verify on Review and Sign page
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Medical Decision Making functionality', function () { return __awaiter(void 0, void 0, void 0, function () {
    var newText;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, sideMenu.clickAssessment()];
            case 1:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectDiagnosisDropdown()];
            case 2:
                _a.sent();
                // Check default text
                return [4 /*yield*/, assessmentPage.expectMdmField({ text: '' })];
            case 3:
                // Check default text
                _a.sent();
                newText = 'Updated medical decision making text';
                return [4 /*yield*/, assessmentPage.fillMdmField(newText)];
            case 4:
                _a.sent();
                // Verify text is updated
                return [4 /*yield*/, assessmentPage.expectMdmField({ text: newText })];
            case 5:
                // Verify text is updated
                _a.sent();
                // Navigate to Review and Sign to verify text is displayed
                return [4 /*yield*/, sideMenu.clickProgressNote()];
            case 6:
                // Navigate to Review and Sign to verify text is displayed
                _a.sent();
                return [4 /*yield*/, progressNotePage.expectLoaded()];
            case 7:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByText(newText)).toBeVisible()];
            case 8:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Add E&M code', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, sideMenu.clickAssessment()];
            case 1:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectDiagnosisDropdown()];
            case 2:
                _a.sent();
                // Select E&M code
                return [4 /*yield*/, test_1.test.step('Select E&M code', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, assessmentPage.selectEmCode(E_M_CODE)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 3:
                // Select E&M code
                _a.sent();
                return [4 /*yield*/, test_1.test.step('Verify E&M code is added', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var value;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.assessmentCard.emCodeDropdown).locator('input').inputValue()];
                                case 1:
                                    value = _a.sent();
                                    // Navigate to Review and Sign to verify code is displayed
                                    return [4 /*yield*/, sideMenu.clickProgressNote()];
                                case 2:
                                    // Navigate to Review and Sign to verify code is displayed
                                    _a.sent();
                                    return [4 /*yield*/, progressNotePage.expectLoaded()];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(value)).toBeVisible()];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 4:
                _a.sent();
                return [4 /*yield*/, test_1.test.step('Verify missing card is not visible', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.missingCard)).not.toBeVisible()];
                                case 1:
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
(0, test_1.test)('Add CPT codes', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, sideMenu.clickAssessment()];
            case 1:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectDiagnosisDropdown()];
            case 2:
                _a.sent();
                // Select CPT code
                return [4 /*yield*/, test_1.test.step('Select CPT code', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, assessmentPage.selectCptCode(CPT_CODE)];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, assessmentPage.selectCptCode(CPT_CODE_2)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 3:
                // Select CPT code
                _a.sent();
                return [4 /*yield*/, test_1.test.step('Verify CPT codes are added to progress note', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var value, value2;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.billingContainer.cptCodeEntry(CPT_CODE)).textContent()];
                                case 1:
                                    value = _a.sent();
                                    (0, test_1.expect)(value).toContain(CPT_CODE);
                                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.billingContainer.cptCodeEntry(CPT_CODE_2)).textContent()];
                                case 2:
                                    value2 = _a.sent();
                                    (0, test_1.expect)(value2).toContain(CPT_CODE_2);
                                    // Navigate to Review and Sign to verify code is displayed
                                    return [4 /*yield*/, sideMenu.clickProgressNote()];
                                case 3:
                                    // Navigate to Review and Sign to verify code is displayed
                                    _a.sent();
                                    return [4 /*yield*/, progressNotePage.expectLoaded()];
                                case 4:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(value)).toBeVisible()];
                                case 5:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(page.getByText(value2)).toBeVisible()];
                                case 6:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Remove CPT codes', function () { return __awaiter(void 0, void 0, void 0, function () {
    var value, value2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, sideMenu.clickAssessment()];
            case 1:
                _a.sent();
                return [4 /*yield*/, assessmentPage.expectDiagnosisDropdown()];
            case 2:
                _a.sent();
                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.billingContainer.cptCodeEntry(CPT_CODE)).textContent()];
            case 3:
                value = _a.sent();
                (0, test_1.expect)(value).toContain(CPT_CODE);
                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.billingContainer.cptCodeEntry(CPT_CODE_2)).textContent()];
            case 4:
                value2 = _a.sent();
                (0, test_1.expect)(value2).toContain(CPT_CODE_2);
                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.billingContainer.deleteCptCodeButton(CPT_CODE)).click()];
            case 5:
                _a.sent();
                return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
            case 6:
                _a.sent();
                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.billingContainer.deleteCptCodeButton(CPT_CODE_2)).click()];
            case 7:
                _a.sent();
                return [4 /*yield*/, (0, test_utils_1.waitForChartDataDeletion)(page)];
            case 8:
                _a.sent();
                return [4 /*yield*/, sideMenu.clickProgressNote()];
            case 9:
                _a.sent();
                return [4 /*yield*/, progressNotePage.expectLoaded()];
            case 10:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByText(value)).not.toBeVisible()];
            case 11:
                _a.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByText(value2)).not.toBeVisible()];
            case 12:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
//# sourceMappingURL=assessmentTab.spec.js.map