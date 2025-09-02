run "setup_tests" {
    module {
        source = "./tests/setup"
    }
}

run "check_api_key" {
  command = plan
  variables {
    project_name = "${run.setup_tests.project_name}"
  }

  assert {
    condition = module.sendgrid.sendgrid_api_key.name == "${var.project_name}"
    error_message = "Invalid name for sendgrid api key."
  }
}

run "check_templates" {
  command = apply
  variables {
    template_specs = "${run.setup_tests.template_specs}"
    secret_keys = [for spec in run.setup_tests.template_specs : spec.templateIdSecretName]
  }
  assert {
    condition = length(keys(module.sendgrid.template_ids)) == length(keys(var.template_specs))
    error_message = "Number of created templates does not match number of templates in spec."
  }

  assert {
    condition = alltrue([
      for k, v in module.sendgrid.template_ids :
        contains(var.secret_keys, k) && can(regex("^d-[0-9a-fA-F]{32}$", v))
    ])
    error_message = "One or more templates were invalid."
  }
}
