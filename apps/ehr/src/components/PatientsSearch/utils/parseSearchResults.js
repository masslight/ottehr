"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSearchResults = void 0;
var parseSearchResults = function (fhirResponse) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    var patients = [];
    if (!fhirResponse.entry)
        return {
            patients: patients,
            pagination: { next: null, prev: null, totalItems: 0 },
        };
    var locationMap = new Map(fhirResponse.entry
        .filter(function (e) { var _a; return ((_a = e.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Location'; })
        .map(function (e) { var _a, _b; return [(_a = e === null || e === void 0 ? void 0 : e.resource) === null || _a === void 0 ? void 0 : _a.id, (_b = e === null || e === void 0 ? void 0 : e.resource) === null || _b === void 0 ? void 0 : _b.name]; }));
    var _loop_1 = function (entry) {
        if (((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) !== 'Patient')
            return "continue";
        var patient = entry.resource;
        var appointments = fhirResponse.entry
            .filter(function (e) {
            var _a, _b;
            return ((_a = e.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Appointment' &&
                ((_b = e.resource.participant) === null || _b === void 0 ? void 0 : _b.some(function (p) { var _a; return ((_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === "Patient/".concat(patient.id); }));
        })
            .map(function (e) { return e.resource; })
            .filter(Boolean);
        appointments.sort(function (a, b) { return new Date(b === null || b === void 0 ? void 0 : b.start).getTime() - new Date(a === null || a === void 0 ? void 0 : a.start).getTime(); });
        var lastAppointment = appointments[0];
        var lastVisit = void 0;
        if (lastAppointment) {
            var locationRef = (_d = (_c = (_b = lastAppointment.participant) === null || _b === void 0 ? void 0 : _b.find(function (p) { var _a, _b; return (_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Location/'); })) === null || _c === void 0 ? void 0 : _c.actor) === null || _d === void 0 ? void 0 : _d.reference;
            var locationId = locationRef === null || locationRef === void 0 ? void 0 : locationRef.split('/')[1];
            lastVisit = {
                date: lastAppointment.start,
                location: locationMap.get(locationId) || '',
            };
        }
        var lastName = (_f = (_e = patient.name) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.family;
        var parsedPatient = {
            id: patient.id,
            name: "".concat(lastName || '', ", ").concat(((_j = (_h = (_g = patient.name) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.given) === null || _j === void 0 ? void 0 : _j.join(' ')) || ''),
            birthDate: patient.birthDate,
            phone: (_l = (_k = patient.telecom) === null || _k === void 0 ? void 0 : _k.find(function (t) { return t.system === 'phone'; })) === null || _l === void 0 ? void 0 : _l.value,
            email: (_o = (_m = patient.telecom) === null || _m === void 0 ? void 0 : _m.find(function (t) { return t.system === 'email'; })) === null || _o === void 0 ? void 0 : _o.value,
            address: ((_p = patient.address) === null || _p === void 0 ? void 0 : _p[0])
                ? {
                    city: patient.address[0].city || '',
                    zip: patient.address[0].postalCode || '',
                    state: patient.address[0].state || '',
                    line: ((_q = patient.address[0].line) === null || _q === void 0 ? void 0 : _q.join(', ')) || '',
                }
                : undefined,
            lastVisit: lastVisit,
        };
        patients.push(parsedPatient);
    };
    for (var _i = 0, _r = fhirResponse.entry; _i < _r.length; _i++) {
        var entry = _r[_i];
        _loop_1(entry);
    }
    var pagination = {
        next: null,
        prev: null,
        totalItems: fhirResponse.total || 0,
    };
    if (fhirResponse.link) {
        var nextLink = fhirResponse.link.find(function (link) { return link.relation === 'next'; });
        var previousLink = fhirResponse.link.find(function (link) { return link.relation === 'previous'; });
        pagination.next = (nextLink === null || nextLink === void 0 ? void 0 : nextLink.url) || null;
        pagination.prev = (previousLink === null || previousLink === void 0 ? void 0 : previousLink.url) || null;
    }
    return {
        patients: patients,
        pagination: pagination,
    };
};
exports.parseSearchResults = parseSearchResults;
//# sourceMappingURL=parseSearchResults.js.map