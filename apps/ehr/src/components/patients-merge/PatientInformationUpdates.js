"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientInformationUpdates = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var telemed_1 = require("../../telemed");
var RoundedButton_1 = require("../RoundedButton");
var queries_1 = require("./queries");
var getTableValues = {
    '/name/0/given/0': {
        label: 'First Name',
    },
    '/name/0/family': {
        label: 'Last Name',
    },
    '/gender': {
        label: 'Gender',
    },
    '/contact/0/telecom/0/value': {
        label: 'Phone number',
    },
};
var PatientInformationUpdates = function (props) {
    var _a, _b;
    var patientId = props.patientId;
    var _c = (0, react_1.useState)(), patient = _c[0], setPatient = _c[1];
    var _d = (0, react_1.useState)(), task = _d[0], setTask = _d[1];
    (0, queries_1.useGetPatientForUpdate)({ patientId: patientId }, function (data) {
        var _a, _b, _c;
        var patient = data.find(function (resource) { return resource.resourceType === 'Patient'; });
        var task = data.find(function (item) { return item.resourceType === 'Task'; });
        setPatient(patient);
        setTask(task);
        reset((_c = (_b = (_a = task === null || task === void 0 ? void 0 : task.input) === null || _a === void 0 ? void 0 : _a.filter(function (item) { return item.valueString; })) === null || _b === void 0 ? void 0 : _b.map(function (item) { return JSON.parse(item.valueString); })) === null || _c === void 0 ? void 0 : _c.reduce(function (prev, curr) {
            prev[curr.path] = 'current';
            return prev;
        }, {}));
    });
    var methods = (0, react_hook_form_1.useForm)();
    var control = methods.control, handleSubmit = methods.handleSubmit, reset = methods.reset;
    var onSubmit = function (data) {
        console.log(data);
    };
    return (<telemed_1.InnerStateDialog DialogProps={{ maxWidth: 'lg' }} showCloseButton title={<material_1.Stack spacing={1} sx={{ p: 3, pb: 0 }}>
          <material_1.Typography variant="h4" color="primary.dark">
            Review Patient Information Updates
          </material_1.Typography>
          <material_1.Typography>
            Please select which information should carry over to the record after confirmation. You will be able to edit
            information after that, if needed.
          </material_1.Typography>
        </material_1.Stack>} content={<material_1.TableContainer sx={{ maxHeight: '60vh' }}>
          <material_1.Table size="small">
            <material_1.TableHead>
              <material_1.TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold' } }}>
                <material_1.TableCell variant="head">Parameter</material_1.TableCell>
                <material_1.TableCell variant="head">Current Information</material_1.TableCell>
                <material_1.TableCell variant="head">New Information</material_1.TableCell>
              </material_1.TableRow>
            </material_1.TableHead>

            <material_1.TableBody>
              {patient &&
                ((_b = (_a = task === null || task === void 0 ? void 0 : task.input) === null || _a === void 0 ? void 0 : _a.filter(function (item) { return item.valueString; })) === null || _b === void 0 ? void 0 : _b.map(function (item) {
                    var action = JSON.parse(item.valueString || '');
                    var path = action.path;
                    var oldValue = path
                        .split('/')
                        .filter(Boolean)
                        .reduce(function (prev, curr) { return prev === null || prev === void 0 ? void 0 : prev[curr]; }, patient);
                    return (<material_1.TableRow key={action.path}>
                        <material_1.TableCell>{getTableValues[action.path].label}</material_1.TableCell>
                        <material_1.TableCell>
                          <react_hook_form_1.Controller render={function (_a) {
                            var _b = _a.field, onChange = _b.onChange, value = _b.value;
                            return (<material_1.RadioGroup value={value} onChange={onChange}>
                                <material_1.FormControlLabel value="current" control={<material_1.Radio />} label={oldValue || '-'}/>
                              </material_1.RadioGroup>);
                        }} name={action.path} control={control}/>
                        </material_1.TableCell>
                        <material_1.TableCell>
                          <react_hook_form_1.Controller render={function (_a) {
                            var _b = _a.field, onChange = _b.onChange, value = _b.value;
                            return (<material_1.RadioGroup value={value} onChange={onChange}>
                                <material_1.FormControlLabel value="new" control={<material_1.Radio />} label={(action === null || action === void 0 ? void 0 : action.value) || '-'}/>
                              </material_1.RadioGroup>);
                        }} name={action.path} control={control}/>
                        </material_1.TableCell>
                      </material_1.TableRow>);
                }))}
            </material_1.TableBody>
          </material_1.Table>
        </material_1.TableContainer>} actions={function (hideDialog) { return (<material_1.Stack direction="row" spacing={2} justifyContent="space-between">
          <RoundedButton_1.RoundedButton onClick={hideDialog}>Cancel</RoundedButton_1.RoundedButton>
          <material_1.Stack direction="row" spacing={2}>
            <RoundedButton_1.RoundedButton variant="contained" color="error" onClick={hideDialog}>
              Dismiss All Updates
            </RoundedButton_1.RoundedButton>
            <RoundedButton_1.RoundedButton variant="contained" onClick={handleSubmit(onSubmit)}>
              Confirm Updates
            </RoundedButton_1.RoundedButton>
          </material_1.Stack>
        </material_1.Stack>); }}>
      {function (showDialog) { return (<material_1.Button disabled={!patientId} onClick={showDialog}>
          Patient information updates
        </material_1.Button>); }}
    </telemed_1.InnerStateDialog>);
};
exports.PatientInformationUpdates = PatientInformationUpdates;
//# sourceMappingURL=PatientInformationUpdates.js.map