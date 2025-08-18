"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddendumCard = void 0;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var components_1 = require("../../../components");
var hooks_1 = require("../../../hooks");
var state_1 = require("../../../state");
var AddendumCard = function () {
    var _a;
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var addendumNote = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.addendumNote) === null || _a === void 0 ? void 0 : _a.text;
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: {
            addendumNote: addendumNote || '',
        },
    });
    var control = methods.control;
    var _b = (0, hooks_1.useDebounceNotesField)('addendumNote'), onValueChange = _b.onValueChange, isLoading = _b.isLoading;
    return (<components_1.AccordionCard label="Addendum">
      <material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'start' }}>
        <react_hook_form_1.Controller name="addendumNote" control={control} render={function (_a) {
            var _b = _a.field, value = _b.value, onChange = _b.onChange;
            return (<material_1.TextField value={value} onChange={function (e) {
                    onChange(e);
                    onValueChange(e.target.value);
                }} size="small" label="Note" fullWidth multiline InputProps={{
                    endAdornment: isLoading && (<material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <material_1.CircularProgress size="20px"/>
                  </material_1.Box>),
                }}/>);
        }}/>
      </material_1.Box>
    </components_1.AccordionCard>);
};
exports.AddendumCard = AddendumCard;
//# sourceMappingURL=AddendumCard.js.map