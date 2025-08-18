"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientInstructionsTemplatesDialog = void 0;
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_query_1 = require("react-query");
var utils_1 = require("utils");
var RoundedButton_1 = require("../../../../../components/RoundedButton");
var components_1 = require("../../../../components");
var state_1 = require("../../../../state");
var PatientInstructionsTemplatesDialog = function (props) {
    var open = props.open, onClose = props.onClose, type = props.type, onSelect = props.onSelect;
    var theme = (0, material_1.useTheme)();
    var _a = (0, react_1.useState)([]), patientInstructions = _a[0], setPatientInstructions = _a[1];
    var isFetching = (0, state_1.useGetPatientInstructions)({ type: type }, function (data) {
        setPatientInstructions(data);
    }).isFetching;
    var isMyTemplates = type === 'provider';
    var _b = (0, state_1.useDeletePatientInstruction)(), mutate = _b.mutate, isDeleting = _b.isLoading;
    var queryClient = (0, react_query_1.useQueryClient)();
    var onDelete = function (id) {
        mutate({ instructionId: id }, {
            onSuccess: function () {
                void queryClient.invalidateQueries({ queryKey: ['telemed-get-patient-instructions'] });
            },
        });
        setPatientInstructions(function (prevState) { return prevState.filter(function (instruction) { return instruction.resourceId !== id; }); });
    };
    return (<material_1.Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <material_1.DialogTitle component="div" sx={{ p: 3, pb: 2, display: 'flex', alignItems: 'flex-start' }}>
        <material_1.Typography variant="h4" color={theme.palette.primary.dark} sx={{ flex: 1 }}>
          {isMyTemplates ? 'My instruction templates' : "".concat(utils_1.PROJECT_NAME, " instruction templates ")}
        </material_1.Typography>
        <material_1.IconButton size="small" onClick={onClose}>
          <Close_1.default fontSize="small"/>
        </material_1.IconButton>
      </material_1.DialogTitle>
      <material_1.Divider />
      <material_1.DialogContent sx={{
            p: 3,
        }}>
        {isFetching && patientInstructions.length === 0 ? (<material_1.Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <material_1.CircularProgress />
          </material_1.Box>) : patientInstructions.length === 0 ? (<material_1.Typography color={theme.palette.text.secondary}>No instruction templates</material_1.Typography>) : (<components_1.ActionsList data={patientInstructions} getKey={function (value, index) { return value.resourceId || index; }} renderItem={function (value) { return <material_1.Typography>{value.text}</material_1.Typography>; }} renderActions={function (value) { return (<material_1.Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {isMyTemplates && (<components_1.DeleteIconButton disabled={isDeleting} onClick={function () { return onDelete(value.resourceId); }}/>)}
                <RoundedButton_1.RoundedButton onClick={function () {
                    onSelect(value);
                    onClose();
                }} variant="contained">
                  Select
                </RoundedButton_1.RoundedButton>
              </material_1.Box>); }} gap={2} divider alignItems="flex-start"/>)}
      </material_1.DialogContent>
    </material_1.Dialog>);
};
exports.PatientInstructionsTemplatesDialog = PatientInstructionsTemplatesDialog;
//# sourceMappingURL=PatientInstructionsTemplatesDialog.js.map