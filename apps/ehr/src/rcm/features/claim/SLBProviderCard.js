"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLBProviderCard = void 0;
var react_1 = require("react");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var ClaimListCard_1 = require("./ClaimListCard");
var modals_1 = require("./modals");
var SLBProviderCard = function () {
    var _a;
    var _b = (0, getSelectors_1.getSelectors)(state_1.useClaimStore, [
        'organizations',
        'facilities',
        'claimData',
        'coverageData',
    ]), organizations = _b.organizations, facilities = _b.facilities, claimData = _b.claimData, coverageData = _b.coverageData;
    var facility = (0, react_1.useMemo)(function () { return facilities === null || facilities === void 0 ? void 0 : facilities.find(function (facility) { return facility.id === (claimData === null || claimData === void 0 ? void 0 : claimData.facilityId); }); }, [claimData === null || claimData === void 0 ? void 0 : claimData.facilityId, facilities]);
    var organization = (0, react_1.useMemo)(function () {
        return organizations === null || organizations === void 0 ? void 0 : organizations.find(function (organization) {
            var _a, _b, _c, _d;
            return organization.id ===
                ((_d = (_c = (_b = (_a = facilities === null || facilities === void 0 ? void 0 : facilities.find(function (facility) { return facility.id === (claimData === null || claimData === void 0 ? void 0 : claimData.facilityId); })) === null || _a === void 0 ? void 0 : _a.managingOrganization) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/')) === null || _d === void 0 ? void 0 : _d[1]);
        });
    }, [claimData === null || claimData === void 0 ? void 0 : claimData.facilityId, facilities, organizations]);
    return (<ClaimListCard_1.ClaimListCard title="Signature, Location and Billing Provider" items={[
            {
                label: '31.Signature of Physician or Supplier',
                value: (_a = organizations === null || organizations === void 0 ? void 0 : organizations.find(function (organization) { return organization.id === (coverageData === null || coverageData === void 0 ? void 0 : coverageData.organizationId); })) === null || _a === void 0 ? void 0 : _a.name,
            },
            {
                label: '32.Service Facility Location',
                value: facility === null || facility === void 0 ? void 0 : facility.name,
            },
            {
                label: '33.Billing Provider',
                value: organization === null || organization === void 0 ? void 0 : organization.name,
            },
            // {
            //   label: 'Pay-to',
            //   value: 'TODO',
            // },
        ]} editButton={<modals_1.SLBProviderModal />}/>);
};
exports.SLBProviderCard = SLBProviderCard;
//# sourceMappingURL=SLBProviderCard.js.map