"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingModal = void 0;
var colors_1 = require("@ehrTheme/colors");
var Add_1 = require("@mui/icons-material/Add");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var RoundedButton_1 = require("../../../../components/RoundedButton");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../telemed");
var state_1 = require("../../../state");
var utils_1 = require("../../../utils");
var components_1 = require("./components");
var getDefaultValues = function (claimData) { return ({
    items: (claimData === null || claimData === void 0 ? void 0 : claimData.billingItems) || [],
    payment: (claimData === null || claimData === void 0 ? void 0 : claimData.patientPaid) || NaN,
}); };
var BillingModal = function () {
    var _a, _b;
    var _c = (0, getSelectors_1.getSelectors)(state_1.useClaimStore, [
        'organizations',
        'facilities',
        'claimData',
        'coverageData',
        'claim',
        'setClaimData',
    ]), organizations = _c.organizations, facilities = _c.facilities, claimData = _c.claimData, coverageData = _c.coverageData, claim = _c.claim, setClaimData = _c.setClaimData;
    var editClaim = (0, state_1.useEditClaimInformationMutation)();
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: getDefaultValues(claimData),
    });
    var control = methods.control, handleSubmit = methods.handleSubmit, watch = methods.watch, reset = methods.reset;
    var _d = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: 'items',
    }), fields = _d.fields, append = _d.append, remove = _d.remove;
    var onSave = function (values, hideDialog) {
        if (!claim) {
            throw Error('Claim not provided');
        }
        var updatedClaim = (0, utils_1.mapBillingToClaimResource)(claim, values);
        var editClaimPromise = editClaim.mutateAsync({
            claimData: updatedClaim,
            previousClaimData: claim,
            fieldsToUpdate: ['item', 'extension', 'total'],
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
    // TS2589: Type instantiation is excessively deep and possibly infinite.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    var currentItems = watch('items');
    var currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    });
    var provider = ((_a = organizations === null || organizations === void 0 ? void 0 : organizations.find(function (organization) { return organization.id === (coverageData === null || coverageData === void 0 ? void 0 : coverageData.organizationId); })) === null || _a === void 0 ? void 0 : _a.name) || '';
    var facility = ((_b = facilities === null || facilities === void 0 ? void 0 : facilities.find(function (facility) { return facility.id === (claimData === null || claimData === void 0 ? void 0 : claimData.facilityId); })) === null || _b === void 0 ? void 0 : _b.name) || '';
    return (<react_hook_form_1.FormProvider {...methods}>
      <components_1.EditModal maxWidth="xl" title="24. Billing" onShow={function () { return reset(getDefaultValues(claimData)); }} onSave={function (hideDialog) { return handleSubmit(function (values) { return onSave(values, hideDialog); })(); }} isSaveLoading={editClaim.isLoading}>
        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {fields.length > 0 && (<material_1.Table>
              <material_1.TableHead>
                <material_1.TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold' } }}>
                  <material_1.TableCell>A. Date</material_1.TableCell>
                  <material_1.TableCell>B. Place</material_1.TableCell>
                  {/* cSpell:disable-next Emerg.(ency) */}
                  <material_1.TableCell>C. Emerg.</material_1.TableCell>
                  <material_1.TableCell>D. Code & Modifiers</material_1.TableCell>
                  {/* cSpell:disable-next Diagn.(ostic) */}
                  <material_1.TableCell>E. Diagn. pointers</material_1.TableCell>
                  <material_1.TableCell>F. Charges, $</material_1.TableCell>
                  <material_1.TableCell>G. Units / Days</material_1.TableCell>
                  <material_1.TableCell>H. EPSDT</material_1.TableCell>
                  <material_1.TableCell>J. Rendering Provider NPI</material_1.TableCell>
                  <material_1.TableCell></material_1.TableCell>
                </material_1.TableRow>
              </material_1.TableHead>
              <material_1.TableBody>
                {fields.map(function (field, index) { return (<material_1.TableRow key={field.id}>
                    <material_1.TableCell>
                      <components_1.DateRangePickerController name={"items.".concat(index, ".date")} separator="-" variant="standard" sx={{ display: 'block' }}/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.TextField variant="standard" size="small" value={facility} disabled/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <components_1.CheckboxController name={"items.".concat(index, ".emergency")}/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <components_1.TextFieldController name={"items.".concat(index, ".code")} variant="standard" rules={{ required: true }}/>
                      <components_1.TextFieldController name={"items.".concat(index, ".modifiers")} variant="standard"/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      {/*<CheckboxController name={`items.${index}.pointerA`} label="A" />*/}
                      {/*<CheckboxController name={`items.${index}.pointerB`} label="B" />*/}
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <components_1.TextFieldController name={"items.".concat(index, ".charges")} variant="standard" type="number"/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <components_1.TextFieldController name={"items.".concat(index, ".units")} variant="standard" type="number"/>
                    </material_1.TableCell>
                    <material_1.TableCell>{/*<CheckboxController name={`items.${index}.epsdt`} />*/}</material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.TextField variant="standard" size="small" value={provider} disabled/>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <telemed_1.DeleteIconButton fontSize="medium" onClick={function () { return remove(index); }}/>
                    </material_1.TableCell>
                  </material_1.TableRow>); })}
              </material_1.TableBody>
            </material_1.Table>)}

          <RoundedButton_1.RoundedButton startIcon={<Add_1.default />} variant="text" onClick={function () {
            return append({
                date: [luxon_1.DateTime.now(), luxon_1.DateTime.now()],
                // place: '',
                emergency: false,
                code: '',
                modifiers: '',
                // pointerA: false,
                // pointerB: false,
                charges: 0,
                units: 0,
                // epsdt: false,
                // provider: '',
            });
        }}>
            Add billing item
          </RoundedButton_1.RoundedButton>

          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', maxWidth: '500px', gap: 3 }}>
            <material_1.Card elevation={0} sx={{
            backgroundColor: colors_1.otherColors.lightIconButton,
            px: 2,
            py: '10px',
            display: 'flex',
            justifyContent: 'space-between',
        }}>
              <material_1.Typography variant="h5" color="primary.dark">
                28. Total charge:
              </material_1.Typography>
              <material_1.Typography variant="h5" color="primary.main">
                {currencyFormatter.format(currentItems.reduce(function (prev, curr) {
            prev += +curr.charges;
            return prev;
        }, 0))}
              </material_1.Typography>
            </material_1.Card>

            <react_hook_form_1.Controller name="payment" control={control} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
            return (<material_1.Box sx={{ display: 'flex', flex: 1 }}>
                  <material_1.FormControlLabel control={<material_1.Checkbox checked={!isNaN(value)} onChange={function (e) { return (e.target.checked ? onChange(0) : onChange(NaN)); }}/>} label={<material_1.Typography noWrap>29.Patient Payment</material_1.Typography>}/>
                  <material_1.TextField helperText={error ? error.message : null} error={!!error} size="small" label="Paid, $" type="number" value={isNaN(value) ? '' : value} disabled={isNaN(value)} onChange={onChange} fullWidth/>
                </material_1.Box>);
        }}/>
          </material_1.Box>
        </material_1.Box>
      </components_1.EditModal>
    </react_hook_form_1.FormProvider>);
};
exports.BillingModal = BillingModal;
//# sourceMappingURL=BillingModal.js.map