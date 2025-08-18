"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientInstructionsCard = void 0;
var Add_1 = require("@mui/icons-material/Add");
var Done_1 = require("@mui/icons-material/Done");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var utils_1 = require("utils");
var RoundedButton_1 = require("../../../../components/RoundedButton");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var components_1 = require("../../../components");
var hooks_1 = require("../../../hooks");
var state_1 = require("../../../state");
var components_2 = require("./components");
var PatientInstructionsCard = function () {
    var _a = (0, react_1.useState)(false), collapsed = _a[0], setCollapsed = _a[1];
    var _b = (0, react_1.useState)(false), myTemplatesOpen = _b[0], setMyTemplatesOpen = _b[1];
    var _c = (0, react_1.useState)(false), defaultTemplatesOpen = _c[0], setDefaultTemplatesOpen = _c[1];
    var _d = (0, react_1.useState)(''), instruction = _d[0], setInstruction = _d[1];
    var _e = (0, state_1.useSavePatientInstruction)(), savePatientInstruction = _e.mutate, isSavePatientInstructionLoading = _e.isLoading;
    var _f = (0, state_1.useSaveChartData)(), saveChartData = _f.mutate, isSaveChartDataLoading = _f.isLoading;
    var deleteChartData = (0, state_1.useDeleteChartData)().mutate;
    var isLoading = isSavePatientInstructionLoading || isSaveChartDataLoading;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var _g = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData', 'setPartialChartData']), chartData = _g.chartData, setPartialChartData = _g.setPartialChartData;
    var instructions = (chartData === null || chartData === void 0 ? void 0 : chartData.instructions) || [];
    var onAddAndSave = function () {
        savePatientInstruction({ text: instruction }, {
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while saving patient instruction template. Please try again.', {
                    variant: 'error',
                });
            },
        });
        onAdd();
    };
    var onAdd = function () {
        var localInstructions = __spreadArray(__spreadArray([], instructions, true), [{ text: instruction }], false);
        setPartialChartData({
            instructions: localInstructions,
        });
        saveChartData({
            instructions: [{ text: instruction }],
        }, {
            onSuccess: function (data) {
                var _a;
                var instruction = (((_a = data === null || data === void 0 ? void 0 : data.chartData) === null || _a === void 0 ? void 0 : _a.instructions) || [])[0];
                if (instruction) {
                    setPartialChartData({
                        instructions: localInstructions.map(function (item) { return (item.resourceId ? item : instruction); }),
                    });
                }
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while adding patient instruction. Please try again.', {
                    variant: 'error',
                });
                setPartialChartData({ instructions: instructions });
                setInstruction(instruction);
            },
        });
        setInstruction('');
    };
    var onDelete = function (value) {
        setPartialChartData({
            instructions: instructions.filter(function (item) { return item.resourceId !== value.resourceId; }),
        });
        deleteChartData({
            instructions: [value],
        }, {
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while deleting patient instruction. Please try again.', {
                    variant: 'error',
                });
                setPartialChartData({ instructions: instructions });
            },
        });
    };
    return (<>
      <components_1.AccordionCard label="Patient instructions" collapsed={collapsed} onSwitch={function () { return setCollapsed(function (prevState) { return !prevState; }); }}>
        <material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!isReadOnly && (<>
              <material_1.Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <material_1.TextField value={instruction} onChange={function (e) { return setInstruction(e.target.value); }} size="small" label="Instruction" placeholder={"Enter a new instruction of select from own saved or ".concat(utils_1.PROJECT_NAME, " template")} multiline fullWidth/>
                <RoundedButton_1.RoundedButton onClick={onAdd} disabled={!instruction.trim() || isLoading} startIcon={<Add_1.default />}>
                  Add
                </RoundedButton_1.RoundedButton>
                <RoundedButton_1.RoundedButton onClick={onAddAndSave} disabled={!instruction.trim() || isLoading} startIcon={<Done_1.default />}>
                  Add & Save
                </RoundedButton_1.RoundedButton>
              </material_1.Box>
              <material_1.Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <RoundedButton_1.RoundedButton onClick={function () { return setMyTemplatesOpen(true); }}>My templates</RoundedButton_1.RoundedButton>
                <RoundedButton_1.RoundedButton onClick={function () { return setDefaultTemplatesOpen(true); }}>{utils_1.PROJECT_NAME} templates</RoundedButton_1.RoundedButton>
              </material_1.Box>
            </>)}

          {instructions.length > 0 && (<components_1.ActionsList data={instructions} getKey={function (value, index) { return value.resourceId || index; }} renderItem={function (value) { return <material_1.Typography style={{ whiteSpace: 'pre-line' }}>{value.text}</material_1.Typography>; }} renderActions={isReadOnly
                ? undefined
                : function (value) { return <components_1.DeleteIconButton disabled={!value.resourceId} onClick={function () { return onDelete(value); }}/>; }} divider gap={1}/>)}

          {instructions.length === 0 && isReadOnly && (<material_1.Typography color="secondary.light">No patient instructions provided</material_1.Typography>)}
        </material_1.Box>
      </components_1.AccordionCard>

      {myTemplatesOpen && (<components_2.PatientInstructionsTemplatesDialog open={myTemplatesOpen} onClose={function () { return setMyTemplatesOpen(false); }} type="provider" onSelect={function (value) { return setInstruction(value.text); }}/>)}
      {defaultTemplatesOpen && (<components_2.PatientInstructionsTemplatesDialog open={defaultTemplatesOpen} onClose={function () { return setDefaultTemplatesOpen(false); }} type="organization" onSelect={function (value) { return setInstruction(value.text); }}/>)}
    </>);
};
exports.PatientInstructionsCard = PatientInstructionsCard;
//# sourceMappingURL=PatientInstructionsCard.js.map