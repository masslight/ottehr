export interface StatementServiceLine {
  cpt: string;
  description: string;
  charged: string;
  insurancePaid: string;
  patientPaid: string;
  patientOwes: string;
}

export interface StatementDetails {
  pastDue: boolean;
  finalNotice: boolean;

  respParty: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    provinceOrState: string;
    postalOrZip: string;
    countryCode: string;
  };

  statement: {
    number: string;
    issueDate: string;
    dueDate: string;
  };

  patient: {
    firstName: string;
    lastName: string;
    dob: string;
  };

  insurance: {
    payerName: string;
    memberId: string;
  };

  visit: {
    date: string;
    time: string;
  };

  facility: {
    name: string;
  };

  biller: {
    name: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    provinceOrState: string;
    postalOrZip: string;
    countryCode: string;
    website: string;
    email: string;
    logoBase64: string;
  };

  service: StatementServiceLine[];

  totals: {
    charged: string;
    insurancePaid: string;
    patientPaid: string;
    balanceDue: string;
    deductible: string;
  };

  payment: {
    url: string;
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates an HTML preview of a statement by replacing placeholder tokens
 * in the provided HTML template with values from the statement details.
 *
 * Flat field placeholders use dot-notation inside double curly braces, e.g.:
 *   {{pastDue}}, {{respParty.firstName}}, {{statement.number}},
 *   {{patient.dob}}, {{insurance.payerName}}, {{visit.date}},
 *   {{facility.name}}, {{biller.website}}, {{biller.logoBase64}},
 *   {{totals.balanceDue}}, {{payment.url}}, etc.
 *
 * The {{serviceRows}} placeholder is replaced with the service lines rendered
 * as <tr> table rows.
 */
export function generateStatement(template: string, details: StatementDetails): string {
  const { service, ...detailsWithoutService } = details;
  const flat: Record<string, string> = {};

  function flatten(obj: Record<string, unknown>, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        flatten(value as Record<string, unknown>, path);
      } else if (typeof value === 'boolean') {
        flat[path] = String(value);
      } else if (typeof value === 'number') {
        flat[path] = String(value);
      } else {
        flat[path] = (value as string) ?? '';
      }
    }
  }

  flatten(detailsWithoutService as unknown as Record<string, unknown>, '');

  const serviceRows = service
    .map(
      (line) =>
        '<tr>' +
        [line.cpt, line.description, line.charged, line.insurancePaid, line.patientPaid, line.patientOwes]
          .map((cell) => `<td>${escapeHtml(cell ?? '')}</td>`)
          .join('') +
        '</tr>'
    )
    .join('');

  let html = template;
  for (const [key, value] of Object.entries(flat)) {
    html = html.split(`{{${key}}}`).join(escapeHtml(value));
  }
  html = html.split('{{serviceRows}}').join(serviceRows);
  return html;
}
