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
    addressLine1: string;
    addressLine2?: string;
    city: string;
    provinceOrState: string;
    postalOrZip: string;
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
 * The {{service}} placeholder is replaced with the raw JSON string of service
 * lines as-is (it should already be a serialised JSON array when passed in).
 */
export function generateStatement(template: string, details: StatementDetails): string {
  const flat: Record<string, string> = {};

  const detailsWithSerializedService = {
    ...details,
    service: JSON.stringify(details.service),
  };

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

  flatten(detailsWithSerializedService as unknown as Record<string, unknown>, '');

  let html = template;
  for (const [key, value] of Object.entries(flat)) {
    html = html.split(`{{${key}}}`).join(value);
  }
  return html;
}
