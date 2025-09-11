# Sendgrid Terraform Module

Terraform module that parses the file written to config/sendgrid/sendgrid.json and uses it to provision the templates/template versions defined there in Sendgrid (as well as API key for sending emails using those templates) and then outputs the ids of the created resources so they can be ingested in the Oystehr module and written to secrets. 

The parsed file is written based on the default configuration and overrides defined in the utils package and is regenerated from that source each time the generate script in the deploy package is run. 
