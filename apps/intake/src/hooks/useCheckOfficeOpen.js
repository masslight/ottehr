"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCheckOfficeOpen = void 0;
var react_1 = require("react");
var useCheckOfficeOpen = function (selectedLocation) {
    return (0, react_1.useMemo)(function () {
        if (!selectedLocation) {
            // console.log('no selected location, office closed');
            return {
                officeOpen: false,
                walkinOpen: false,
                officeHasClosureOverrideToday: false,
                officeHasClosureOverrideTomorrow: false,
                prebookStillOpenForToday: false,
            };
        }
        return {
            officeOpen: true,
            walkinOpen: true,
            officeHasClosureOverrideToday: false,
            officeHasClosureOverrideTomorrow: false,
            prebookStillOpenForToday: true,
        };
    }, [selectedLocation]);
};
exports.useCheckOfficeOpen = useCheckOfficeOpen;
