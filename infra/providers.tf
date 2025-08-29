terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 5.54" }
    archive = { source = "hashicorp/archive", version = "~> 2.6" }
  }
}

provider "aws" {
  region = var.aws_region
}