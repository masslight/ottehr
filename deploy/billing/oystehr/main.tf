# Billing-stack Oystehr resources are generated into this directory as *.tf.json files
# by `npm run generate-billing` from the spec files in config/ (resources tagged with
# `"stack": "billing"`).
terraform {
  required_providers {
    oystehr = {
      source  = "registry.terraform.io/masslight/oystehr"
      version = "0.0.21"
    }
  }
}
