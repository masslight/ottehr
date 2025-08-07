# Sendgrid Terraform Module

Terraform module that parses the file written to packages/utils/.ottehr_config/iac-inputs/sendgrid.json and uses it to provision the templates/template versions defined there in Sendgrid, and then saves the template ids of the created templates to Oystehr secrets.

The parsed file is written based on the default configuration and overrides defined in the utils package and must be updated by running the write-infra-spec script in the utils folder. 

TODO: that script should be automatically run as part of the deploy pipeline