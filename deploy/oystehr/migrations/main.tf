# One-time data migrations: each trigger is constant, so a migration runs once per environment.

resource "terraform_data" "delete_immunization_quick_picks" {
  triggers_replace = "delete-immunization-quick-picks-v1"

  provisioner "local-exec" {
    working_dir = "${path.root}/../packages/zambdas"
    command     = "npm run delete-immunization-quick-picks -- ${var.environment}"
  }
}
