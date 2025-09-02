output "template_specs" {
  description = "The specs for the templates to be created."
  value = tomap(lookup(jsondecode(file(var.sendgrid_templates_file_path)), "templates", {}))
}
output "project_name" {
  description = "The project name from the template spec."
  value = lookup(jsondecode(file(var.sendgrid_templates_file_path)), "projectName", null)
}