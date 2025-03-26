# Deploying Ottehr to AWS

This directory contains an AWS CDK application to deploy Ottehr to AWS and Oystehr, along with supporting scripts.

To deploy Ottehr, follow the instructions [in our docs](https://docs.oystehr.com/ottehr/deploying/aws/).

## Permissions for Deploying

The AWS role used for deploying must have at least the permissions enumerated in `deployer-role.json`. This policy definition can be used as-is to enable an AWS role to deploy Ottehr.
