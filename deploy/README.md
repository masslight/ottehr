# Deploying Ottehr

This directory contains Terraform configuration for deploying Ottehr.

## Requirements

### Terraform

This project currently requires the 1.12 version of Terraform. You can download this directly from HashiCorp's releases page and install it into your path. For example to install on an ARM Mac:

```bash
brew install wget # or use cURL
wget https://releases.hashicorp.com/terraform/1.12.2/terraform_1.12.2_darwin_arm64.zip
unzip terraform_1.12.2_darwin_arm64.zip -d /tmp
sudo cp /tmp/terraform /usr/local/bin/terraform
```

You can open the [1.12 releases page](https://releases.hashicorp.com/terraform/1.12.2/) if you aren't sure which version to install.

- Terraform installed following [the instructions on HashiCorp's website](https://developer.hashicorp.com/terraform/install).

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

## First-time Setup

### Requirements

- Install Terraform following [the instructions on HashiCorp's website](https://developer.hashicorp.com/terraform/install).
- Create an Oystehr project in the [Oystehr developer console](https://console.oystehr.com).
- Create an M2M Client with full access rights in your Oystehr project.
- Configure your local Terraform variables as discussed below.
- Configure your Terraform Backend.
- Run `npm run terraform-setup` to configure remote state and workspaces.

### Configuration

There are a few ways of providing configuration to the deploy process.

1. Copy `terraform.tfvars.template` to `terraform.tfvars` and fill it out with your configuration values.
1. Create environment-specific `.tfvars` files and reference them on the command-line: `terraform apply -var-file='staging.tfvars'`
1. Specify configuration values on the command-line: `terraform -var="project_id=123..." -var="client_id=abc..." -var="client_secret=def..."`

### Terraform Backend

Configure your Terraform backend in `deploy/backend.config` using [partial configuration](https://developer.hashicorp.com/terraform/language/backend#partial-configuration). There is a placeholder configuration for [using AWS S3 as a Terraform backend](https://developer.hashicorp.com/terraform/language/backend/s3) and a template in `deploy/backend.config.template`.

## Modules

### Oystehr

The Oystehr module creates resources in Oystehr. It's contents are generated from the `config/oystehr/*.json` configuration files. Only Oystehr resources should be defined here.

### AWS

Enable AWS as a deployment target by including an `aws_profile` value in `deploy/${env}.tfvars`. You must have a valid key pair and region configured in your local AWS config.

The `aws_infra` module will create the following resources:

- An S3 bucket for the EHR and Patient Portal apps, configured as a website for static hosting
- A CloudFront distribution for each app using its bucket as an origin

The `aws_apps` module will upload the contents of each app's `build` directory and create a new invalidation for the CloudFront distribution.

You may optionally provide `ehr_domain` and `patient_portal_domain` values to configure those as aliases on their respective CloudFront distributions.

### GCP

Enable GCP as a deployment target by including a `gcp_project` value in `deploy/${env}.tfvars`. You must have previously authenticated with Google Cloud Platform using their command-line utility.

The `ehr_domain` and `patient_portal_domain` values are required for GCP deploys. You will need to manually confirm these as owned domains or subdomains in Google's Search configuration.

The `gcp_infra` module will create a Google Cloud Storage bucket for the EHR and Patient Portal apps, configured as a website for static hosting.

The `gcp_apps` module will upload the contents of each app's `build` directory.