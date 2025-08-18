"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationList = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var useMedicationManagement_1 = require("../../../hooks/useMedicationManagement");
var EditableMedicationCard_1 = require("../medication-editable-card/EditableMedicationCard");
var MedicationWarnings_1 = require("./MedicationWarnings");
var MedicationList = function () {
    var medications = (0, useMedicationManagement_1.useMedicationManagement)().medications;
    // const selectsOptions = useFieldsSelectsOptions();
    var searchParams = (0, react_router_dom_1.useSearchParams)()[0];
    var scrollTo = searchParams.get('scrollTo');
    var pendingMedications = (0, react_1.useMemo)(function () {
        return medications.filter(function (medication) { return medication.status === 'pending'; });
    }, [medications]);
    (0, react_1.useLayoutEffect)(function () {
        if (scrollTo && pendingMedications.length > 0) {
            requestAnimationFrame(function () {
                var _a;
                var element = document.getElementById("medication-".concat(scrollTo));
                (_a = element === null || element === void 0 ? void 0 : element.scrollIntoView) === null || _a === void 0 ? void 0 : _a.call(element, { behavior: 'auto', block: 'start', inline: 'nearest' });
                var url = new URL(window.location.href);
                url.searchParams.delete('scrollTo');
                window.history.replaceState({}, '', url.toString());
            });
        }
    }, [scrollTo, pendingMedications]);
    if (medications.length === 0) {
        return <material_1.Typography>No medications found.</material_1.Typography>;
    }
    return (<material_1.Box>
      <MedicationWarnings_1.MedicationWarnings />
      {pendingMedications.map(function (medication) { return (<material_1.Box sx={{
                scrollMarginTop: '48px', // used for correct positioning on scrollIntoView to prevent table header overflow top card content
            }} key={medication.id} id={"medication-".concat(medication.id)}>
          <EditableMedicationCard_1.EditableMedicationCard medication={medication} type="dispense"/>
        </material_1.Box>); })}
    </material_1.Box>);
};
exports.MedicationList = MedicationList;
//# sourceMappingURL=MedicationList.js.map