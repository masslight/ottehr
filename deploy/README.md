# Deploying Ottehr

This directory contains Terraform configuration for deploying Ottehr.

## Requirements

- Install Terraform following [the instructions on HashiCorp's website](https://developer.hashicorp.com/terraform/install).
- Create an Oystehr project in the [Oystehr developer console](https://console.oystehr.com).
- Create an M2M Client with full access rights in your Oystehr project.
- Configure your local Terraform variables as discussed below.
- Configure your Terraform Backend.

## Configuration

There are a few ways of providing configuration to the deploy process.

1. Copy `terraform.tfvars.template` to `terraform.tfvars` and fill it out with your configuration values.
1. Create environment-specific `.tfvars` files and reference them on the command-line: `terraform -var-file='staging.tfvars' apply`
1. Specify configuration values on the command-line: `terraform -var="project_id=123..." -var="client_id=abc..." -var="client_secret=def..."`

## Terraform Backend

Configure your Terraform backend in `deploy/main.tf`. There is a placeholder configuration for [using AWS S3 as a Terraform backend](https://developer.hashicorp.com/terraform/language/backend/s3).

## Scripts

The Oystehr module contents are generated from the `ottehr-spec.json` files and a var file. You should generate these configs before running terraform.

```shell
# Generate using default var file `local.json`
npm run generate

# Override to use staging.json
ENV=staging npm run generate
```

## Modules

### Oystehr

The Oystehr module creates resources in Oystehr. It's contents are generated from the `ottehr-spec.json` files. Only Oystehr resources should be defined here.

### AWS

TODO

### GCP

TODO
