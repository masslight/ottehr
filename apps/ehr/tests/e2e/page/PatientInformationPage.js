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
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _PatientInformationPage_page, _PatientInformationPage_insuranceCards, _InsuranceCard_container;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsuranceCard = exports.PatientInformationPage = exports.Field = void 0;
exports.expectPatientInformationPage = expectPatientInformationPage;
exports.openPatientInformationPage = openPatientInformationPage;
var test_1 = require("@playwright/test");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../src/constants/data-test-ids");
var AddInsuranceDialog_1 = require("./patient-information/AddInsuranceDialog");
var PatientHeader_1 = require("./PatientHeader");
var Field;
(function (Field) {
    Field[Field["PATIENT_LAST_NAME"] = 0] = "PATIENT_LAST_NAME";
    Field[Field["PATIENT_FIRST_NAME"] = 1] = "PATIENT_FIRST_NAME";
    Field[Field["PATIENT_DOB"] = 2] = "PATIENT_DOB";
    Field[Field["PATIENT_GENDER"] = 3] = "PATIENT_GENDER";
    Field[Field["DEMO_VISIT_STREET_ADDRESS"] = 4] = "DEMO_VISIT_STREET_ADDRESS";
    Field[Field["DEMO_VISIT_CITY"] = 5] = "DEMO_VISIT_CITY";
    Field[Field["DEMO_VISIT_STATE"] = 6] = "DEMO_VISIT_STATE";
    Field[Field["DEMO_VISIT_ZIP"] = 7] = "DEMO_VISIT_ZIP";
    Field[Field["PATIENT_EMAIL"] = 8] = "PATIENT_EMAIL";
    Field[Field["PATIENT_PHONE_NUMBER"] = 9] = "PATIENT_PHONE_NUMBER";
    Field[Field["DEMO_VISIT_PATIENT_ETHNICITY"] = 10] = "DEMO_VISIT_PATIENT_ETHNICITY";
    Field[Field["DEMO_VISIT_PATIENT_RACE"] = 11] = "DEMO_VISIT_PATIENT_RACE";
    Field[Field["DEMO_VISIT_RESPONSIBLE_RELATIONSHIP"] = 12] = "DEMO_VISIT_RESPONSIBLE_RELATIONSHIP";
    Field[Field["DEMO_VISIT_RESPONSIBLE_FIRST_NAME"] = 13] = "DEMO_VISIT_RESPONSIBLE_FIRST_NAME";
    Field[Field["DEMO_VISIT_RESPONSIBLE_LAST_NAME"] = 14] = "DEMO_VISIT_RESPONSIBLE_LAST_NAME";
    Field[Field["DEMO_VISIT_RESPONSIBLE_BIRTHDATE"] = 15] = "DEMO_VISIT_RESPONSIBLE_BIRTHDATE";
    Field[Field["DEMO_VISIT_RESPONSIBLE_PHONE"] = 16] = "DEMO_VISIT_RESPONSIBLE_PHONE";
    Field[Field["DEMO_VISIT_PROVIDER_FIRST_NAME"] = 17] = "DEMO_VISIT_PROVIDER_FIRST_NAME";
    Field[Field["DEMO_VISIT_PROVIDER_LAST_NAME"] = 18] = "DEMO_VISIT_PROVIDER_LAST_NAME";
    Field[Field["DEMO_VISIT_PRACTICE_NAME"] = 19] = "DEMO_VISIT_PRACTICE_NAME";
    Field[Field["DEMO_VISIT_PHYSICIAN_ADDRESS"] = 20] = "DEMO_VISIT_PHYSICIAN_ADDRESS";
    Field[Field["DEMO_VISIT_PHYSICIAN_MOBILE"] = 21] = "DEMO_VISIT_PHYSICIAN_MOBILE";
    Field[Field["DEMO_VISIT_POINT_OF_DISCOVERY"] = 22] = "DEMO_VISIT_POINT_OF_DISCOVERY";
    Field[Field["DEMO_VISIT_PREFERRED_LANGUAGE"] = 23] = "DEMO_VISIT_PREFERRED_LANGUAGE";
    Field[Field["GENDER_IDENTITY_ADDITIONAL_FIELD"] = 24] = "GENDER_IDENTITY_ADDITIONAL_FIELD";
})(Field || (exports.Field = Field = {}));
var FIELD_TO_TEST_ID = new Map()
    .set(Field.PATIENT_LAST_NAME, data_test_ids_1.dataTestIds.patientInformationContainer.patientLastName)
    .set(Field.PATIENT_FIRST_NAME, data_test_ids_1.dataTestIds.patientInformationContainer.patientFirstName)
    .set(Field.PATIENT_DOB, data_test_ids_1.dataTestIds.patientInformationContainer.patientDateOfBirth)
    .set(Field.PATIENT_GENDER, data_test_ids_1.dataTestIds.patientInformationContainer.patientBirthSex)
    .set(Field.DEMO_VISIT_STREET_ADDRESS, data_test_ids_1.dataTestIds.contactInformationContainer.streetAddress)
    .set(Field.DEMO_VISIT_CITY, data_test_ids_1.dataTestIds.contactInformationContainer.city)
    .set(Field.DEMO_VISIT_STATE, data_test_ids_1.dataTestIds.contactInformationContainer.state)
    .set(Field.DEMO_VISIT_ZIP, data_test_ids_1.dataTestIds.contactInformationContainer.zip)
    .set(Field.PATIENT_EMAIL, data_test_ids_1.dataTestIds.contactInformationContainer.patientEmail)
    .set(Field.PATIENT_PHONE_NUMBER, data_test_ids_1.dataTestIds.contactInformationContainer.patientMobile)
    .set(Field.DEMO_VISIT_PATIENT_ETHNICITY, data_test_ids_1.dataTestIds.patientDetailsContainer.patientsEthnicity)
    .set(Field.DEMO_VISIT_PATIENT_RACE, data_test_ids_1.dataTestIds.patientDetailsContainer.patientsRace)
    .set(Field.DEMO_VISIT_RESPONSIBLE_RELATIONSHIP, data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.relationshipDropdown)
    .set(Field.DEMO_VISIT_RESPONSIBLE_FIRST_NAME, data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.firstName)
    .set(Field.DEMO_VISIT_RESPONSIBLE_LAST_NAME, data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.lastName)
    .set(Field.DEMO_VISIT_RESPONSIBLE_BIRTHDATE, data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.dateOfBirthDropdown)
    .set(Field.DEMO_VISIT_RESPONSIBLE_PHONE, data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.phoneInput)
    .set(Field.DEMO_VISIT_POINT_OF_DISCOVERY, data_test_ids_1.dataTestIds.patientDetailsContainer.sendMarketingMessages)
    .set(Field.DEMO_VISIT_PREFERRED_LANGUAGE, data_test_ids_1.dataTestIds.patientDetailsContainer.preferredLanguage)
    .set(Field.DEMO_VISIT_PROVIDER_FIRST_NAME, data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.firstName)
    .set(Field.DEMO_VISIT_PROVIDER_LAST_NAME, data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.lastName)
    .set(Field.DEMO_VISIT_PRACTICE_NAME, data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.practiceName)
    .set(Field.DEMO_VISIT_PHYSICIAN_ADDRESS, data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.address)
    .set(Field.DEMO_VISIT_PHYSICIAN_MOBILE, data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.mobile)
    .set(Field.GENDER_IDENTITY_ADDITIONAL_FIELD, data_test_ids_1.dataTestIds.patientDetailsContainer.pleaseSpecifyField);
