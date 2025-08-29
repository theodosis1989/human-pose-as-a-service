data "aws_iam_policy_document" "bucket_policy" {
  # Deny any non-HTTPS access
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    resources = [
      "arn:aws:s3:::${aws_s3_bucket.uploads.bucket}",
      "arn:aws:s3:::${aws_s3_bucket.uploads.bucket}/*"
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  # (Optional) Require SSE-S3 (AES256) on PutObject
  dynamic "statement" {
    for_each = var.enforce_sse ? [1] : []
    content {
      sid     = "RequireSSE"
      effect  = "Deny"
      actions = ["s3:PutObject"]

      principals {
        type        = "AWS"
        identifiers = ["*"]
      }

      resources = [
        "arn:aws:s3:::${aws_s3_bucket.uploads.bucket}/*"
      ]

      condition {
        test     = "StringNotEquals"
        variable = "s3:x-amz-server-side-encryption"
        values   = ["AES256"]
      }
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.uploads.id
  policy = data.aws_iam_policy_document.bucket_policy.json
}

# ----- Output bucket policy -----
data "aws_iam_policy_document" "output_bucket_policy" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    resources = [
      "arn:aws:s3:::${aws_s3_bucket.outputs.bucket}",
      "arn:aws:s3:::${aws_s3_bucket.outputs.bucket}/*"
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  dynamic "statement" {
    for_each = var.enforce_sse ? [1] : []
    content {
      sid     = "RequireSSE"
      effect  = "Deny"
      actions = ["s3:PutObject"]

      principals {
        type        = "AWS"
        identifiers = ["*"]
      }

      resources = ["arn:aws:s3:::${aws_s3_bucket.outputs.bucket}/*"]

      condition {
        test     = "StringNotEquals"
        variable = "s3:x-amz-server-side-encryption"
        values   = ["AES256"]
      }
    }
  }
}

resource "aws_s3_bucket_policy" "outputs" {
  bucket = aws_s3_bucket.outputs.id
  policy = data.aws_iam_policy_document.output_bucket_policy.json
}