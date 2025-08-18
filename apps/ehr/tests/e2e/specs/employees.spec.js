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
var tests_utils_1 = require("../../e2e-utils/helpers/tests-utils");
var employees_1 = require("../../e2e-utils/resource/employees");
var resource_handler_1 = require("../../e2e-utils/resource-handler");
// We may create new instances for the tests with mutable operations, and keep parallel tests isolated
var PROCESS_ID = "employees.spec.ts-".concat(luxon_1.DateTime.now().toMillis());
var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID);
var DEFAULT_TIMEOUT = { timeout: 15000 };
test_1.test.beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resourceHandler.setEmployees()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
test_1.test.afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, resourceHandler.deleteEmployees()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
function waitUntilEmployeeProviderTableLoaded(page) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.table)).toBeVisible(DEFAULT_TIMEOUT)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.dashboard.loadingIndicator)).not.toBeVisible(DEFAULT_TIMEOUT)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function goToTestEmployeePage(page, employee) {
    return __awaiter(this, void 0, void 0, function () {
        var targetLink;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.searchByName).getByRole('textbox').fill(employee.familyName)];
                case 1:
                    _a.sent();
                    targetLink = page.locator("text=".concat(employee.familyName));
                    return [4 /*yield*/, targetLink.click(DEFAULT_TIMEOUT)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.informationForm)).toBeVisible(DEFAULT_TIMEOUT)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function checkEmployeeFields(page, employee) {
    return __awaiter(this, void 0, void 0, function () {
        var firstNameField, middleNameField, lastNameField, emailField, phoneField, _i, AVAILABLE_EMPLOYEE_ROLES_1, emp_role, roleCheckbox, credentialsField, npiField, _a, _b, qualification, row;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    firstNameField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.firstName).locator('input');
                    middleNameField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.middleName).locator('input');
                    lastNameField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.lastName).locator('input');
                    emailField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.email).locator('input');
                    phoneField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.phone).locator('input');
                    return [4 /*yield*/, test_1.expect.soft(firstNameField).toHaveValue(employee.givenName)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, test_1.expect.soft(middleNameField).toHaveValue(employee.middleName)];
                case 2:
                    _c.sent();
                    if (!employee.familyName) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, test_1.expect)(lastNameField).toHaveValue(employee.familyName)];
                case 3:
                    _c.sent();
                    _c.label = 4;
                case 4: return [4 /*yield*/, test_1.expect.soft(emailField).toHaveValue(employee.email)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, test_1.expect.soft(phoneField).toHaveValue(employee.telecomPhone)];
                case 6:
                    _c.sent();
                    _i = 0, AVAILABLE_EMPLOYEE_ROLES_1 = utils_1.AVAILABLE_EMPLOYEE_ROLES;
                    _c.label = 7;
                case 7:
                    if (!(_i < AVAILABLE_EMPLOYEE_ROLES_1.length)) return [3 /*break*/, 12];
                    emp_role = AVAILABLE_EMPLOYEE_ROLES_1[_i];
                    roleCheckbox = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.roleRow(emp_role.value));
                    if (!employee.roles.includes(emp_role.value)) return [3 /*break*/, 9];
                    return [4 /*yield*/, test_1.expect.soft(roleCheckbox.getByRole('checkbox')).toBeChecked()];
                case 8:
                    _c.sent();
                    return [3 /*break*/, 11];
                case 9: return [4 /*yield*/, test_1.expect.soft(roleCheckbox.getByRole('checkbox')).not.toBeChecked()];
                case 10:
                    _c.sent();
                    _c.label = 11;
                case 11:
                    _i++;
                    return [3 /*break*/, 7];
                case 12:
                    if (!employee.roles.includes(utils_1.RoleType.Provider)) return [3 /*break*/, 15];
                    credentialsField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.providerDetailsCredentials).locator('input');
                    return [4 /*yield*/, test_1.expect.soft(credentialsField).toHaveValue(employee.credentials)];
                case 13:
                    _c.sent();
                    npiField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.providerDetailsNPI).locator('input');
                    return [4 /*yield*/, test_1.expect.soft(npiField).toHaveValue(employee.npi)];
                case 14:
                    _c.sent();
                    _c.label = 15;
                case 15:
                    if (!(employee.qualification.length > 0)) return [3 /*break*/, 19];
                    _a = 0, _b = employee.qualification;
                    _c.label = 16;
                case 16:
                    if (!(_a < _b.length)) return [3 /*break*/, 19];
                    qualification = _b[_a];
                    row = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.qualificationRow(qualification.code));
                    return [4 /*yield*/, test_1.expect.soft(row).toBeVisible(DEFAULT_TIMEOUT)];
                case 17:
                    _c.sent();
                    _c.label = 18;
                case 18:
                    _a++;
                    return [3 /*break*/, 16];
                case 19: return [2 /*return*/];
            }
        });
    });
}
function updateEmployeesFields(page, employee) {
    return __awaiter(this, void 0, void 0, function () {
        var firstNameField, middleNameField, lastNameField, phoneField, _i, AVAILABLE_EMPLOYEE_ROLES_2, emp_role, roleCheckbox, credentialsField, npiField, qualificationTable, deleteButton, buttonsCount, i, qualificationStateDropdown, qualificationTypeDropdown, qualificationNumberField, qualificationExpDatePicker, createQualificationButton, _a, _b, qualification;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    firstNameField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.firstName).locator('input');
                    middleNameField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.middleName).locator('input');
                    lastNameField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.lastName).locator('input');
                    phoneField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.phone).locator('input');
                    return [4 /*yield*/, firstNameField.fill(employee.givenName)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, middleNameField.fill(employee.middleName)];
                case 2:
                    _c.sent();
                    if (!employee.familyName) return [3 /*break*/, 4];
                    return [4 /*yield*/, lastNameField.fill(employee.familyName)];
                case 3:
                    _c.sent();
                    _c.label = 4;
                case 4: return [4 /*yield*/, phoneField.fill(employee.telecomPhone)];
                case 5:
                    _c.sent();
                    _i = 0, AVAILABLE_EMPLOYEE_ROLES_2 = utils_1.AVAILABLE_EMPLOYEE_ROLES;
                    _c.label = 6;
                case 6:
                    if (!(_i < AVAILABLE_EMPLOYEE_ROLES_2.length)) return [3 /*break*/, 11];
                    emp_role = AVAILABLE_EMPLOYEE_ROLES_2[_i];
                    roleCheckbox = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.roleRow(emp_role.value));
                    if (!employee.roles.includes(emp_role.value)) return [3 /*break*/, 8];
                    return [4 /*yield*/, roleCheckbox.getByRole('checkbox').check()];
                case 7:
                    _c.sent();
                    return [3 /*break*/, 10];
                case 8: return [4 /*yield*/, roleCheckbox.getByRole('checkbox').uncheck()];
                case 9:
                    _c.sent();
                    _c.label = 10;
                case 10:
                    _i++;
                    return [3 /*break*/, 6];
                case 11:
                    if (!employee.roles.includes(utils_1.RoleType.Provider)) return [3 /*break*/, 14];
                    credentialsField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.providerDetailsCredentials).locator('input');
                    return [4 /*yield*/, credentialsField.fill(employee.credentials)];
                case 12:
                    _c.sent();
                    npiField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.providerDetailsNPI).locator('input');
                    return [4 /*yield*/, npiField.fill(employee.npi)];
                case 13:
                    _c.sent();
                    _c.label = 14;
                case 14:
                    if (!(employee.qualification.length > 0)) return [3 /*break*/, 19];
                    qualificationTable = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.qualificationsTable);
                    deleteButton = qualificationTable.getByTestId(data_test_ids_1.dataTestIds.employeesPage.deleteQualificationButton);
                    return [4 /*yield*/, deleteButton.count()];
                case 15:
                    buttonsCount = _c.sent();
                    i = 0;
                    _c.label = 16;
                case 16:
                    if (!(i < buttonsCount)) return [3 /*break*/, 19];
                    // we press 0 index each time because as we delete each element it's disheartening from table
                    // so we just need to press 0 index all way until all elements will be deleted
                    return [4 /*yield*/, deleteButton.nth(0).click(DEFAULT_TIMEOUT)];
                case 17:
                    // we press 0 index each time because as we delete each element it's disheartening from table
                    // so we just need to press 0 index all way until all elements will be deleted
                    _c.sent();
                    _c.label = 18;
                case 18:
                    i++;
                    return [3 /*break*/, 16];
                case 19: 
                // ADDING ALL QUALIFICATIONS IN EMPLOYEE OBJ
                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.addQualificationCard).click(DEFAULT_TIMEOUT)];
                case 20:
                    // ADDING ALL QUALIFICATIONS IN EMPLOYEE OBJ
                    _c.sent();
                    qualificationStateDropdown = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.newQualificationStateDropdown);
                    qualificationTypeDropdown = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.newQualificationTypeDropdown);
                    qualificationNumberField = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.newQualificationNumberField);
                    qualificationExpDatePicker = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.newQualificationExpDatePicker);
                    createQualificationButton = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.addQualificationButton);
                    _a = 0, _b = employee.qualification;
                    _c.label = 21;
                case 21:
                    if (!(_a < _b.length)) return [3 /*break*/, 34];
                    qualification = _b[_a];
                    return [4 /*yield*/, qualificationStateDropdown.getByRole('button').click(DEFAULT_TIMEOUT)];
                case 22:
                    _c.sent();
                    return [4 /*yield*/, qualificationStateDropdown.locator('input').fill(qualification.state)];
                case 23:
                    _c.sent();
                    return [4 /*yield*/, page.keyboard.press('ArrowDown')];
                case 24:
                    _c.sent();
                    return [4 /*yield*/, page.keyboard.press('Enter')];
                case 25:
                    _c.sent();
                    return [4 /*yield*/, qualificationTypeDropdown.getByRole('button').click(DEFAULT_TIMEOUT)];
                case 26:
                    _c.sent();
                    return [4 /*yield*/, qualificationTypeDropdown.locator('input').fill(qualification.code)];
                case 27:
                    _c.sent();
                    return [4 /*yield*/, page.keyboard.press('ArrowDown')];
                case 28:
                    _c.sent();
                    return [4 /*yield*/, page.keyboard.press('Enter')];
                case 29:
                    _c.sent();
                    return [4 /*yield*/, qualificationNumberField.locator('input').fill(qualification.number || '')];
                case 30:
                    _c.sent();
                    return [4 /*yield*/, qualificationExpDatePicker.locator('input').fill(qualification.date || '')];
                case 31:
                    _c.sent();
                    return [4 /*yield*/, createQualificationButton.click(DEFAULT_TIMEOUT)];
                case 32:
                    _c.sent();
                    _c.label = 33;
                case 33:
                    _a++;
                    return [3 /*break*/, 21];
                case 34: return [2 /*return*/];
            }
        });
    });
}
(0, test_1.test)('Employee page is working', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("employees")];
            case 1:
                _c.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId('PersonIcon')).toBeVisible(DEFAULT_TIMEOUT)];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.header.userName)).toBeAttached(DEFAULT_TIMEOUT)];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.table)).toBeVisible(DEFAULT_TIMEOUT)];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Employees list is loading', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var statusChips;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("employees")];
            case 1:
                _c.sent();
                // WE GET ALL STATUS CHIPS FROM EMPLOYEES RECORDS, SO IF THERE ARE SOME WE HAVE EMPLOYEES
                return [4 /*yield*/, waitUntilEmployeeProviderTableLoaded(page)];
            case 2:
                // WE GET ALL STATUS CHIPS FROM EMPLOYEES RECORDS, SO IF THERE ARE SOME WE HAVE EMPLOYEES
                _c.sent();
                statusChips = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.statusChip);
                return [4 /*yield*/, (0, test_1.expect)(statusChips).not.toHaveCount(0)];
            case 3:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Providers tab filters are working', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var table;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("employees")];
            case 1:
                _c.sent();
                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.providersTabButton).click(DEFAULT_TIMEOUT)];
            case 2:
                _c.sent();
                return [4 /*yield*/, waitUntilEmployeeProviderTableLoaded(page)];
            case 3:
                _c.sent();
                table = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.table);
                return [4 /*yield*/, test_1.test.step('Check name search filed', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page
                                        .getByTestId(data_test_ids_1.dataTestIds.employeesPage.searchByName)
                                        .getByRole('textbox')
                                        .fill(resourceHandler.testEmployee1.familyName)];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(table.locator("text=".concat(resourceHandler.testEmployee1.familyName))).toBeVisible(DEFAULT_TIMEOUT)];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(table.locator("text=".concat(resourceHandler.testEmployee2.familyName))).not.toBeVisible(DEFAULT_TIMEOUT)];
                                case 3:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 4:
                _c.sent();
                return [4 /*yield*/, test_1.test.step('Check name search filed', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page
                                        .getByTestId(data_test_ids_1.dataTestIds.employeesPage.searchByName)
                                        .getByRole('textbox')
                                        .fill(employees_1.testEmployeeGivenNamePattern)];
                                case 1:
                                    _a.sent();
                                    // SELECT 'AK' STATE BY CLICKING TWO TIMES DOWN IN STATES DROPDOWN
                                    return [4 /*yield*/, page
                                            .getByTestId(data_test_ids_1.dataTestIds.employeesPage.providersStateFilter)
                                            .getByRole('button', { name: 'Open' })
                                            .click()];
                                case 2:
                                    // SELECT 'AK' STATE BY CLICKING TWO TIMES DOWN IN STATES DROPDOWN
                                    _a.sent();
                                    return [4 /*yield*/, page.keyboard.press('ArrowDown')];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, page.keyboard.press('ArrowDown')];
                                case 4:
                                    _a.sent();
                                    return [4 /*yield*/, page.keyboard.press('Enter')];
                                case 5:
                                    _a.sent();
                                    // CHECKING IF WE ARE RECEIVING OUR TEST EMPLOYEES
                                    return [4 /*yield*/, waitUntilEmployeeProviderTableLoaded(page)];
                                case 6:
                                    // CHECKING IF WE ARE RECEIVING OUR TEST EMPLOYEES
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(table.locator("text=".concat(employees_1.testEmployeeGivenNamePattern)).first()).toBeVisible(DEFAULT_TIMEOUT)];
                                case 7:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 5:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Employee editing is working', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var submitButton;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("employees")];
            case 1:
                _c.sent();
                return [4 /*yield*/, waitUntilEmployeeProviderTableLoaded(page)];
            case 2:
                _c.sent();
                return [4 /*yield*/, goToTestEmployeePage(page, resourceHandler.testEmployee1)];
            case 3:
                _c.sent();
                submitButton = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.submitButton);
                return [4 /*yield*/, test_1.test.step('Updating employee data', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, updateEmployeesFields(page, employees_1.TEST_EMPLOYEE_1_UPDATED_INFO)];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, submitButton.click(DEFAULT_TIMEOUT)];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, (0, tests_utils_1.waitForSnackbar)(page)];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(submitButton).not.toBeDisabled(DEFAULT_TIMEOUT)];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 4:
                _c.sent();
                return [4 /*yield*/, test_1.test.step('Checking employee were updated correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page.reload(DEFAULT_TIMEOUT)];
                                case 1:
                                    _a.sent();
                                    // we do that because these fields are unique and are set during initialization
                                    employees_1.TEST_EMPLOYEE_1_UPDATED_INFO.email = resourceHandler.testEmployee1.email;
                                    employees_1.TEST_EMPLOYEE_1_UPDATED_INFO.familyName = resourceHandler.testEmployee1.familyName;
                                    return [4 /*yield*/, checkEmployeeFields(page, employees_1.TEST_EMPLOYEE_1_UPDATED_INFO)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 5:
                _c.sent();
                return [4 /*yield*/, test_1.test.step('Returning employee to initial values', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, updateEmployeesFields(page, resourceHandler.testEmployee1)];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, submitButton.click(DEFAULT_TIMEOUT)];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, (0, test_1.expect)(submitButton).not.toBeDisabled(DEFAULT_TIMEOUT)];
                                case 3:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 6:
                _c.sent();
                return [4 /*yield*/, test_1.test.step('Updating employee data back to normal values', function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page.reload(DEFAULT_TIMEOUT)];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, checkEmployeeFields(page, resourceHandler.testEmployee1)];
                                case 2:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Deactivating employee success', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("employees")];
            case 1:
                _c.sent();
                return [4 /*yield*/, waitUntilEmployeeProviderTableLoaded(page)];
            case 2:
                _c.sent();
                return [4 /*yield*/, test_1.test.step('Go to employee page and click deactivate', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var deactivateButton;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, goToTestEmployeePage(page, resourceHandler.testEmployee2)];
                                case 1:
                                    _a.sent();
                                    deactivateButton = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.deactivateUserButton);
                                    return [4 /*yield*/, (0, test_1.expect)(deactivateButton).toBeVisible(DEFAULT_TIMEOUT)];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, deactivateButton.click(DEFAULT_TIMEOUT)];
                                case 3:
                                    _a.sent();
                                    return [4 /*yield*/, (0, tests_utils_1.waitForSnackbar)(page)];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 3:
                _c.sent();
                return [4 /*yield*/, test_1.test.step('Checking provider deactivated successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
                        var table, targetRow;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, page.goto("employees")];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, waitUntilEmployeeProviderTableLoaded(page)];
                                case 2:
                                    _a.sent();
                                    return [4 /*yield*/, page
                                            .getByTestId(data_test_ids_1.dataTestIds.employeesPage.searchByName)
                                            .getByRole('textbox')
                                            .fill(resourceHandler.testEmployee2.familyName)];
                                case 3:
                                    _a.sent();
                                    table = page.getByTestId(data_test_ids_1.dataTestIds.employeesPage.table);
                                    targetRow = table.locator("tr:has-text(\"".concat(resourceHandler.testEmployee2.email, "\")"));
                                    return [4 /*yield*/, (0, test_1.expect)(targetRow.getByTestId(data_test_ids_1.dataTestIds.employeesPage.statusChip)).toHaveText('DEACTIVATED')];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
//# sourceMappingURL=employees.spec.js.map