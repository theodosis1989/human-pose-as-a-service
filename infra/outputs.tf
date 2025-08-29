output "auth_lambda_arn" {
  value = aws_lambda_function.auth_lambda.arn
}

output "processor_lambda_arn" {
  value = aws_lambda_function.processor.arn
}

output "bucket_name" {
  value = aws_s3_bucket.uploads.bucket
}