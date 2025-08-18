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
var system_1 = require("@mui/system");
var test_1 = require("@playwright/test");
var luxon_1 = require("luxon");
var test_utils_1 = require("test-utils");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../src/constants/data-test-ids");
var telemed_test_helpers_1 = require("../../../e2e-utils/helpers/telemed.test-helpers");
var tests_utils_1 = require("../../../e2e-utils/helpers/tests-utils");
var resource_handler_1 = require("../../../e2e-utils/resource-handler");
function checkCheckboxValueInLocator(locator, value) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!value) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, test_1.expect)(locator.locator('input').first()).toBeChecked()];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, (0, test_1.expect)(locator.locator('input').first()).not.toBeChecked()];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
function checkRadioButtonValueInLocator(locator, value) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!value) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, test_1.expect)(locator.locator('input[type="radio"][value="true"]')).toBeChecked()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(locator.locator('input[type="radio"][value="false"]')).not.toBeChecked()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 3: return [4 /*yield*/, (0, test_1.expect)(locator.locator('input[type="radio"][value="true"]')).not.toBeChecked()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(locator.locator('input[type="radio"][value="false"]')).toBeChecked()];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6: return [2 /*return*/];
            }
        });
    });
}
function checkValuesInCheckboxes(page, examObservationFields) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, examObservationFields_1, field, fieldLocator;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _i = 0, examObservationFields_1 = examObservationFields;
                    _a.label = 1;
                case 1:
                    if (!(_i < examObservationFields_1.length)) return [3 /*break*/, 4];
                    field = examObservationFields_1[_i];
                    fieldLocator = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabField(field.field));
                    return [4 /*yield*/, checkCheckboxValueInLocator(fieldLocator, field.defaultValue)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function checkValuesInRadioButtons(page, examObservationFields) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, examObservationFields_2, field, fieldLocator;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _i = 0, examObservationFields_2 = examObservationFields;
                    _a.label = 1;
                case 1:
                    if (!(_i < examObservationFields_2.length)) return [3 /*break*/, 4];
                    field = examObservationFields_2[_i];
                    fieldLocator = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabField(field.field));
                    return [4 /*yield*/, checkRadioButtonValueInLocator(fieldLocator, field.defaultValue)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
test_1.test.describe('Fields tests', function () { return __awaiter(void 0, void 0, void 0, function () {
    var PROCESS_ID, resourceHandler, page, greenColorFromPalette, redColorFromPalette, boldFontSize, defaultUncheckedNormalField, defaultUncheckedAbnormalField, providerComment, distressDropdownOption, tenderDropdownOption, rashWithoutDescriptionDropdownOption, rashWithDescriptionDropdownOption, rashDescription;
    return __generator(this, function (_a) {
        PROCESS_ID = "examTab.spec.ts-fields-tests-".concat(luxon_1.DateTime.now().toMillis());
        resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
        greenColorFromPalette = '#2E7D32';
        redColorFromPalette = '#D32F2F';
        boldFontSize = 600;
        defaultUncheckedNormalField = utils_1.ExamObservationFieldsDetails['playful-and-active'];
        defaultUncheckedAbnormalField = utils_1.ExamObservationFieldsDetails['tired-appearing'];
        providerComment = 'Lorem ipsum';
        distressDropdownOption = utils_1.ExamObservationFieldsDetails['moderate-distress'].label;
        tenderDropdownOption = utils_1.ExamObservationFieldsDetails['left-lower-quadrant-abdomen'].label;
        rashWithoutDescriptionDropdownOption = utils_1.ExamObservationFieldsDetails['consistent-with-insect-bites'].label;
        rashWithDescriptionDropdownOption = utils_1.ExamObservationFieldsDetails['consistent-with-impetigo'].label;
        rashDescription = 'rash description';
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
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)).toBeVisible()];
                    case 7:
                        _c.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()).not.toBeVisible()];
                    case 8:
                        _c.sent();
                        return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.exam)).click()];
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
        (0, test_1.test)('Should check default selected checkboxes', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, test_1.test.step("Check 'General' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                            var filteredFields;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'general' && ['normal', 'abnormal'].includes(field.group); });
                                        return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Head' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'head'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields)];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Eyes' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'eyes'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields.filter(function (field) { return ['normal', 'abnormal'].includes(field.group); }))];
                                        case 1:
                                            _a.sent();
                                            return [4 /*yield*/, checkValuesInRadioButtons(page, filteredFields.filter(function (field) { return ['rightEye', 'leftEye'].includes(field.group); }))];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Nose' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('nose')).click()];
                                        case 1:
                                            _a.sent();
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'nose'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields.filter(function (field) { return ['normal', 'abnormal'].includes(field.group); }))];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Ears' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('ears')).click()];
                                        case 1:
                                            _a.sent();
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'ears'; });
                                            return [4 /*yield*/, checkValuesInRadioButtons(page, filteredFields.filter(function (field) { return ['rightEar', 'leftEar'].includes(field.group); }))];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Mouth' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('mouth')).click()];
                                        case 1:
                                            _a.sent();
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'mouth'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields.filter(function (field) { return ['normal', 'abnormal'].includes(field.group); }))];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Neck' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('neck')).click()];
                                        case 1:
                                            _a.sent();
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'neck'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields)];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Chest' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'chest'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields.filter(function (field) { return ['normal', 'abnormal'].includes(field.group); }))];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Back' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('back')).click()];
                                        case 1:
                                            _a.sent();
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'back'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields.filter(function (field) { return ['normal', 'abnormal'].includes(field.group); }))];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Skin' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'skin'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields.filter(function (field) { return ['normal'].includes(field.group); }))];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Abdomen' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('abdomen')).click()];
                                        case 1:
                                            _a.sent();
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'abdomen'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields.filter(function (field) { return ['normal', 'abnormal'].includes(field.group); }))];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 11:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Musculoskeletal' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'musculoskeletal'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields.filter(function (field) { return ['normal', 'abnormal'].includes(field.group); }))];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 12:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Neurological' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'neurological'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields.filter(function (field) { return ['normal'].includes(field.group); }))];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 13:
                        _a.sent();
                        return [4 /*yield*/, test_1.test.step("Check 'Psych' card", function () { return __awaiter(void 0, void 0, void 0, function () {
                                var filteredFields;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('psych')).click()];
                                        case 1:
                                            _a.sent();
                                            filteredFields = utils_1.examObservationFieldsDetailsArray.filter(function (field) { return field.card === 'psych'; });
                                            return [4 /*yield*/, checkValuesInCheckboxes(page, filteredFields.filter(function (field) { return ['normal', 'abnormal'].includes(field.group); }))];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 14:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)("Should select value from 'Normal' list and verify checkbox become green", function () { return __awaiter(void 0, void 0, void 0, function () {
            var normalListField, checkbox, color;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        normalListField = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabField(defaultUncheckedNormalField.field));
                        checkbox = normalListField.locator('input');
                        return [4 /*yield*/, checkbox.click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(checkbox).toBeEnabled()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, checkCheckboxValueInLocator(normalListField, true)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, normalListField
                                .locator('span')
                                .first()
                                .evaluate(function (el) {
                                return window.getComputedStyle(el).getPropertyValue('color');
                            })];
                    case 4:
                        color = _a.sent();
                        (0, test_1.expect)((0, system_1.rgbToHex)(color)).toBe(greenColorFromPalette.toLowerCase());
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)("Should select value from 'Abnormal' list and verify checkbox become red and text is bold", function () { return __awaiter(void 0, void 0, void 0, function () {
            var abnormalListField, checkbox, color;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        abnormalListField = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabField(defaultUncheckedAbnormalField.field));
                        checkbox = abnormalListField.locator('input');
                        return [4 /*yield*/, checkbox.click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(checkbox).toBeEnabled()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, checkCheckboxValueInLocator(abnormalListField, true)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, abnormalListField
                                .locator('span')
                                .first()
                                .evaluate(function (el) {
                                return window.getComputedStyle(el).getPropertyValue('color');
                            })];
                    case 4:
                        color = _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(abnormalListField.locator('p')).toHaveCSS('font-weight', "".concat(boldFontSize))];
                    case 5:
                        _a.sent();
                        (0, test_1.expect)((0, system_1.rgbToHex)(color)).toBe(redColorFromPalette.toLowerCase());
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)("Should enter some text in 'Provider' field", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page
                            .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('general'))
                            .locator('input')
                            .fill(providerComment)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)("Should check 'Distress' checkbox and select dropdown option", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabDistressCheckbox).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabDistressDropdown).click()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, tests_utils_1.getDropdownOption)(page, distressDropdownOption)];
                    case 3: return [4 /*yield*/, (_a.sent()).click()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)("Should check 'Tender' checkbox and select dropdown option", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('abdomen')).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabTenderCheckbox).click()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabTenderDropdown).click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, tests_utils_1.getDropdownOption)(page, tenderDropdownOption)];
                    case 4: return [4 /*yield*/, (_a.sent()).click()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)("Should check 'Rashes' checkbox and rashes form appeared", function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesCheckbox).locator('input').click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesDropdown)).toBeVisible()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesDescription)).toBeVisible()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesAddButton)).toBeVisible()];
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Should add skin rash without description', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesDropdown).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, tests_utils_1.getDropdownOption)(page, rashWithoutDescriptionDropdownOption)];
                    case 2: return [4 /*yield*/, (_a.sent()).click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesAddButton).click()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                    case 5:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Should check rash saved in abnormal subsection without description', function () { return __awaiter(void 0, void 0, void 0, function () {
            var rashesSubsection;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        rashesSubsection = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesAbnormalSubsection);
                        return [4 /*yield*/, (0, test_1.expect)(rashesSubsection).toHaveText(rashWithoutDescriptionDropdownOption)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(rashesSubsection).not.toHaveText('|')];
                    case 2:
                        _a.sent(); // it means we don't have description saved
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Should add skin rash with description', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesDropdown).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, tests_utils_1.getDropdownOption)(page, rashWithDescriptionDropdownOption)];
                    case 2: return [4 /*yield*/, (_a.sent()).click()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, page
                                .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesDescription)
                                .locator('textarea')
                                .first()
                                .fill(rashDescription)];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesAddButton).click()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Should check rash with description is saved', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesAbnormalSubsection)).toHaveText(new RegExp("".concat(rashWithDescriptionDropdownOption, "|").concat(rashDescription)))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Should check all fields are saved on Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
            var examinationsContainer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.visitNoteCard)).toBeVisible()];
                    case 2:
                        _a.sent();
                        examinationsContainer = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer);
                        return [4 /*yield*/, (0, test_1.expect)(examinationsContainer).toHaveText(new RegExp(defaultUncheckedNormalField.label))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(examinationsContainer).toHaveText(new RegExp(defaultUncheckedAbnormalField.label))];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(examinationsContainer).toHaveText(new RegExp(providerComment))];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(examinationsContainer).toHaveText(new RegExp(distressDropdownOption))];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(examinationsContainer).toHaveText(new RegExp(tenderDropdownOption))];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(examinationsContainer).toHaveText(new RegExp(rashWithoutDescriptionDropdownOption))];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(examinationsContainer).toHaveText(new RegExp("".concat(rashWithDescriptionDropdownOption, "|").concat(rashDescription)))];
                    case 9:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Should remove rashes and check it removed from abnormal subsection', function () { return __awaiter(void 0, void 0, void 0, function () {
            var rashElementDeleteButton;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.exam)).click()];
                    case 1:
                        _a.sent();
                        rashElementDeleteButton = page
                            .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesAbnormalSubsection)
                            .getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashElementInSubsection)
                            .filter({ hasText: rashWithDescriptionDropdownOption })
                            .locator('button');
                        return [4 /*yield*/, rashElementDeleteButton.click()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, test_utils_1.waitForSaveChartDataResponse)(page)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesAbnormalSubsection)).not.toHaveText(rashWithDescriptionDropdownOption)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, test_1.test)('Should check rash was removed from Review&Sign tab', function () { return __awaiter(void 0, void 0, void 0, function () {
            var examinationsContainer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.progressNotePage.visitNoteCard)).toBeVisible()];
                    case 2:
                        _a.sent();
                        examinationsContainer = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer);
                        return [4 /*yield*/, (0, test_1.expect)(examinationsContainer).not.toHaveText(rashWithDescriptionDropdownOption)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(examinationsContainer).not.toHaveText(rashDescription)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
test_1.test.describe('Cards tests', function () {
    var PROCESS_ID = "examTab.spec.ts-cards-tests-".concat(luxon_1.DateTime.now().toMillis());
    var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID, 'telemed');
    var collapsedSections = ['nose', 'ears', 'mouth', 'neck', 'abdomen', 'back', 'psych'];
    var expandedSections = [
        'general',
        'head',
        'eyes',
        'chest',
        'skin',
        'musculoskeletal',
        'neurological',
    ];
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
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)).toBeVisible()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()).not.toBeVisible()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.exam)).click()];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check that sections are collapsed by default', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var _i, collapsedSections_1, section, cardLocator;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _i = 0, collapsedSections_1 = collapsedSections;
                    _c.label = 1;
                case 1:
                    if (!(_i < collapsedSections_1.length)) return [3 /*break*/, 5];
                    section = collapsedSections_1[_i];
                    cardLocator = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards(section));
                    return [4 /*yield*/, (0, test_1.expect)(cardLocator).toBeVisible()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, test_1.expect)(cardLocator.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments(section))).not.toBeVisible()];
                case 3:
                    _c.sent();
                    _c.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check that sections are expanded by default', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var _i, expandedSections_1, section, cardLocator;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _i = 0, expandedSections_1 = expandedSections;
                    _c.label = 1;
                case 1:
                    if (!(_i < expandedSections_1.length)) return [3 /*break*/, 5];
                    section = expandedSections_1[_i];
                    cardLocator = page.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards(section));
                    return [4 /*yield*/, (0, test_1.expect)(cardLocator).toBeVisible()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, test_1.expect)(cardLocator.getByTestId(data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments(section))).toBeVisible()];
                case 3:
                    _c.sent();
                    _c.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=examTab.spec.js.map