terraform {
    backend "s3" {
    bucket = "YOUR_TF_BUCKET_NAME"
    region = "us-east-1"
    profile = "YOUR_AWS_PROFILE_NAME"
    key = "terraform.tfstate"
  }
  required_providers {
    oystehr = {
      source = "registry.terraform.io/masslight/oystehr"
    }
  }
}

provider "oystehr" {
  project_id    = var.project_id
  client_id     = var.client_id
  client_secret = var.client_secret
}

module "oystehr" {
  source = "./oystehr"
  providers = {
    oystehr = oystehr
  }
}
