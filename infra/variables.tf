variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "eu-north-1"
}

variable "bucket_name" {
  type        = string
  description = "Name of the S3 bucket for uploads & outputs"
  default     = "human-pose-input-videos"
}

variable "output_bucket_name" {
  type        = string
  description = "S3 bucket where processed results are written"
  default     = "human-pose-output-videos"
}

variable "allowed_origins" {
  type        = list(string)
  description = "Origins allowed by S3 CORS"
  default     = ["http://localhost:8081", "http://127.0.0.1:8081", "http://localhost:19006", "http://127.0.0.1:19006"]
}

variable "auth_lambda_name" {
  type        = string
  description = "Name for the auth/idempotency/quota Lambda"
  default     = "video-processor-auth"
}

variable "lambda_memory_mb" {
  type        = number
  description = "Memory (MB) for the auth Lambda"
  default     = 512
}

variable "lambda_timeout_s" {
  type        = number
  description = "Timeout (s) for the auth Lambda"
  default     = 60
}

variable "processor_lambda_name" {
  type        = string
  description = "Name for the new video processor (Python) Lambda"
  default     = "video-processor-worker"
}

variable "processor_lambda_memory_mb" {
  type        = number
  description = "Memory (MB) for the processor Lambda"
  default     = 2048
}

variable "processor_lambda_timeout_s" {
  type        = number
  description = "Timeout (s) for the processor Lambda"
  default     = 900
}

variable "processor_output_prefix" {
  type        = string
  description = "S3 prefix for processor outputs"
  default     = "processed/"
}

variable "supabase_url" {
  type        = string
  description = "Supabase project URL"
  default     = "https://ymczyihfrhsojhvwiiqx.supabase.co"
}

variable "supabase_service_role_key" {
  type        = string
  description = "Supabase service role key (server-only)"
  sensitive   = true
}

variable "upload_signing_secret" {
  type        = string
  description = "Shared HMAC secret used by backend + auth lambda"
  sensitive   = true
}

variable "enforce_sse" {
  type        = bool
  description = "If true, require SSE-S3 (AES256) on PutObject"
  default     = false
}