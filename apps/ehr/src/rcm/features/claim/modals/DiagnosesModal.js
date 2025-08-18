"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosesModal = void 0;
var Add_1 = require("@mui/icons-material/Add");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var RoundedButton_1 = require("../../../../components/RoundedButton");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../telemed");
var state_1 = require("../../../state");
var utils_1 = require("../../../utils");
var components_1 = require("./components");
var getDefaultValues = function (claimData) { return ({
    items: (claimData === null || claimData === void 0 ? void 0 : claimData.diagnoses) || [],
    comment: (claimData === null || claimData === void 0 ? void 0 : claimData.diagnosesComment) || '',
}); };
var DiagnosesModal = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useClaimStore, ['claimData', 'claim', 'setClaimData']), claimData = _a.claimData, claim = _a.claim, setClaimData = _a.setClaimData;
    var editClaim = (0, state_1.useEditClaimInformationMutation)();
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: getDefaultValues(claimData),
    });
    var control = methods.control, handleSubmit = methods.handleSubmit, reset = methods.reset;
    var _b = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: 'items',
    }), fields = _b.fields, append = _b.append, remove = _b.remove;
    var onSave = function (values, hideDialog) {
        if (!claim) {
            throw Error('Claim not provided');
        }
        var updatedClaim = (0, utils_1.mapDiagnosesToClaimResource)(claim, values);
        var editClaimPromise = editClaim.mutateAsync({
            claimData: updatedClaim,
            previousClaimData: claim,
            fieldsToUpdate: ['diagnosis', 'extension'],
        });
        Promise.resolve(editClaimPromise)
            .then(function (responseClaim) {
            setClaimData(responseClaim);
        })
            .catch(function (e) {
            console.error(e);
        })
            .finally(function () {
            hideDialog();
        });
    };
    return (<react_hook_form_1.FormProvider {...methods}>
      <components_1.EditModal title="21. Diagnoses" onSave={function (hideDialog) { return handleSubmit(function (values) { return onSave(values, hideDialog); })(); }} isSaveLoading={editClaim.isLoading} onShow={function () { return reset(getDefaultValues(claimData)); }}>
        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {fields.map(function (field, index) { return (<react_1.Fragment key={field.id}>
              <material_1.Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <material_1.Typography sx={{ width: '1rem' }}>{utils_1.DIAGNOSES_SEQUENCE_LETTER[index]}</material_1.Typography>
                <components_1.DiagnosisController name={"items.".concat(index)}/>
                <telemed_1.DeleteIconButton fontSize="medium" onClick={function () { return remove(index); }}/>
              </material_1.Box>
              <material_1.Divider flexItem/>
            </react_1.Fragment>); })}
          {fields.length < 12 && (<RoundedButton_1.RoundedButton startIcon={<Add_1.default />} variant="text" onClick={function () { return append(null); }}>
              Add diagnosis
            </RoundedButton_1.RoundedButton>)}
          <components_1.TextFieldController name="comment" label="Comment about diagnosis change" multiline/>
        </material_1.Box>
      </components_1.EditModal>
    </react_hook_form_1.FormProvider>);
};
exports.DiagnosesModal = DiagnosesModal;
//# sourceMappingURL=DiagnosesModal.js.map