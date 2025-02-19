locals {
    configuration = jsondecode(file("../deploy-config.json"))
}

provider "google" {
    project = local.configuration.google_project
}


module "intake_directory" {
    source = "hashicorp/dir/template"
    base_dir = "../../../apps/intake/build"
}

module "ehr_directory" {
    source = "hashicorp/dir/template"
    base_dir = "../../../apps/ehr/build"
}

resource "google_storage_bucket" "intake_static_website" {
    name = local.configuration.intake_domain
    location = "US"
    # storage_class = "standard"
    uniform_bucket_level_access = true

    website {
        main_page_suffix = "index.html"
        not_found_page = "index.html"
    }
}

resource "google_storage_bucket" "ehr_static_website" {
    name = local.configuration.ehr_domain
    location = "US"
    # storage_class = "standard"
    uniform_bucket_level_access = true

    website {
        main_page_suffix = "index.html"
        not_found_page = "index.html"
    }
}

resource "google_storage_bucket_object" "intake_static_website_upload" {
    for_each = module.intake_directory.files
    name = each.key
    content_type = each.value.content_type
    source = each.value.source_path
    bucket = google_storage_bucket.intake_static_website.id
}

resource "google_storage_bucket_object" "ehr_static_website_upload" {
    for_each = module.ehr_directory.files
    name = each.key
    content_type = each.value.content_type
    source = each.value.source_path
    bucket = google_storage_bucket.ehr_static_website.id
}

resource "google_storage_bucket_iam_member" "intake_website_public_rule" {
    bucket = google_storage_bucket.intake_static_website.id
    role = "roles/storage.objectViewer"
    member="allUsers"
}

resource "google_storage_bucket_iam_member" "ehr_website_public_rule" {
    bucket = google_storage_bucket.ehr_static_website.id
    role = "roles/storage.objectViewer"
    member="allUsers"
}
