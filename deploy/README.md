# Deploying Ottehr

This directory contains scripts and Terraform configuration for deploying Ottehr.

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
- `packages/zambda/.env/${env}.json` for the environment you wish to deploy to

## Scripts

There are npm scripts for deploying to local, staging, and production, as well as generating config, initializing the local environment, and creating workspaces.

- `npm run terraform-init` &mdash; configures the local Terraform environment, using the backend configuration specified in `deploy/main.tf` and `deploy/backend.config`
- `ENV=${env} npm run generate` &mdash; generates Terraform config from the Ottehr spec file and the variable JSON file at `packages/zambda/.env/${env}.json`
- `npm run apply-${env}` &mdash; generates Terraform config and deploys using `main.tf` and the `deploy/${env}.tfvars` file; the state is stored in the Terraform workspace corresponding to the environment
- `npm run terraform-setup` &mdash; one-time configuration to set up Terraform workspaces for all environments

## Setting up a New Project

### Requirements

- Install Terraform [as discussed above](#terraform)
- Create an Oystehr project in the [Oystehr developer console](https://console.oystehr.com).
- Create an M2M Client with full access rights in your Oystehr project; you can use the default M2M created during project setup.
- Configure your local Terraform variables (`.tfvars`).
- Configure your Terraform Backend.

Run only once for all environments:

- Run `npm run terraform-setup` to configure remote state and workspaces.

If you need to set up a new environment that wasn't previously set up by that npm script, such as adding a `uat` environment, add a new workspace using the terraform CLI:

```bash
terraform workspace new uat
```

### Terraform Variables

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

### Terraform Backend

Configure your [Terraform backend](https://developer.hashicorp.com/terraform/language/backend) in `deploy/backend.config`. There is a placeholder [partial configuration](https://developer.hashicorp.com/terraform/language/backend#partial-configuration) for [using AWS S3 as a Terraform backend](https://developer.hashicorp.com/terraform/language/backend/s3) and a template in `deploy/backend.config.template`.

Using S3 as a backend allows you to share state between developers and between a developer computer and your CI/CD process. If you only need to store state on a single computer and it doesn't need to be shared, you can replace the backend configuration with a [local one](https://developer.hashicorp.com/terraform/language/backend/local).

## Modules

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
