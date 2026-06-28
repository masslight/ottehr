output "billing_hash" {
  value = one(terraform_data.build_billing[*].id)
}
