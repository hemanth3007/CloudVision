# Input S3 bucket
resource "aws_s3_bucket" "input" {
  bucket = "cloudvision-input-hk2005"
}

# CORS configuration for browser uploads to the input bucket
resource "aws_s3_bucket_cors_configuration" "input" {
  bucket = aws_s3_bucket.input.id
  cors_rule {
    allowed_origins = [
      "http://127.0.0.1:5500",
      "https://d28272gnmhhti1.cloudfront.net"
    ]
    allowed_methods = [
      "PUT",
      "GET",
      "HEAD"
    ]
    allowed_headers = [
      "*"
    ]
    expose_headers = [
      "ETag"
    ]
    max_age_seconds = 3000
  }
}

# Output S3 bucket
resource "aws_s3_bucket" "output" {
  bucket = "cloudvision-output-hk2005"
}

# Server-side encryption for input bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "input" {
  bucket = aws_s3_bucket.input.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Server-side encryption for output bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "output" {
  bucket = aws_s3_bucket.output.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access to input bucket
resource "aws_s3_bucket_public_access_block" "input" {
  bucket                  = aws_s3_bucket.input.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# Block all public access to output bucket
resource "aws_s3_bucket_public_access_block" "output" {
  bucket                  = aws_s3_bucket.output.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

# Delete original uploaded images after 2 days
resource "aws_s3_bucket_lifecycle_configuration" "input" {
  bucket = aws_s3_bucket.input.id
  rule {
    id     = "delete-original-images-after-2-days"
    status = "Enabled"
    expiration {
      days = 2
    }
  }
}

# Delete processed images after 20 days
resource "aws_s3_bucket_lifecycle_configuration" "output" {
  bucket = aws_s3_bucket.output.id
  rule {
    id     = "delete-processed-images-after-20-days"
    status = "Enabled"
    expiration {
      days = 20
    }
  }
}