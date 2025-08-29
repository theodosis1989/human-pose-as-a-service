locals {
  video_api_src = "${path.module}/../lambda/video-api"
}

resource "null_resource" "video_api_deps" {
  triggers = {
    lockfile_hash = try(filesha256("${local.video_api_src}/package-lock.json"), "")
    index_hash    = try(filesha256("${local.video_api_src}/index.mjs"), "")
  }
  provisioner "local-exec" {
    working_dir = local.video_api_src
    command     = "npm ci"
  }
}

data "archive_file" "video_api_zip" {
  type        = "zip"
  source_dir  = local.video_api_src
  output_path = "${path.module}/video_api.zip"
  depends_on  = [null_resource.video_api_deps]
}

resource "aws_iam_role" "video_api_role" {
  name = "video-api-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "video_api_logs" {
  role       = aws_iam_role.video_api_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "video_api" {
  function_name = "video-api"
  role          = aws_iam_role.video_api_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.video_api_zip.output_path
  memory_size   = 256
  timeout       = 10

  environment {
    variables = {
      SUPABASE_URL              = var.supabase_url
      SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
      UPLOAD_SIGNING_SECRET     = var.upload_signing_secret
      INPUT_BUCKET              = aws_s3_bucket.uploads.bucket
      CORS_ORIGINS              = join(",", var.allowed_origins)
    }
  }

  depends_on = [aws_iam_role_policy_attachment.video_api_logs]
}