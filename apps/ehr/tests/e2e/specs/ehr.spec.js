"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var constants_1 = require("../../e2e-utils/resource/constants");
var resource_handler_1 = require("../../e2e-utils/resource-handler");
var PatientInformationPage_1 = require("../page/PatientInformationPage");
var PatientsPage_1 = require("../page/PatientsPage");
var VisitsPage_1 = require("../page/VisitsPage");
// We may create new instances for the tests with mutable operations, and keep parallel tests isolated
var PROCESS_ID = "ehr.spec.ts-".concat(luxon_1.DateTime.now().toMillis());
var resourceHandler = new resource_handler_1.ResourceHandler(PROCESS_ID);
var awaitCSSHeaderInit = function (page) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, test_1.expect)(function () { return __awaiter(void 0, void 0, void 0, function () {
                    var content;
                    var _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.cssHeader.container).textContent()];
                            case 1:
                                content = _b.sent();
                                return [2 /*return*/, (_a = content === null || content === void 0 ? void 0 : content.includes(resourceHandler.patient.name[0].family)) !== null && _a !== void 0 ? _a : false];
                        }
                    });
                }); }).toPass({ timeout: 30000 })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
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
(0, test_1.test)('Happy path: set up filters and navigate to visit page', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var visitsPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, VisitsPage_1.openVisitsPage)(page)];
            case 1:
                visitsPage = _c.sent();
                // INITIAL DATA IS LOADED
                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId('PersonIcon')).toBeVisible()];
            case 2:
                // INITIAL DATA IS LOADED
                _c.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.dashboard.addPatientButton)).toBeVisible({ timeout: 15000 })];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, test_1.expect)(page.getByTestId(data_test_ids_1.dataTestIds.header.userName)).toBeAttached({ timeout: 15000 })];
            case 4:
                _c.sent();
                // CHOOSE DATE
                return [4 /*yield*/, page.waitForSelector('button[aria-label*="Choose date"]')];
            case 5:
                // CHOOSE DATE
                _c.sent();
                return [4 /*yield*/, page.click('button[aria-label*="Choose date"]')];
            case 6:
                _c.sent();
                return [4 /*yield*/, page.getByTestId(data_test_ids_1.dataTestIds.dashboard.datePickerTodayButton).locator('button').click()];
            case 7:
                _c.sent();
                return [4 /*yield*/, visitsPage.selectLocation(constants_1.ENV_LOCATION_NAME)];
            case 8:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickPrebookedTab()];
            case 9:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickArrivedButton(resourceHandler.appointment.id)];
            case 10:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickInOfficeTab()];
            case 11:
                _c.sent();
                return [4 /*yield*/, visitsPage.clickIntakeButton(resourceHandler.appointment.id)];
            case 12:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('CSS intake patient page is available', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/patient-info"))];
            case 1:
                _c.sent();
                return [4 /*yield*/, awaitCSSHeaderInit(page)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('CSS intake screening-questions page is available', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("/in-person/".concat(resourceHandler.appointment.id, "/screening-questions"))];
            case 1:
                _c.sent();
                return [4 /*yield*/, awaitCSSHeaderInit(page)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('CSS intake vitals page is available', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/vitals"))];
            case 1:
                _c.sent();
                return [4 /*yield*/, awaitCSSHeaderInit(page)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('CSS intake allergies page is available', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/allergies"))];
            case 1:
                _c.sent();
                return [4 /*yield*/, awaitCSSHeaderInit(page)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('CSS intake medications page is available', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/medications"))];
            case 1:
                _c.sent();
                return [4 /*yield*/, awaitCSSHeaderInit(page)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('CSS intake medical conditions page is available', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/medical-conditions"))];
            case 1:
                _c.sent();
                return [4 /*yield*/, awaitCSSHeaderInit(page)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('CSS intake surgical history page is available', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/surgical-history"))];
            case 1:
                _c.sent();
                return [4 /*yield*/, awaitCSSHeaderInit(page)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('CSS intake hospitalization page is available', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/hospitalization"))];
            case 1:
                _c.sent();
                return [4 /*yield*/, awaitCSSHeaderInit(page)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('CSS intake external lab orders page is available', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/external-lab-orders"))];
            case 1:
                _c.sent();
                return [4 /*yield*/, awaitCSSHeaderInit(page)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('CSS intake assessment page is available', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.goto("in-person/".concat(resourceHandler.appointment.id, "/assessment"))];
            case 1:
                _c.sent();
                return [4 /*yield*/, awaitCSSHeaderInit(page)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
test_1.test.describe('Patient search', function () {
    var patientData = {
        firstName: resource_handler_1.PATIENT_FIRST_NAME,
        lastName: resource_handler_1.PATIENT_LAST_NAME,
        dateOfBirth: resource_handler_1.PATIENT_BIRTH_DATE_SHORT,
        email: resource_handler_1.PATIENT_EMAIL,
        phoneNumber: resource_handler_1.PATIENT_PHONE_NUMBER,
        address: resource_handler_1.PATIENT_LINE + ', ' + resource_handler_1.PATIENT_LINE_2 + ', ' + resource_handler_1.PATIENT_CITY + '\n' + resource_handler_1.PATIENT_STATE + ' ' + resource_handler_1.PATIENT_POSTAL_CODE,
    };
    (0, test_1.test)('Search by Last name', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByLastName(resource_handler_1.PATIENT_LAST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickSearchButton()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyPatientPresent(__assign(__assign({}, patientData), { id: resourceHandler.patient.id }))];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Search by First name', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByGivenNames(resource_handler_1.PATIENT_FIRST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickSearchButton()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyPatientPresent(__assign(__assign({}, patientData), { id: resourceHandler.patient.id }))];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Search by Date of birth', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByDateOfBirth(resource_handler_1.PATIENT_BIRTH_DATE_SHORT)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickSearchButton()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyPatientPresent(__assign(__assign({}, patientData), { id: resourceHandler.patient.id }))];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Search by Phone number', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByMobilePhone(resource_handler_1.PATIENT_PHONE_NUMBER)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickSearchButton()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyPatientPresent(__assign(__assign({}, patientData), { id: resourceHandler.patient.id }))];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test_1.test.skip('Search by Address', { tag: '@flaky' }, function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByAddress(resource_handler_1.PATIENT_LINE.substring(0, 6))];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickSearchButton()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyPatientPresent(__assign(__assign({}, patientData), { id: resourceHandler.patient.id }))];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Search by Email', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByEmail(resource_handler_1.PATIENT_EMAIL.split('@')[0])];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickSearchButton()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyPatientPresent(__assign(__assign({}, patientData), { id: resourceHandler.patient.id }))];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Search by Last name and First name', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByLastName(resource_handler_1.PATIENT_LAST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.searchByGivenNames(resource_handler_1.PATIENT_FIRST_NAME)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickSearchButton()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyPatientPresent(__assign(__assign({}, patientData), { id: resourceHandler.patient.id }))];
                case 6:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Search by Last name and Date of birth', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByLastName(resource_handler_1.PATIENT_LAST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.searchByDateOfBirth(resource_handler_1.PATIENT_BIRTH_DATE_SHORT)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickSearchButton()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyPatientPresent(__assign(__assign({}, patientData), { id: resourceHandler.patient.id }))];
                case 6:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Search by Last name and Address', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByLastName(resource_handler_1.PATIENT_LAST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.searchByAddress(resource_handler_1.PATIENT_CITY)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickSearchButton()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyPatientPresent(__assign(__assign({}, patientData), { id: resourceHandler.patient.id }))];
                case 6:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Search by Last name and Phone number', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByLastName(resource_handler_1.PATIENT_LAST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.searchByMobilePhone(resource_handler_1.PATIENT_PHONE_NUMBER)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickSearchButton()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyPatientPresent(__assign(__assign({}, patientData), { id: resourceHandler.patient.id }))];
                case 6:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Search by Last name, First name and Date of birth', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByLastName(resource_handler_1.PATIENT_LAST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.searchByGivenNames(resource_handler_1.PATIENT_FIRST_NAME)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.searchByDateOfBirth(resource_handler_1.PATIENT_BIRTH_DATE_SHORT)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickSearchButton()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyPatientPresent(__assign(__assign({}, patientData), { id: resourceHandler.patient.id }))];
                case 7:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Reset filters', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientsPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, page.goto('/patients')];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, PatientsPage_1.expectPatientsPage)(page)];
                case 2:
                    patientsPage = _c.sent();
                    return [4 /*yield*/, patientsPage.searchByLastName(resource_handler_1.PATIENT_LAST_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.searchByGivenNames(resource_handler_1.PATIENT_FIRST_NAME)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.searchByDateOfBirth(resource_handler_1.PATIENT_BIRTH_DATE_SHORT)];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.searchByMobilePhone(resource_handler_1.PATIENT_PHONE_NUMBER)];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.searchByAddress(resource_handler_1.PATIENT_CITY)];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.searchByEmail(resource_handler_1.PATIENT_EMAIL.split('@')[0])];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.clickResetFiltersButton()];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, patientsPage.verifyFilterReset()];
                case 10:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
test_1.test.describe('Patient header tests', function () {
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
                case 0: return [4 /*yield*/, page.goto('/patient/' + resourceHandler.patient.id + '/info')];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    var HEADER_PATIENT_BIRTHDAY = (0, utils_1.formatDOB)(resource_handler_1.PATIENT_BIRTHDAY);
    var HEADER_PATIENT_GENDER = 'Male';
    var HEADER_PATIENT_NAME = resource_handler_1.PATIENT_LAST_NAME + ', ' + resource_handler_1.PATIENT_FIRST_NAME;
    (0, test_1.test)('Check header info', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage, patientHeader;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.expectPatientInformationPage)(page, resourceHandler.patient.id)];
                case 1:
                    patientInformationPage = _c.sent();
                    patientHeader = patientInformationPage.getPatientHeader();
                    return [4 /*yield*/, patientHeader.verifyHeaderPatientID('PID: ' + resourceHandler.patient.id)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, patientHeader.verifyHeaderPatientName(HEADER_PATIENT_NAME)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, patientHeader.verifyHeaderPatientBirthSex(HEADER_PATIENT_GENDER)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, patientHeader.verifyHeaderPatientBirthday(HEADER_PATIENT_BIRTHDAY)];
                case 5:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, test_1.test)('Check patient info', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientInformationPage;
        var page = _b.page;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, PatientInformationPage_1.expectPatientInformationPage)(page, resourceHandler.patient.id)];
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
});
//# sourceMappingURL=ehr.spec.js.map