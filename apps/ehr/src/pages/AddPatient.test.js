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
require("@testing-library/jest-dom");
var react_1 = require("@testing-library/react");
var user_event_1 = require("@testing-library/user-event");
var msw_1 = require("msw");
var node_1 = require("msw/node");
var react_router_dom_1 = require("react-router-dom");
var data_test_ids_1 = require("src/constants/data-test-ids");
var vitest_1 = require("vitest");
var AddPatient_1 = require("./AddPatient");
vitest_1.vi.mock('react-router-dom', function () { return __awaiter(void 0, void 0, void 0, function () {
    var actual;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, vitest_1.vi.importActual('react-router-dom')];
            case 1:
                actual = _a.sent();
                return [2 /*return*/, __assign(__assign({}, actual), { useNavigate: vitest_1.vi.fn() })];
        }
    });
}); });
(0, vitest_1.describe)('AddPatient', function () {
    var server = (0, node_1.setupServer)(msw_1.http.post('https://fhir-api.zapehr.com/Location/_search', function () {
        return msw_1.HttpResponse.json({ greeting: 'hello there' });
    }), msw_1.http.post('https://fhir-api.zapehr.com/Person/_search', function () {
        return msw_1.HttpResponse.json({ greeting: 'hello there' });
    })
    // http.post('https://project-api.zapehr.com/v1/zambda/get-schedule/execute-public', () => {
    //   return HttpResponse.json({
    //     status: 200,
    //     output: {
    //       message: 'Successfully retrieved all available slot times',
    //       available: [
    //         {
    //           slot: {
    //             resourceType: 'Slot',
    //             id: '7ed80758-1085-48a5-adb8-61ec1261b6d2|2025-06-16T09:30:00.000-04:00',
    //             start: '2025-06-16T09:30:00.000-04:00',
    //             serviceCategory: [
    //               {
    //                 coding: [
    //                   {
    //                     system: 'https://fhir.ottehr.com/slot-service-category',
    //                     code: 'in-person-service-mode',
    //                   },
    //                 ],
    //               },
    //             ],
    //             end: '2025-06-16T13:45:00.000+00:00',
    //             schedule: {
    //               reference: 'Schedule/7ed80758-1085-48a5-adb8-61ec1261b6d2',
    //             },
    //             status: 'free',
    //           },
    //           owner: {
    //             resourceType: 'Location',
    //             id: 'cdf183b2-c782-4567-9117-beee8066df1c',
    //             name: 'Selden- NY',
    //           },
    //           timezone: 'America/New_York',
    //         },
    //       ],
    //     },
    //   });
    // })
    );
    beforeAll(function () { return server.listen(); });
    afterEach(function () { return server.resetHandlers(); });
    afterAll(function () { return server.close(); });
    (0, vitest_1.it)('Renders with appropriate fields', function () {
        (0, react_1.render)(<react_router_dom_1.BrowserRouter>
        <AddPatient_1.default />
      </react_router_dom_1.BrowserRouter>);
        var locationHeader = react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.locationHeader);
        (0, vitest_1.expect)(locationHeader).toBeVisible();
    });
    (0, vitest_1.it)('Should test that when the user clicks on the cancel button, `navigate(/visits)` is called', function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, navigateMock, cancelButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    user = user_event_1.default.setup();
                    navigateMock = vitest_1.vi.fn();
                    vitest_1.vi.mocked(react_router_dom_1.useNavigate).mockReturnValue(navigateMock);
                    (0, react_1.render)(<react_router_dom_1.BrowserRouter>
        <AddPatient_1.default />
      </react_router_dom_1.BrowserRouter>);
                    cancelButton = react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.cancelButton);
                    (0, vitest_1.expect)(cancelButton).toBeVisible();
                    return [4 /*yield*/, user.click(cancelButton)];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(navigateMock).toHaveBeenCalledWith('/visits');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('Should show a validation error that phone number is required when search for patients is clicked before any phone number is entered', function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    user = user_event_1.default.setup();
                    (0, react_1.render)(<react_router_dom_1.BrowserRouter>
        <AddPatient_1.default />
      </react_router_dom_1.BrowserRouter>);
                    return [4 /*yield*/, user.click(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.searchForPatientsButton))];
                case 1:
                    _a.sent();
                    errorMessage = react_1.screen.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx');
                    (0, vitest_1.expect)(errorMessage).toBeVisible();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('Should show a validation error that phone number is invalid when search for patients is clicked with an invalid phone number in the field', function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, phoneNumberEntryField, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    user = user_event_1.default.setup();
                    (0, react_1.render)(<react_router_dom_1.BrowserRouter>
        <AddPatient_1.default />
      </react_router_dom_1.BrowserRouter>);
                    phoneNumberEntryField = react_1.screen
                        .getByTestId(data_test_ids_1.dataTestIds.addPatientPage.mobilePhoneInput)
                        .querySelector('input');
                    return [4 /*yield*/, user.click(phoneNumberEntryField)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, user.paste('123')];
                case 2:
                    _a.sent(); // Invalid number
                    return [4 /*yield*/, user.click(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.searchForPatientsButton))];
                case 3:
                    _a.sent();
                    errorMessage = react_1.screen.getByText('Phone number must be 10 digits in the format (xxx) xxx-xxxx');
                    (0, vitest_1.expect)(errorMessage).toBeVisible();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('Should use HTML5 required validation for all required fields', function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, phoneNumberEntryField, firstNameInput, _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    user = user_event_1.default.setup();
                    (0, react_1.render)(<react_router_dom_1.BrowserRouter>
        <AddPatient_1.default />
      </react_router_dom_1.BrowserRouter>);
                    (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.dashboard.locationSelect).querySelector('input')).toHaveAttribute('required');
                    phoneNumberEntryField = react_1.screen
                        .getByTestId(data_test_ids_1.dataTestIds.addPatientPage.mobilePhoneInput)
                        .querySelector('input');
                    (0, vitest_1.expect)(phoneNumberEntryField).toBeInTheDocument();
                    (0, vitest_1.expect)(phoneNumberEntryField).toHaveAttribute('required');
                    return [4 /*yield*/, user.click(phoneNumberEntryField)];
                case 1:
                    _e.sent();
                    return [4 /*yield*/, user.paste('1234567890')];
                case 2:
                    _e.sent(); // Sufficiently valid phone number
                    return [4 /*yield*/, user.click(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.searchForPatientsButton))];
                case 3:
                    _e.sent();
                    firstNameInput = react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.firstNameInput).querySelector('input');
                    (0, vitest_1.expect)(firstNameInput).toBeVisible();
                    (0, vitest_1.expect)(firstNameInput).toHaveAttribute('required');
                    (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.lastNameInput).querySelector('input')).toHaveAttribute('required');
                    _a = vitest_1.expect;
                    return [4 /*yield*/, react_1.screen.findByPlaceholderText('MM/DD/YYYY')];
                case 4:
                    _a.apply(void 0, [_e.sent()]).toHaveAttribute('required');
                    _b = vitest_1.expect;
                    return [4 /*yield*/, react_1.screen.findByTestId(data_test_ids_1.dataTestIds.addPatientPage.sexAtBirthDropdown)];
                case 5:
                    _b.apply(void 0, [(_e.sent()).querySelector('input')]).toHaveAttribute('required');
                    _c = vitest_1.expect;
                    return [4 /*yield*/, react_1.screen.findByTestId(data_test_ids_1.dataTestIds.addPatientPage.reasonForVisitDropdown)];
                case 6:
                    _c.apply(void 0, [(_e.sent()).querySelector('input')]).toHaveAttribute('required');
                    _d = vitest_1.expect;
                    return [4 /*yield*/, react_1.screen.findByTestId(data_test_ids_1.dataTestIds.addPatientPage.visitTypeDropdown)];
                case 7:
                    _d.apply(void 0, [(_e.sent()).querySelector('input')]).toHaveAttribute('required');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('Should show a  validation error if date of birth field has an invalid date', function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, phoneNumberEntryField, notFoundButton, dateOfBirthInput, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    user = user_event_1.default.setup();
                    (0, react_1.render)(<react_router_dom_1.BrowserRouter>
        <AddPatient_1.default />
      </react_router_dom_1.BrowserRouter>);
                    phoneNumberEntryField = react_1.screen
                        .getByTestId(data_test_ids_1.dataTestIds.addPatientPage.mobilePhoneInput)
                        .querySelector('input');
                    (0, vitest_1.expect)(phoneNumberEntryField).toBeInTheDocument();
                    return [4 /*yield*/, user.click(phoneNumberEntryField)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, user.paste('1234567890')];
                case 2:
                    _a.sent(); // Sufficiently valid phone number
                    return [4 /*yield*/, user.click(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.searchForPatientsButton))];
                case 3:
                    _a.sent();
                    notFoundButton = react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.patientNotFoundButton);
                    return [4 /*yield*/, user.click(notFoundButton)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, react_1.screen.findByPlaceholderText('MM/DD/YYYY')];
                case 5:
                    dateOfBirthInput = _a.sent();
                    (0, vitest_1.expect)(dateOfBirthInput).toBeVisible();
                    return [4 /*yield*/, user.click(dateOfBirthInput)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, user.paste('3')];
                case 7:
                    _a.sent(); // Invalid date
                    return [4 /*yield*/, user.tab()];
                case 8:
                    _a.sent(); // Trigger validation
                    errorMessage = react_1.screen.getByText('please enter date in format MM/DD/YYYY');
                    (0, vitest_1.expect)(errorMessage).toBeVisible();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('Should show a popup if user is in prebook visit type and does not select a slot', function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, phoneNumberEntryField, notFoundButton, visitTypeDropdownButton, prebookOption, addButton, slotSelectionPopup;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    user = user_event_1.default.setup();
                    (0, react_1.render)(<react_router_dom_1.BrowserRouter>
        <AddPatient_1.default />
      </react_router_dom_1.BrowserRouter>);
                    phoneNumberEntryField = react_1.screen
                        .getByTestId(data_test_ids_1.dataTestIds.addPatientPage.mobilePhoneInput)
                        .querySelector('input');
                    (0, vitest_1.expect)(phoneNumberEntryField).toBeInTheDocument();
                    return [4 /*yield*/, user.click(phoneNumberEntryField)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, user.paste('1234567890')];
                case 2:
                    _a.sent(); // Sufficiently valid phone number
                    return [4 /*yield*/, user.click(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.searchForPatientsButton))];
                case 3:
                    _a.sent();
                    notFoundButton = react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.patientNotFoundButton);
                    return [4 /*yield*/, user.click(notFoundButton)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, react_1.waitForElementToBeRemoved)(notFoundButton)];
                case 5:
                    _a.sent();
                    visitTypeDropdownButton = (0, react_1.within)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.visitTypeDropdown)).getByRole('combobox');
                    return [4 /*yield*/, user.click(visitTypeDropdownButton)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, react_1.screen.getByText('Pre-booked In Person Visit')];
                case 7:
                    prebookOption = _a.sent();
                    (0, vitest_1.expect)(prebookOption).toBeVisible();
                    return [4 /*yield*/, user.click(prebookOption)];
                case 8:
                    _a.sent();
                    addButton = react_1.screen.getByTestId(data_test_ids_1.dataTestIds.addPatientPage.addButton);
                    return [4 /*yield*/, user.click(addButton)];
                case 9:
                    _a.sent();
                    slotSelectionPopup = react_1.screen.getByText('To continue, please select an available appointment.');
                    (0, vitest_1.expect)(slotSelectionPopup).toBeVisible();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=AddPatient.test.js.map