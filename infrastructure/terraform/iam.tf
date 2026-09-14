resource "aws_iam_role" "processor" {
  name        = "CloudVision-Lambda-Role"
  description = "Creating an Lambda Function for CloudVision-Admin IAM user"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role" "upload" {
  name = "cloudvision-upload-image-role-ijoxfs7t"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Lambda basic execution roles
resource "aws_iam_role_policy_attachment" "processor_basic" {
  role       = aws_iam_role.processor.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "upload_basic" {
  role       = aws_iam_role.upload.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Processor Lambda - CloudWatch metrics
resource "aws_iam_role_policy" "processor_cloudwatch" {
  name = "CloudVision-CloudWatch-Metrics"
  role = aws_iam_role.processor.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "cloudwatch:PutMetricData"
        Resource = "*"
      }
    ]
  })
}

# Processor Lambda - S3 permissions
resource "aws_iam_role_policy" "processor_s3" {
  name = "CloudVisionS3ProcessingPolicy"
  role = aws_iam_role.processor.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "arn:aws:s3:::cloudvision-input-hk2005/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "arn:aws:s3:::cloudvision-output-hk2005/*"
      }
    ]
  })
}

# Processor Lambda - DynamoDB permissions
resource "aws_iam_role_policy" "processor_dynamodb" {
  name = "CloudVisionBatchTrackingPolicy"
  role = aws_iam_role.processor.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.batches.arn
      }
    ]
  })
}

# Upload Lambda - S3 permissions
resource "aws_iam_role_policy" "upload_s3" {
  name = "CloudVisionUploadPolicy"
  role = aws_iam_role.upload.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "arn:aws:s3:::cloudvision-input-hk2005/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "arn:aws:s3:::cloudvision-output-hk2005/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::cloudvision-output-hk2005"
      }
    ]
  })
}

# Upload Lambda - DynamoDB permissions
resource "aws_iam_role_policy" "upload_dynamodb" {
  name = "CloudVisionBatchTrackingPolicy"
  role = aws_iam_role.upload.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.batches.arn
      }
    ]
  })
}

# GitHub Actions - OIDC provider
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1"
  ]
}

# GitHub Actions - IAM role
resource "aws_iam_role" "github_actions" {
  name = "CloudVision-GitHubActions-Role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:hemanth3007/CloudVision:ref:refs/heads/main"
          }
        }
      }
    ]
  })
}

# GitHub Actions - Frontend deployment permissions
resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "CloudVision-GitHubActions-Deploy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::cloudvision-frontend-hk2005"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::cloudvision-frontend-hk2005/*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation"
        ]
        Resource = "arn:aws:cloudfront::056641105958:distribution/E136IR91GKFPST"
      }
    ]
  })
}