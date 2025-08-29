resource "aws_s3_bucket" "uploads" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_cors_configuration" "this" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = var.allowed_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag", "x-amz-version-id"]
    max_age_seconds = 3000
  }
}

# Output bucket for processed files
resource "aws_s3_bucket" "outputs" {
  bucket = var.output_bucket_name
}

# Optional CORS if you plan to download directly to browser/app later
resource "aws_s3_bucket_cors_configuration" "outputs_cors" {
  bucket = aws_s3_bucket.outputs.id

  cors_rule {
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.allowed_origins
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

# S3 -> AUTH lambda only
resource "aws_s3_bucket_notification" "uploads_trigger" {
  bucket = aws_s3_bucket.uploads.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.auth_lambda.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
  }

  depends_on = [aws_lambda_permission.allow_s3_invoke]
}