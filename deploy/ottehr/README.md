# Ottehr Terraform Module

Terraform module that parses JSON spec and creates Oystehr resources based on its contents.

## Schema Versions

The Ottehr spec file requires a `schema-version` attribute at the top-level of the JSON or YAML document. This is used to load a specific sub-module corresponding to the version.