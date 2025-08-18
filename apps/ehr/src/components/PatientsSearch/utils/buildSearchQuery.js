"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSearchQuery = void 0;
var buildSearchQuery = function (filter) {
    var baseUrl = 'r4/Patient';
    var params = [];
    if (filter.location && filter.location !== 'All') {
        params.push("_has:Appointment:patient:actor:Location.name:contains=".concat(encodeURIComponent(filter.location)));
    }
    params.push('_revinclude=Appointment:patient');
    params.push('_include:iterate=Appointment:actor:Location');
    if (filter.phone) {
        var digits = filter.phone.replace(/\D/g, '');
        params.push("phone:contains=".concat(digits, ",_has:RelatedPerson:patient:phone:contains=").concat(digits, ",_has:RelatedPerson:patient:_has:Person:link:phone:contains=").concat(digits));
        params.push('_revinclude=RelatedPerson:patient');
        params.push('_revinclude:iterate=Person:link');
    }
    if (filter.lastName) {
        params.push("family:contains=".concat(encodeURIComponent(filter.lastName)));
    }
    if (filter.givenNames) {
        var names = filter.givenNames.replace(' ', ',');
        params.push("given:contains=".concat(encodeURIComponent(names)));
    }
    if (filter.status === 'Active')
        params.push('active=true');
    else if (filter.status === 'Deceased')
        params.push('deceased=true');
    else if (filter.status === 'Inactive')
        params.push('active=false');
    if (filter.address) {
        params.push("address:contains=".concat(encodeURIComponent(filter.address)));
    }
    if (filter.dob)
        params.push("birthdate=".concat(encodeURIComponent(filter.dob)));
    if (filter.email)
        params.push("email:contains=".concat(encodeURIComponent(filter.email)));
    params.push('_total=accurate');
    return "".concat(baseUrl, "?").concat(params.join('&'));
};
exports.buildSearchQuery = buildSearchQuery;
//# sourceMappingURL=buildSearchQuery.js.map