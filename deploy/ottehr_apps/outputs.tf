output "ehr_hash" {
  value = one(terraform_data.build_ehr[*].id)
}

output "patient_portal_hash" {
  value = one(terraform_data.build_patient_portal[*].id)
}
