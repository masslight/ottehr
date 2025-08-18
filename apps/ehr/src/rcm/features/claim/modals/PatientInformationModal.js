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
exports.PatientInformationModal = void 0;
var EditOutlined_1 = require("@mui/icons-material/EditOutlined");
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var RoundedButton_1 = require("../../../../components/RoundedButton");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../telemed");
var state_1 = require("../../../state");
var utils_2 = require("../../../utils");
var components_1 = require("./components");
var getDefaultValues = function (patientData, coverageData) { return ({
    firstName: (patientData === null || patientData === void 0 ? void 0 : patientData.firstName) || '',
    middleName: (patientData === null || patientData === void 0 ? void 0 : patientData.middleName) || '',
    lastName: (patientData === null || patientData === void 0 ? void 0 : patientData.lastName) || '',
    dob: (patientData === null || patientData === void 0 ? void 0 : patientData.dob) || null,
    sex: (patientData === null || patientData === void 0 ? void 0 : patientData.gender) || '',
    phone: (patientData === null || patientData === void 0 ? void 0 : patientData.phone) || '',
    address: (patientData === null || patientData === void 0 ? void 0 : patientData.addressLine) || '',
    city: (patientData === null || patientData === void 0 ? void 0 : patientData.city) || '',
    state: (patientData === null || patientData === void 0 ? void 0 : patientData.state) || '',
    zip: (patientData === null || patientData === void 0 ? void 0 : patientData.postalCode) || '',
    relationship: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.relationship) || '',
}); };
var PatientInformationModal = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useClaimStore, ['patientData', 'coverageData', 'patient', 'coverage', 'subscriber', 'setPatientData', 'setCoverageData']), patientData = _a.patientData, coverageData = _a.coverageData, patient = _a.patient, coverage = _a.coverage, subscriber = _a.subscriber, setPatientData = _a.setPatientData, setCoverageData = _a.setCoverageData;
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: getDefaultValues(patientData, coverageData),
    });
    var handleSubmit = methods.handleSubmit, reset = methods.reset;
    var editPatient = (0, telemed_1.useEditPatientInformationMutation)();
    var editCoverage = (0, state_1.useEditCoverageInformationMutation)();
    var onSave = function (values, hideDialog) { return __awaiter(void 0, void 0, void 0, function () {
        var updatedPatient, updatedCoverage, editPatientPromise, editCoveragePromise;
        return __generator(this, function (_a) {
            if (!patient) {
                throw Error('Patient not provided');
            }
            if (!coverage) {
                throw Error('Coverage not provided');
            }
            updatedPatient = (0, utils_2.mapPatientInformationToPatientResource)(patient, values);
            updatedCoverage = (0, utils_2.mapPatientInformationToCoverageResource)(coverage, values);
            editPatientPromise = editPatient.mutateAsync({
                updatedPatientData: updatedPatient,
                originalPatientData: patient,
                fieldsToUpdate: ['name', 'address', 'birthDate', 'gender', 'telecom'],
            });
            editCoveragePromise = editCoverage.mutateAsync({
                coverageData: updatedCoverage,
                previousCoverageData: coverage,
            });
            Promise.all([editPatientPromise, editCoveragePromise])
                .then(function () {
                setPatientData(updatedPatient);
                setCoverageData(updatedCoverage, subscriber);
            })
                .catch(function (e) {
                console.error(e);
            })
                .finally(function () {
                hideDialog();
            });
            return [2 /*return*/];
        });
    }); };
    return (<react_hook_form_1.FormProvider {...methods}>
      <components_1.EditModal title="Patient information" onSave={function (hideDialog) { return handleSubmit(function (values) { return onSave(values, hideDialog); })(); }} customDialogButton={function (showDialog) { return (<RoundedButton_1.RoundedButton variant="text" onClick={function () {
                reset(getDefaultValues(patientData, coverageData));
                showDialog();
            }} startIcon={<EditOutlined_1.default />}>
            Edit on the Patient Master
          </RoundedButton_1.RoundedButton>); }} isSaveLoading={editPatient.isLoading || editCoverage.isLoading}>
        <material_1.Grid container spacing={2}>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="firstName" rules={utils_2.mapFieldToRules.firstName} label="2.First name *"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="middleName" label="2.Middle name"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="lastName" rules={utils_2.mapFieldToRules.lastName} label="2.Last name *"/>
          </material_1.Grid>

          <material_1.Grid item xs={4}>
            <components_1.DatePickerController name="dob" rules={utils_2.mapFieldToRules.dob} label="3.Date of birth *" format="MM.dd.yyyy" placeholder="MM.DD.YYYY"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="sex" rules={utils_2.mapFieldToRules.sex} label="3.Birth sex *" select>
              {utils_2.genderOptions.map(function (option) { return (<material_1.MenuItem key={option.value} value={option.value}>
                  {option.label}
                </material_1.MenuItem>); })}
            </components_1.TextFieldController>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="phone" rules={utils_2.mapFieldToRules.phone} label="5.Phone *" placeholder="(XXX) XXX-XXXX" InputProps={{ inputComponent: components_1.NumberMaskCustom }}/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="address" rules={utils_2.mapFieldToRules.address} label="5.Address *" placeholder="No., Street"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="city" rules={utils_2.mapFieldToRules.city} label="5.City *"/>
          </material_1.Grid>
          <material_1.Grid item xs={2}>
            <components_1.TextFieldController name="state" rules={utils_2.mapFieldToRules.state} label="5.State *" select>
              {utils_1.AllStates.map(function (state) { return (<material_1.MenuItem key={state.value} value={state.value}>
                  {state.label}
                </material_1.MenuItem>); })}
            </components_1.TextFieldController>
          </material_1.Grid>
          <material_1.Grid item xs={2}>
            <components_1.TextFieldController name="zip" rules={utils_2.mapFieldToRules.zip} label="5.ZIP *"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="relationship" rules={utils_2.mapFieldToRules.relationship} label="6.Patient relation to insured *" select>
              {utils_2.RELATIONSHIP_TO_INSURED.map(function (item) { return (<material_1.MenuItem key={item} value={item}>
                  {item}
                </material_1.MenuItem>); })}
            </components_1.TextFieldController>
          </material_1.Grid>
        </material_1.Grid>
      </components_1.EditModal>
    </react_hook_form_1.FormProvider>);
};
exports.PatientInformationModal = PatientInformationModal;
//# sourceMappingURL=PatientInformationModal.js.map