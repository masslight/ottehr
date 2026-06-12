# Deploying Ottehr

This directory contains scripts and Terraform configuration for deploying Ottehr.

## Deployment Stacks

Ottehr is deployed as two independent Terraform stacks, each with its own root module, state, and apply pipeline:

- **Ottehr Clinical** (`deploy/`) — the EHR and Patient Portal apps, their infrastructure, and all shared Oystehr resources (project configuration, roles, M2M clients, secrets, FHIR resources, SendGrid templates) plus every zambda not owned by another stack.
- **Ottehr Billing** (`deploy/billing/`) — the Billing app, its bucket/CDN, the `OTTEHR_BILLING` Oystehr application, and the billing zambdas.

Which stack owns an Oystehr resource is declared in the spec files in `config/` via the optional `stack` field on each resource entry (see [the Schema package README](/packages/spec/README.md#deployment-stacks)); resources without a `stack` field belong to the clinical stack. `npm run generate` emits the clinical stack's resources into `deploy/oystehr/`, and `npm run generate-billing` emits the billing stack's into `deploy/billing/oystehr/`.

Both stacks share `deploy/backend.config` and the per-environment `deploy/${env}.tfvars` files. The billing stack stores its state under the `billing/terraform.tfstate` key (the billing `apply.sh` passes the key override during init) and manages its own Terraform workspaces, which it creates on demand.

The stacks deploy independently: `npm run apply-${env}` deploys clinical, `npm run apply-billing-${env}` deploys billing. The billing stack reads nothing from the clinical state. In particular, all Oystehr secrets belong to the clinical stack (the generator enforces this): secrets are project-scoped at runtime, so billing zambdas read the same secrets as clinical zambdas regardless of which stack provisioned them. On a brand-new environment, apply clinical first so project-level resources (project configuration, roles, secrets) exist before the billing stack deploys.

## Requirements

### Terraform

This project currently requires the `1.13` version of Terraform. You can download this directly from HashiCorp's [releases page](https://releases.hashicorp.com/terraform) and install it into your path, or use [Homebrew](https://brew.sh). For example to install from HashiCorp on an ARM Mac:

```bash
brew install wget # or use cURL
wget https://releases.hashicorp.com/terraform/1.13.5/terraform_1.13.5_darwin_arm64.zip
unzip terraform_1.13.5_darwin_arm64.zip -d /tmp
sudo cp /tmp/terraform /usr/local/bin/terraform
```

Using Homebrew:

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

Check the [1.13 releases page](https://releases.hashicorp.com/terraform/1.13.5/) if you aren't sure which version to install.

### Config Files

The following config files must be in place before running Terraform:

- `deploy/backend.config` with the S3 backend configuration values for your project
- `deploy/${env}.tfvars` for the environment you wish to deploy to
- `config/.env/${env}.json` for the environment you wish to deploy to

## Scripts

There are npm scripts for deploying to local, staging, and production, as well as generating config, initializing the local environment, and creating workspaces.

- `npm run terraform-init` &mdash; configures the local Terraform environment, using the backend configuration specified in `deploy/main.tf` and `deploy/backend.config`
- `ENV=${env} npm run generate` &mdash; generates Terraform config for the clinical stack from the Ottehr spec file and the variable JSON file at `packages/zambda/.env/${env}.json`
- `ENV=${env} npm run generate-billing` &mdash; generates Terraform config for the billing stack into `deploy/billing/oystehr/`
- `npm run apply-${env}` &mdash; generates Terraform config and deploys the clinical stack using `main.tf` and the `deploy/${env}.tfvars` file; the state is stored in the Terraform workspace corresponding to the environment
- `npm run apply-billing-${env}` &mdash; same for the billing stack, using `deploy/billing/main.tf` and the same tfvars file; billing state is stored under the `billing/terraform.tfstate` backend key
- `npm run terraform-setup` &mdash; one-time configuration to set up Terraform workspaces for all environments (clinical stack only; the billing stack creates its workspaces on demand)

## Setting up a New Project

If you are setting up in order to try out Ottehr by running locally, start with the terraform local backend so that you do not need to provision an AWS S3 bucket or alternative cloud infrastructure.

### Requirements

- Install Terraform [as discussed above](#terraform)
- Create an Oystehr project in the [Oystehr developer console](https://console.oystehr.com).
- Create an M2M Client with full access rights in your Oystehr project; you can use the default M2M created during project setup.
- Choose and configure your terraform backend:
  - Local backend
    - Change the terraform backend config to use the 'local' in [main.tf](./main.tf).
    - Create an empty deploy/backend.config file (`touch deploy/backend.config` from the repo root). The terraform-init npm script always passes --backend-config=./backend.config, so the file must exist even though the local backend reads its state path from main.tf and needs no overrides.
  - S3 backend
    - Create an S3 bucket for your terraform state (example: ottehr-terraform-state).
    - Configure your Terraform Backend ([`deploy/backend.config`](/deploy/backend.config.template)).
- Configure your local env Terraform variables ([`deploy/${env}.tfvars`](/deploy/terraform.tfvars.template)). For local usage, skip configuring the optional AWS and GCP variables. To deploy the front-end apps to AWS or GCP, configure the appropriate variables.
- Configure your application variables ([`config/.env/${env}.json`](/config/.env/local.template.json)) following the [config/.env README](/config/.env/README.md):
  - AUTH0_CLIENT
  - AUTH0_SECRET
  - ENVIRONMENT
  - PROJECT_ID
  - PATIENT_APP_NAME
  - EHR_APP_NAME
  - lab-autolab-account-number - globally unique, can be for example `ottehr-local` and so on for every env
  - non-prod env: "lab-autolab-lab-id": "790b282d-77e9-4697-9f59-0cef8238033a"
  - prod env: "lab-autolab-lab-id": "713d14ef-c30a-4b9a-a13a-4ad4648ff3ed"

- Change env names in the terraform-setup script in deploy/packages.json for envs that you want to create
- Run `npm run terraform-setup` once. This creates a local Terraform workspace (and others) that apply.sh requires. ⚠️  Only run this once per project. On a fresh install it's safe; re-running with the local backend wipes your state.

Finally, you're ready to deploy your project. You can either run apply on its own or start the entire application locally, which will apply all needed resource changes:

```bash
# From deploy/. This runs terraform apply only.
npm run apply-local

# From repository root. This runs terraform apply and starts all apps locally.
npm run apps:start
```

#### After Applying Terraform

- Create a new EHR app user in the Oystehr console and grant them the 'Administrator' role which was provisioned by Terraform.

#### To configure E2E tests

- Use the created m2m client for e2e tests to get client and secret vars and put it into tests.{env}.json in ehr and intake env folders so e2e tests can run
  - add those client and secret as AUTH0_CLIENT_TESTS and AUTH0_SECRET_TESTS to zambda env file and to /apps/{intake|ehr}/env/tests.{env}.json
  - Create a new EHR app user in the Oystehr Developer Console with the 'Administrator' role and then add TEXT_USERNAME and TEXT_PASSWORD fields into /apps/{intake|ehr}/env/tests.{env}.json with the email and password of the User.
  - Add PHONE_NUMBER, TEXT_USERNAME and TEXT_PASSWORD with username and a password to a ClickSend account so intake e2e tests can authorize

All those steps can be done executing `npm run fill-env-with-created-resources-data.ts {env}` after apply in deploy folder, except setting phone, username and passwords, you will have to do it manually

## Configuration Files

### Terraform Backend

The [Terraform backend](https://developer.hashicorp.com/terraform/language/backend) configuration determines where your project's state is stored. The state file is used to track managed resources over time. You will use a single `backend.config` file for all environments in your project. Each environment will be tracked as a separate Terraform workspace.

There is a placeholder [partial configuration](https://developer.hashicorp.com/terraform/language/backend#partial-configuration) for [using AWS S3 as a Terraform backend](https://developer.hashicorp.com/terraform/language/backend/s3) and a template in [`deploy/backend.config.template`](/deploy/backend.config.template).

Using S3 as a backend allows you to share state between developers and between a developer computer and your CI/CD process. If you only need to store state on a single computer and it doesn't need to be shared, you can replace the backend configuration with a [local one](https://developer.hashicorp.com/terraform/language/backend/local). You can also use any of the other state providers listed in the Terraform documentation.

### Terraform Variables

The Terraform variables stored in `deploy/${env}.tfvars` are used by Terraform providers for Oystehr, AWS, and GCP to provide access to the projects or accounts you want to deploy to. There is an example file available in [`deploy/terraform.tfvars.template`](/deploy/terraform.tfvars.template).

All providers need both an account or project identifier and credentials, which are provided either explicitly in this config file or implicitly through some other part of your environment. For example, the Oystehr Terraform provider requires `project_id`, `client_id`, and `client_secret` variables in this file, whereas the AWS provider requires only a profile that must be configured on your system with credentials associated with an AWS account.

Each environment will have its own `tfvars` file because Oystehr projects cannot be used for more than one environment at a time.

There are a few ways of providing configuration to the deploy process.

1. Copy `terraform.tfvars.template` to `terraform.tfvars` and fill it out with your configuration values.
1. Create environment-specific `.tfvars` files and reference them on the command-line: `terraform apply -var-file='staging.tfvars'`
1. Specify configuration values on the command-line: `terraform -var="project_id=123..." -var="client_id=abc..." -var="client_secret=def..."`

The npm scripts in this directory assume you are following the second pattern, and that you will have variable files for each environment when you want to deploy them.

#### Oystehr Variables

The following variables are required to run the deploy process:

```ini
project_id       = "00000000-..."
environment      = "staging"
client_id        = "..."
client_secret    = "..."
```

#### Sendgrid Variables

To set up Sendgrid email templates for use by Ottehr, the following variables are needed:

```ini
sendgrid_api_key = "..."
```

#### AWS Variables

To enable deployment to AWS as part of the deploy process, include at least an `aws_profile` variable in your tfvars:

```ini
aws_profile                = "ottehr"

# Include `*_domain` variables to set an alias on the CloudFront distribution
ehr_domain                 = "ehr.ottehr.com"
patient_portal_domain      = "patient.ottehr.com"

# Include `*_cert_domain` variables to lookup ACM certificate and use it for TLS on the CloudFront distribution
ehr_cert_domain            = "*.ottehr.com"
patient_portal_cert_domain = "*.ottehr.com"
```

You must have a valid key pair and region configured in your local AWS config matching the profile.

#### GCP Variables

To enable deployment to GCP as part of the deploy process, include the following variables in your tfvars:

```ini
gcp_project                = "..."
ehr_domain                 = "ehr.ottehr.com"
patient_portal_domain      = "patient.ottehr.com"
```

You must have previously authenticated with Google Cloud Platform using their command-line utility.

#### Changing Terraform Variables

Once set up, you should always use the same values for a given environment, otherwise you risk orphaning the managed resources. If you need to move from one account to another for a given provider, you should destroy all managed resources in the current account using `terraform destroy -target ...` before changing the `tfvars` values. The target should be whatever is appropriate for the provider you're trying to switch accounts for. For example, AWS is used in the `apps_upload` and `infra` modules, and Oystehr is used in the `oystehr` module. The Terraform docs contain more information about [resource targeting](https://developer.hashicorp.com/terraform/cli/commands/plan#resource-targeting). After cleaning up existing resources and changing to the new account, the next apply will create new resources.

### Application Variables

The environment file `config/.env/${env}.json` contains configuration values that control how the application works. When you run `npm run generate`, these values are combined with the resource definitions in `config/` to create `.tf.json` files in `deploy/oystehr/`. The values are also used as input for filling in environment variable templates

Each environment will have its own application configuration file because you will want to use different names, secrets, and API keys in your local, test, and production environments.

There is a sample configuration file stored in [`config/.env/local.template.json`](/config/.env/local.template.json).

You can verify that all required configuration variables have been found by searching `deploy/oystehr` for the string `#{var/` after running `npm run generate`. There will be 0 results when all variable values have been substituted.

### Setting up a New Environment in an Existing Project

If you need to set up a new environment that wasn't previously set up by the `terraform-setup` npm script, you should add a Terraform workspace using the Terraform CLI. For example, to add a `uat` environment:

```bash
terraform workspace new uat
```

Then you can either add an `apply-uat` npm script or run `./apply.sh uat` directly to deploy your environment.

## Environment-Specific Configuration

Some resources should only be deployed to specific environments (e.g., test cleanup jobs should not run in production). This is supported through environment-specific config directories:

```
config/oystehr/
├── zambdas.json              # Base config (all environments)
├── apps.json
├── roles.json
└── env/
    ├── local/
    │   └── zambdas.json      # Only deployed to 'local' environment
    └── e2e/
        └── zambdas.json      # Only deployed to 'e2e' environment
```

When running `npm run generate` with a specific environment, the script:

1. Reads all `.json` files from `config/oystehr/`
2. Checks if `config/oystehr/env/<env>/` exists
3. If it exists, also reads `.json` files from that directory
4. Merges all specs together (duplicate resource names will cause an error)

This allows environment-specific resources like test data cleanup cron jobs to be deployed only to test environments without affecting production.

## Migrating an Existing Environment to the Split Billing Stack

Environments deployed before the billing stack split have the billing resources (the Billing app build, its bucket/CDN, the `OTTEHR_BILLING` application, and the billing zambdas) in the clinical stack's state. The split moves them by **destroy and recreate**, not by state migration:

1. Run `npm run apply-${env}` (clinical). The plan will destroy the billing resources — review it to confirm nothing else changes. Note: the Billing app will be down until step 2 completes, so don't do this on an environment where billing is live without scheduling downtime.
2. Run `npm run apply-billing-${env}`. This creates the billing stack's workspace and state and recreates all billing resources.

Run the steps in that order: the billing bucket keeps the same name in both stacks, so the clinical apply must release it before the billing apply can create it.

## Modules

The clinical stack's modules live in `deploy/`; the billing stack mirrors the same structure under `deploy/billing/` (`infra`, `oystehr`, `billing_app`, `apps_upload`) but only manages billing resources.

### Oystehr

The `oystehr` module creates resources in Oystehr. It's contents are generated from the `config/oystehr/*.json` configuration files. Only Oystehr resources should be defined here.

### Sendgrid

The `sendgrid` module creates email templates in Sendgrid. Ottehr uses these email templates to communicate with patients.

### Infra

The `infra` module is responsible for setting up application infrastructure in a remote cloud environment. The default behavior is to not make any resources (using the `no-cloud` submodule).

The `aws` submodule will create the following resources:

- An S3 bucket for the EHR and Patient Portal apps, configured as a website for static hosting
- A CloudFront distribution for each app using its bucket as an origin

The `gcp` submodule will create a Google Cloud Storage bucket for the EHR and Patient Portal apps, configured as a website for static hosting.

You may optionally provide `ehr_domain` and `patient_portal_domain` values to configure those as aliases on their respective AWS CloudFront distributions. For GCP deployments, those variables are required to create the buckets.

### Ottehr Apps

The `ottehr_apps` module compiles the Ottehr applications and manages their configuration.

When each app is bundled, it looks for a configuration file in its local `env` directory matching the target environment. For example [`apps/ehr/env/.env.staging`](/apps/ehr/env/.env.staging). The deploy process creates that file using the values passed to the `ottehr_apps` module and the template file for the app, for example [`apps/intake/env/.env.template-iac`](/apps/intake/env/.env.template-iac).

After initial apply, if there are no changes to the app or its configuration, it will not be rebundled.

### Apps Upload

The `apps_upload` module uploads each app's `build` to the remote cloud storage bucket used to host the application. By default (`no-cloud`), no upload is performed since no resources were created as part of the `infra` module.

The `aws` submodule will upload the contents of each app's `build` directory to S3 and create a new invalidation for the CloudFront distribution.

The `gcp` submodule will upload the contents of each app's `build` directory.

## Migration to IaC

If you are migrating an environment to IaC, you will need to follow a couple steps:

### Oystehr Resources

1. Set up your environment as discussed above.
1. Run `ENV=${env} npm run generate` with your environment to create Terraform configuration
1. Use `scripts/config/generate-oystehr-resource-imports.ts` to create resource import commands corresponding to your Terraform configuration
1. Run the imports and check the plan produced by `terraform plan -no-color -parallelism=20 -var-file="${ENV}.tfvars" 2>&1 | tee out.log` for further resources to import
1. Delete ephemeral and canonical resources by running the following scripts:
   - packages/zambdas/src/scripts/remove-insurances-and-payer-orgs.ts
   - packages/zambdas/src/scripts/delete-value-sets.ts
   - packages/zambdas/src/scripts/recreate-global-templates.ts
   - packages/zambdas/src/scripts/delete-in-house-medications-list.ts
   - packages/zambdas/src/scripts/retire-in-house-lab-activity-definitions.ts
   - packages/zambdas/src/scripts/recreate-vaccines-list.ts
   - packages/zambdas/src/scripts/delete-subscriptions.ts

### AWS or GCP Resources

Create manual import commands for `infra` module resources, or create [an import file](https://developer.hashicorp.com/terraform/language/import#define-an-import-block). For example AWS imports might look like:

```bash
terraform import -var-file="staging.tfvars" 'module.infra[0].aws_s3_bucket.ehr_bucket' some-ehr-bucket
terraform import -var-file="staging.tfvars" 'module.infra[0].aws_cloudfront_distribution.ehr_cf' EHREXAMPLE
terraform import -var-file="staging.tfvars" 'module.infra[0].aws_s3_bucket.patient_portal_bucket' some-patient-portal-bucket
terraform import -var-file="staging.tfvars" 'module.infra[0].aws_cloudfront_distribution.patient_portal_cf' PPEXAMPLE
```

Then include either `aws_profile` or `gcp_project` in your `tfvars` file as discussed [above](#terraform-variables).