var PatientInformationPage = /** @class */ (function () {
    function PatientInformationPage(page) {
        _PatientInformationPage_page.set(this, void 0);
        _PatientInformationPage_insuranceCards.set(this, void 0);
        __classPrivateFieldSet(this, _PatientInformationPage_page, page, "f");
        __classPrivateFieldSet(this, _PatientInformationPage_insuranceCards, [
            new InsuranceCard(page.getByTestId('insuranceContainer').nth(0)),
            new InsuranceCard(page.getByTestId('insuranceContainer').nth(1)),
        ], "f");
    }
    PatientInformationPage.prototype.getPatientHeader = function () {
        return new PatientHeader_1.PatientHeader(__classPrivateFieldGet(this, _PatientInformationPage_page, "f"));
    };
    PatientInformationPage.prototype.getInsuranceCard = function (index) {
        return __classPrivateFieldGet(this, _PatientInformationPage_insuranceCards, "f")[index];
    };
    PatientInformationPage.prototype.enterPatientLastName = function (patientLastName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientLastName)
                            .locator('input')
                            .fill(patientLastName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientLastName = function (patientLastName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientLastName).locator('input')).toHaveValue(patientLastName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearPatientLastName = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientLastName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyValidationErrorShown = function (field) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(FIELD_TO_TEST_ID.get(field)).locator('p:text("This field is required")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterPatientFirstName = function (patientFirstName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientFirstName)
                            .locator('input')
                            .fill(patientFirstName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientFirstName = function (patientFirstName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientFirstName).locator('input')).toHaveValue(patientFirstName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearPatientFirstName = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientFirstName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterPatientMiddleName = function (patientMiddleName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientMiddleName)
                            .locator('input')
                            .fill(patientMiddleName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientMiddleName = function (patientMiddleName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientMiddleName).locator('input')).toHaveValue(patientMiddleName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterPatientSuffix = function (patientSuffix) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientSuffix)
                            .locator('input')
                            .fill(patientSuffix)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientSuffix = function (patientSuffix) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientSuffix).locator('input')).toHaveValue(patientSuffix)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterPatientPreferredName = function (patientPreferredName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientPreferredName)
                            .locator('input')
                            .fill(patientPreferredName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientPreferredName = function (patientPreferredName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientPreferredName).locator('input')).toHaveValue(patientPreferredName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterPatientDateOfBirth = function (patientDateOfBirth) {
        return __awaiter(this, void 0, void 0, function () {
            var locator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        locator = __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientDateOfBirth).locator('input');
                        return [4 /*yield*/, locator.click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, locator.pressSequentially(patientDateOfBirth)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientDateOfBirth = function (patientDateOfBirth) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientDateOfBirth).locator('input')).toHaveValue(patientDateOfBirth)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearPatientDateOfBirth = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientDateOfBirth).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectPatientPreferredPronouns = function (pronouns) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientPreferredPronouns).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(pronouns, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientPreferredPronouns = function (patientPreferredPronouns) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientPreferredPronouns).locator('input')).toHaveValue(patientPreferredPronouns)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectPatientBirthSex = function (birthSex) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientBirthSex).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(birthSex, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientBirthSex = function (patientBirthSex) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientBirthSex).locator('input')).toHaveValue(patientBirthSex)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearPatientBirthSex = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationContainer.patientBirthSex).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterStreetAddress = function (streetAddress) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.streetAddress)
                            .locator('input')
                            .fill(streetAddress)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyStreetAddress = function (streetAddress) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.streetAddress).locator('input')).toHaveValue(streetAddress)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearStreetAddress = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.streetAddress).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterAddressLineOptional = function (addressLineOptional) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.addressLineOptional)
                            .locator('input')
                            .fill(addressLineOptional)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyAddressLineOptional = function (addressLineOptional) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.addressLineOptional).locator('input')).toHaveValue(addressLineOptional)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterCity = function (city) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.city).locator('input').fill(city)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyCity = function (city) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.city).locator('input')).toHaveValue(city)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearCity = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.city).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectState = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.state).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(state, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyState = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.state).locator('input')).toHaveValue(state)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterZip = function (zip) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.zip).locator('input').fill(zip)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyZip = function (zip) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.zip).locator('input')).toHaveValue(zip)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyValidationErrorZipField = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.zip).locator('p:text("Must be 5 digits")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearZip = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.zip).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterPatientEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.patientEmail).locator('input').fill(email)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.patientEmail).locator('input')).toHaveValue(email)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearPatientEmail = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.patientEmail).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyValidationErrorInvalidEmail = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.patientEmail)
                            .locator('p:text("Must be in the format \\"email@example.com\\"")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterPatientMobile = function (patientMobile) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.patientMobile)
                            .locator('input')
                            .fill(patientMobile)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientMobile = function (patientMobile) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.patientMobile).locator('input')).toHaveValue((0, utils_1.formatPhoneNumberForQuestionnaire)(patientMobile))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearPatientMobile = function () {
        return __awaiter(this, void 0, void 0, function () {
            var i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.patientMobile).locator('input').click()];
                    case 1:
                        _a.sent();
                        i = 0;
                        _a.label = 2;
                    case 2:
                        if (!(i <= 20)) return [3 /*break*/, 5];
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").keyboard.press('Backspace')];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyValidationErrorInvalidMobile = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.contactInformationContainer.patientMobile)
                            .locator('p:text("Phone number must be 10 digits in the format (xxx) xxx-xxxx")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectPatientEthnicity = function (patientEthnicity) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.patientsEthnicity).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(patientEthnicity, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientEthnicity = function (patientEthnicity) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.patientsEthnicity).locator('input')).toHaveValue(patientEthnicity)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectPatientRace = function (patientEthnicity) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.patientsRace).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(patientEthnicity, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPatientRace = function (patientRace) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.patientsRace).locator('input')).toHaveValue(patientRace)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectHowDidYouHear = function (howDidYouHear) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.howDidYouHearAboutUs).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(howDidYouHear, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyHowDidYouHear = function (howDidYouHear) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.howDidYouHearAboutUs).locator('input')).toHaveValue(howDidYouHear)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectMarketingMessaging = function (marketingMessaging) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.sendMarketingMessages).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(marketingMessaging, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyMarketingMessaging = function (marketingMessaging) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.sendMarketingMessages)).toHaveText(marketingMessaging)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectPreferredLanguage = function (preferredLanguage) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.preferredLanguage).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(preferredLanguage, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPreferredLanguage = function (preferredLanguage) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.preferredLanguage).locator('input')).toHaveValue(preferredLanguage)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectSexualOrientation = function (sexualOrientation) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.sexualOrientation).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(sexualOrientation, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifySexualOrientation = function (sexualOrientation) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.sexualOrientation).locator('input')).toHaveValue(sexualOrientation)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectGenderIdentity = function (genderIdentity) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.genderIdentity).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(genderIdentity, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyGenderIdentity = function (genderIdentity) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.genderIdentity)).toHaveText(genderIdentity)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyOtherGenderFieldIsVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.pleaseSpecifyField).locator('input').isVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyOtherGenderFieldIsNotVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.pleaseSpecifyField).locator('input').isHidden()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterOtherGenderField = function (specifyInput) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.pleaseSpecifyField)
                            .locator('input')
                            .fill(specifyInput)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyOtherGenderInput = function (specifyInput) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.pleaseSpecifyField).locator('input')).toHaveValue(specifyInput)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectCommonWellConsent = function (commonWellConsent) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.commonWellConsent).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(commonWellConsent, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyCommonWellConsent = function (commonWellConsent) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientDetailsContainer.commonWellConsent)).toHaveText(commonWellConsent)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectRelationshipFromResponsibleContainer = function (relationship) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.relationshipDropdown).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(relationship, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyRelationshipFromResponsibleContainer = function (relationship) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.relationshipDropdown).locator('input')).toHaveValue(relationship)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterFirstNameFromResponsibleContainer = function (firstName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.firstName)
                            .locator('input')
                            .fill(firstName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyFirstNameFromResponsibleContainer = function (firstName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.firstName).locator('input')).toHaveValue(firstName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearFirstNameFromResponsibleContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.firstName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterLastNameFromResponsibleContainer = function (lastName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.lastName)
                            .locator('input')
                            .fill(lastName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyLastNameFromResponsibleContainer = function (lastName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.lastName).locator('input')).toHaveValue(lastName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearLastNameFromResponsibleContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.lastName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterDateOfBirthFromResponsibleContainer = function (dateOfBirth) {
        return __awaiter(this, void 0, void 0, function () {
            var locator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        locator = __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.dateOfBirthDropdown)
                            .locator('input');
                        return [4 /*yield*/, locator.click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, locator.pressSequentially(dateOfBirth)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyDateOfBirthFromResponsibleContainer = function (dateOfBirth) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.dateOfBirthDropdown).locator('input')).toHaveValue(dateOfBirth)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyValidationErrorForDateOfBirth = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.dateOfBirthDropdown)
                            .locator('p:text("Responsible party should be older than 18 years")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearDateOfBirthFromResponsibleContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.dateOfBirthDropdown)
                            .locator('input')
                            .clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectBirthSexFromResponsibleContainer = function (birthSex) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.birthSexDropdown).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").locator('li').getByText(birthSex, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyBirthSexFromResponsibleContainer = function (birthSex) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.birthSexDropdown).locator('input')).toHaveValue(birthSex)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearBirthSexFromResponsibleContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.birthSexDropdown)
                            .locator('input')
                            .clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterPhoneFromResponsibleContainer = function (phone) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.phoneInput)
                            .locator('input')
                            .fill(phone)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPhoneFromResponsibleContainer = function (phone) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.phoneInput).locator('input')).toHaveValue(phone)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearPhoneFromResponsibleContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            var i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.phoneInput).locator('input').click()];
                    case 1:
                        _a.sent();
                        i = 0;
                        _a.label = 2;
                    case 2:
                        if (!(i <= 20)) return [3 /*break*/, 5];
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").keyboard.press('Backspace')];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterStreetLine1FromResponsibleContainer = function (line1) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.addressLine1)
                            .locator('input')
                            .fill(line1)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyStreetLine1FromResponsibleContainer = function (line1) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.addressLine1).locator('input')).toHaveValue(line1)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearStreetLine1FromResponsibleContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            var i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.addressLine1)
                            .locator('input')
                            .click()];
                    case 1:
                        _a.sent();
                        i = 0;
                        _a.label = 2;
                    case 2:
                        if (!(i <= 20)) return [3 /*break*/, 5];
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").keyboard.press('Backspace')];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterResponsiblePartyCity = function (city) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.city).locator('input').fill(city)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyResponsiblePartyCity = function (city) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.city).locator('input')).toHaveValue(city)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearResponsiblePartyCity = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.city).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectResponsiblePartyState = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.state).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(state, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyResponsiblePartyState = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.state).locator('input')).toHaveValue(state)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterResponsiblePartyZip = function (zip) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.zip).locator('input').fill(zip)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyResponsiblePartyZip = function (zip) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.zip).locator('input')).toHaveValue(zip)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyResponsiblePartyValidationErrorZipField = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.zip).locator('p:text("Must be 5 digits")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearResponsiblePartyZip = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.zip).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyValidationErrorInvalidPhoneFromResponsibleContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.phoneInput)
                            .locator('p:text("Phone number must be 10 digits in the format (xxx) xxx-xxxx")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectReleaseOfInfo = function (releaseOfInfo) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.userSettingsContainer.releaseOfInfoDropdown).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(releaseOfInfo, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyReleaseOfInfo = function (releaseOfInfo) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.userSettingsContainer.releaseOfInfoDropdown)).toHaveText(releaseOfInfo)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.selectRxHistoryConsent = function (rxHistoryConsent) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.userSettingsContainer.RxHistoryConsentDropdown).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText(rxHistoryConsent, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyRxHistoryConsent = function (rxHistoryConsent) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.userSettingsContainer.RxHistoryConsentDropdown).locator('input')).toHaveValue(rxHistoryConsent)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.reloadPatientInformationPage = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").reload()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clickSaveChangesButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationPage.saveChangesButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyUpdatedSuccessfullyMessageShown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText('Patient information updated successfully')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.setCheckboxOff = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.pcpCheckbox)
                            .locator('input')
                            .setChecked(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyCheckboxOff = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.pcpCheckbox).locator('input')).toBeChecked({
                            checked: false,
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.setCheckboxOn = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.pcpCheckbox)
                            .locator('input')
                            .setChecked(true)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyCheckboxOn = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.pcpCheckbox).locator('input')).toBeChecked({
                            checked: true,
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterFirstNameFromPcp = function (firstName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.firstName).locator('input').fill(firstName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyFirstNameFromPcp = function (firstName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.firstName).locator('input')).toHaveValue(firstName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyFirstNameFromPcpIsVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.firstName).locator('input').isVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyFirstNameFromPcpIsNotVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.firstName).locator('input').isHidden()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearFirstNameFromPcp = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.firstName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterLastNameFromPcp = function (lastName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.lastName).locator('input').fill(lastName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyLastNameFromPcp = function (lastName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.lastName).locator('input')).toHaveValue(lastName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyLastNameFromPcpIsVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.lastName).locator('input').isVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyLastNameFromPcpIsNotVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.lastName).locator('input').isHidden()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearLastNameFromPcp = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.lastName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterPracticeNameFromPcp = function (practiceName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.practiceName)
                            .locator('input')
                            .fill(practiceName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPracticeNameFromPcp = function (practiceName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.practiceName).locator('input')).toHaveValue(practiceName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPracticeNameFromPcpIsVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.practiceName).locator('input').isVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyPracticeNameFromPcpIsNotVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.practiceName).locator('input').isHidden()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearPracticeNameFromPcp = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.practiceName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterAddressFromPcp = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.address).locator('input').fill(address)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyAddressFromPcp = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.address).locator('input')).toHaveValue(address)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyAddressFromPcpIsVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.address).locator('input').isVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyAddressFromPcpIsNotVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.address).locator('input').isHidden()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearAddressFromPcp = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.address).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.enterMobileFromPcp = function (mobile) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.mobile).locator('input').fill(mobile)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyMobileFromPcp = function (mobile) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.mobile).locator('input')).toHaveValue(mobile)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyMobileFromPcpIsVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.mobile).locator('input').isVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyMobileFromPcpIsNotVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.mobile).locator('input').isHidden()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyValidationErrorInvalidPhoneFromPcp = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.mobile)
                            .locator('p:text("Phone number must be 10 digits in the format (xxx) xxx-xxxx")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clearMobileFromPcp = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.mobile).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clickAddInsuranceButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationPage.addInsuranceButton).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.id).isVisible()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, new AddInsuranceDialog_1.AddInsuranceDialog(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.id))];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyAddInsuranceButtonIsHidden = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationPage.addInsuranceButton).isHidden()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyAddInsuranceButtonIsVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationPage.addInsuranceButton).isVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.verifyCoverageRemovedMessageShown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByText('Coverage removed from patient account')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clickCloseButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientHeader.closeButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clickPatientNameBreadcrumb = function (patientName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationPage.breadcrumb).getByText(patientName).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientInformationPage.prototype.clickPatientsBreadcrumb = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientInformationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patientInformationPage.breadcrumb).getByText('Patients').click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return PatientInformationPage;
}());
exports.PatientInformationPage = PatientInformationPage;
_PatientInformationPage_page = new WeakMap(), _PatientInformationPage_insuranceCards = new WeakMap();
var InsuranceCard = /** @class */ (function () {
    function InsuranceCard(container) {
        _InsuranceCard_container.set(this, void 0);
        __classPrivateFieldSet(this, _InsuranceCard_container, container, "f");
    }
    InsuranceCard.prototype.waitUntilInsuranceCarrierIsRendered = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.insuranceCarrier).locator('input')).not.toHaveValue('')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyInsuranceType = function (type) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.type).locator('input')).toHaveValue(type)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyInsuranceCarrier = function (insuranceCarrier) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.insuranceCarrier).locator('input')).toHaveValue(insuranceCarrier)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyMemberId = function (memberId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.memberId).locator('input')).toHaveValue(memberId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.clickShowMoreButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.showMoreButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyPolicyHoldersFirstName = function (firstName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersFirstName).locator('input')).toHaveValue(firstName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyPolicyHoldersLastName = function (lastName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersLastName).locator('input')).toHaveValue(lastName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyPolicyHoldersMiddleName = function (middleName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersMiddleName).locator('input')).toHaveValue(middleName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyPolicyHoldersDateOfBirth = function (policyHoldersDateOfBirth) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersDateOfBirth).locator('input')).toHaveValue(policyHoldersDateOfBirth)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyPolicyHoldersSex = function (sex) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersSex).locator('input')).toHaveValue(sex)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyInsuranceStreetAddress = function (streetAddress) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.streetAddress).locator('input')).toHaveValue(streetAddress)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyInsuranceAddressLine2 = function (addressLine2) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.addressLine2).locator('input')).toHaveValue(addressLine2)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyInsuranceCity = function (city) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.city).locator('input')).toHaveValue(city)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyInsuranceState = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.state).locator('input')).toHaveValue(state)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyInsuranceZip = function (zip) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.zip).locator('input')).toHaveValue(zip)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyPatientsRelationshipToInjured = function (relationship) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.relationship).locator('input')).toHaveValue(relationship)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyAdditionalInsuranceInformation = function (additionalInfo) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.additionalInformation).locator('input')).toHaveValue(additionalInfo)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyAlwaysShownFieldsAreVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.type).locator('input').isVisible()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.insuranceCarrier).locator('input').isVisible()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.memberId).locator('input').isVisible()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyAdditionalFieldsAreVisible = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersFirstName)
                            .locator('input')
                            .isVisible()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                                .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersMiddleName)
                                .locator('input')
                                .isVisible()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                                .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersLastName)
                                .locator('input')
                                .isVisible()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                                .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersDateOfBirth)
                                .locator('input')
                                .isVisible()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersSex).locator('input').isVisible()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.streetAddress).locator('input').isVisible()];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.addressLine2).locator('input').isVisible()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.city).locator('input').isVisible()];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.state).locator('input').isVisible()];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.zip).locator('input').isVisible()];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.relationship).locator('input').isVisible()];
                    case 11:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                                .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.additionalInformation)
                                .locator('input')
                                .isVisible()];
                    case 12:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyAdditionalFieldsAreHidden = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersFirstName)
                            .locator('input')
                            .isHidden()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                                .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersMiddleName)
                                .locator('input')
                                .isHidden()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersLastName).locator('input').isHidden()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                                .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersDateOfBirth)
                                .locator('input')
                                .isHidden()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersSex).locator('input').isHidden()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.streetAddress).locator('input').isHidden()];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.addressLine2).locator('input').isHidden()];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.city).locator('input').isHidden()];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.state).locator('input').isHidden()];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.zip).locator('input').isHidden()];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.relationship).locator('input').isHidden()];
                    case 11:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.additionalInformation).locator('input').isHidden()];
                    case 12:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.clearMemberIdField = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.memberId).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.clearPolicyHolderFirstNameField = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersFirstName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.clearPolicyHolderLastNameField = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersLastName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.clearDateOfBirthFromInsuranceContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersDateOfBirth).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.clearStreetAddressFromInsuranceContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.streetAddress).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.clearCityFromInsuranceContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.city).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.clearZipFromInsuranceContainer = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.zip).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyValidationErrorShown = function (testId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(testId).locator('p:text("This field is required")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyValidationErrorZipFieldFromInsurance = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.zip).locator('p:text("Must be 5 digits")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyValidationErrorOnPrimaryInsuranceType = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.type)
                            .locator('p:text("Account may not have two secondary insurance plans")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.verifyValidationErrorOnSecondaryInsuranceType = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _InsuranceCard_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.type)
                            .locator('p:text("Account may not have two primary insurance plans")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.selectInsuranceType = function (type) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.type).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").page().locator("li:text(\"".concat(type, "\")")).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.selectInsuranceCarrier = function (insuranceCarrier) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.insuranceCarrier).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").page().locator("li:text(\"".concat(insuranceCarrier, "\")")).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.enterMemberId = function (memberId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.memberId).locator('input').fill(memberId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.enterPolicyHolderFirstName = function (firstName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersFirstName)
                            .locator('input')
                            .fill(firstName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.enterPolicyHolderMiddleName = function (middleName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersMiddleName)
                            .locator('input')
                            .fill(middleName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.enterPolicyHolderLastName = function (lastName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersLastName)
                            .locator('input')
                            .fill(lastName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.enterDateOfBirthFromInsuranceContainer = function (dateOfBirth) {
        return __awaiter(this, void 0, void 0, function () {
            var locator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        locator = __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersDateOfBirth)
                            .locator('input');
                        return [4 /*yield*/, locator.click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, locator.pressSequentially(dateOfBirth)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.selectPolicyHoldersBirthSex = function (birthSex) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.policyHoldersSex).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").page().locator("li:text(\"".concat(birthSex, "\")")).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.enterPolicyHolderStreetAddress = function (street) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.streetAddress).locator('input').fill(street)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.enterPolicyHolderAddressLine2 = function (addressLine2) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.addressLine2).locator('input').fill(addressLine2)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.enterPolicyHolderCity = function (city) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.city).locator('input').fill(city)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.selectPolicyHoldersState = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.state).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").page().locator("li:text(\"".concat(state, "\")")).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.enterZipFromInsuranceContainer = function (zip) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.zip).locator('input').fill(zip)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.selectPatientsRelationship = function (relationship) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.relationship).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").page().locator("li:text(\"".concat(relationship, "\")")).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.enterAdditionalInsuranceInformation = function (additionalInfo) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.additionalInformation)
                            .locator('input')
                            .fill(additionalInfo)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    InsuranceCard.prototype.clickRemoveInsuranceButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _InsuranceCard_container, "f").getByTestId(data_test_ids_1.dataTestIds.insuranceContainer.removeButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return InsuranceCard;
}());
exports.InsuranceCard = InsuranceCard;
_InsuranceCard_container = new WeakMap();
function expectPatientInformationPage(page, patientId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.waitForURL('/patient/' + patientId + '/info')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, page.locator('h3').getByText('Patient Information').isVisible()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, new PatientInformationPage(page)];
            }
        });
    });
}
function openPatientInformationPage(page, patientId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto('/patient/' + patientId + '/info')];
                case 1:
                    _a.sent();
                    return [2 /*return*/, expectPatientInformationPage(page, patientId)];
            }
        });
    });
}
//# sourceMappingURL=PatientInformationPage.js.map