# Who is the current AWS account?
data "aws_caller_identity" "current" {}

########################################
# Execution role for the AUTH lambda
########################################
resource "aws_iam_role" "auth_lambda_role" {
  name = "${var.auth_lambda_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.auth_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "auth_inline" {
  name = "${var.auth_lambda_name}-inline"
  role = aws_iam_role.auth_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement : [
      {
        "Effect" : "Allow",
        "Action" : ["s3:HeadObject", "s3:GetObject", "s3:PutObject"],
        "Resource" : "arn:aws:s3:::${aws_s3_bucket.uploads.bucket}/uploads/*"
      },
      {
        "Effect" : "Allow",
        "Action" : ["lambda:InvokeFunction"],
        "Resource" : "${aws_lambda_function.processor.arn}"
      }
    ]
  })
}

########################################
# Processor Lambda IAM (Python container)
########################################
resource "aws_iam_role" "processor_role" {
  name = "${var.processor_lambda_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "processor_logs" {
  role       = aws_iam_role.processor_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "processor_inline" {
  name = "${var.processor_lambda_name}-inline"
  role = aws_iam_role.processor_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement : [
      {
        "Effect" : "Allow",
        "Action" : ["s3:GetObject", "s3:HeadObject"],
        "Resource" : "arn:aws:s3:::${aws_s3_bucket.uploads.bucket}/uploads/*"
      },
      {
        "Effect" : "Allow",
        "Action" : ["s3:PutObject"],
        "Resource" : "arn:aws:s3:::${aws_s3_bucket.outputs.bucket}/*"
      }
      # Optional delete inputs:
      # ,{
      #   "Effect": "Allow",
      #   "Action": ["s3:DeleteObject"],
      #   "Resource": "arn:aws:s3:::${aws_s3_bucket.uploads.bucket}/uploads/*"
      # }
    ]
  })
}

########################################
# Presigner IAM user (backend) – keep this
########################################
data "aws_iam_user" "uploader" {
  user_name = "user_video_s3_uploader"
}

resource "aws_iam_policy" "uploader_put_policy" {
  name        = "uploader-put-${var.bucket_name}"
  description = "Allow presigner to put objects into ${var.bucket_name}/uploads/"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        "Sid" : "AllowUploadToUploadsPrefix",
        "Effect" : "Allow",
        "Action" : ["s3:PutObject"],
        "Resource" : "arn:aws:s3:::${var.bucket_name}/uploads/*"
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "attach_uploader_put" {
  user       = data.aws_iam_user.uploader.user_name
  policy_arn = aws_iam_policy.uploader_put_policy.arn
}