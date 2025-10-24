/**
 * File used by Playwright MCP to create appointment that can be tested against in the EHR
 */

import { readFileSync } from 'fs';
import { DateTime } from 'luxon';
import { ResourceHandler } from './resource-handler.js';

// Load environment variables from tests.local.json
const testsConfig = JSON.parse(readFileSync('./apps/ehr/env/tests.local.json', 'utf-8'));
Object.assign(process.env, testsConfig);

// Get appointment type from command line args, default to 'in-person'
const appointmentType = process.argv[2] === 'telemed' ? 'telemed' : 'in-person';
const PROCESS_ID = `mcp-test-${appointmentType}-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, appointmentType);

async function createTestAppointment(): Promise<string> {
  try {
    console.log('Creating test appointment...');

    if (process.env.INTEGRATION_TEST === 'true') {
      await resourceHandler.setResourcesFast();
    } else {
      await resourceHandler.setResources();
      await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
    }

    console.log('\n✅ Test appointment created successfully!');
    console.log(`Appointment Type: ${appointmentType}`);
    console.log(`Appointment ID: ${resourceHandler.appointment.id}`);
    const urlPrefix = appointmentType === 'telemed' ? 'telemed/appointments' : 'in-person';
    console.log(`URL: http://localhost:4002/${urlPrefix}/${resourceHandler.appointment.id}`);
    console.log(`\nTo cleanup, run:`);
    console.log(`node cleanup-test-appointment.mjs ${resourceHandler.appointment.id}`);

    // Write the appointment ID to a file for later use
    const fs = await import('fs');
    fs.writeFileSync('.test-appointment-id', resourceHandler.appointment.id!);

    return resourceHandler.appointment.id!;
  } catch (error) {
    console.error('❌ Error creating test appointment:', error);
    process.exit(1);
  }
}

await createTestAppointment();
