########################################
# AUTH Lambda (zip deployment)
########################################

# Package auth lambda (Node)
locals {
  auth_src = "${path.module}/../lambda/video-processor-auth"
}

# Install deps before zipping auth
resource "null_resource" "auth_lambda_deps" {
  triggers = {
    lockfile_hash = try(filesha256("${local.auth_src}/package-lock.json"), "")
    index_hash    = try(filesha256("${local.auth_src}/index.mjs"), "")
  }
  provisioner "local-exec" {
    working_dir = local.auth_src
    command     = "npm ci"
  }
}

data "archive_file" "auth_zip" {
  type        = "zip"
  source_dir  = local.auth_src
  output_path = "${path.module}/auth_lambda.zip"

  depends_on = [null_resource.auth_lambda_deps]
}

resource "aws_lambda_function" "auth_lambda" {
  function_name = var.auth_lambda_name
  role          = aws_iam_role.auth_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.auth_zip.output_path
  memory_size   = var.lambda_memory_mb
  timeout       = var.lambda_timeout_s

  environment {
    variables = {
      S3_BUCKET                 = aws_s3_bucket.uploads.bucket
      SUPABASE_URL              = var.supabase_url
      SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
      UPLOAD_SIGNING_SECRET     = var.upload_signing_secret
      PROCESSOR_ARN             = aws_lambda_function.processor.arn
    }
  }

  depends_on = [
    aws_iam_role_policy.auth_inline,
    aws_iam_role_policy_attachment.logs
  ]
}

# Allow S3 to invoke AUTH lambda
resource "aws_lambda_permission" "allow_s3_invoke" {
  statement_id  = "AllowExecutionFromS3"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_lambda.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.uploads.arn
}

########################################
# PROCESSOR Lambda (Python container image)
########################################

# ECR repo for processor
resource "aws_ecr_repository" "processor_repo" {
  name                 = var.processor_lambda_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Helpful output (also in outputs.tf, optional duplication)
output "processor_ecr_repository_url" {
  value = aws_ecr_repository.processor_repo.repository_url
}

# Processor lambda (container-based)
resource "aws_lambda_function" "processor" {
  function_name = var.processor_lambda_name
  role          = aws_iam_role.processor_role.arn
  package_type  = "Image"

  # Lambda will pull the :latest tag from ECR
  image_uri = "${aws_ecr_repository.processor_repo.repository_url}:latest"

  memory_size = var.processor_lambda_memory_mb
  timeout     = var.processor_lambda_timeout_s

  environment {
    variables = {
      BUCKET        = aws_s3_bucket.uploads.bucket # input bucket
      INPUT_PREFIX  = "uploads/"
      OUTPUT_BUCKET = aws_s3_bucket.outputs.bucket # <— add this
      OUTPUT_PREFIX = var.processor_output_prefix  # optional; can be ""
    }
  }

  depends_on = [
    aws_iam_role_policy.processor_inline,
    aws_iam_role_policy_attachment.processor_logs
  ]
}