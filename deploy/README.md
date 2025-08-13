# Deploying Ottehr

This directory contains Terraform configuration for deploying Ottehr.

## Modules

### Ottehr

The Ottehr module consumes the Ottehr spec file and creates corresponding resources in Oystehr.

### AWS

TODO

### GCP

TODO

## Configuration

There are a few ways of providing configuration to the deploy process.

1. Copy `terraform.tfvars.template` to `terraform.tfvars` and fill it out with your configuration values.
1. Create environment-specific `.tfvars` files and reference them on the command-line: `terraform -var-file='staging.tfvars' apply`
1. Specify configuration values on the command-line: `terraform -var="project_id=123..." -var="client_id=abc..." -var="client_secret=def..."`
