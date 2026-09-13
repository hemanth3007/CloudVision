resource "aws_lambda_function" "processor" {
  function_name = "CloudVisionProcessor"
  role          = "arn:aws:iam::056641105958:role/CloudVision-Lambda-Role"
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.14"
  memory_size   = 512
  timeout       = 30
  architectures = ["x86_64"]
  filename      = "placeholder.zip"

  # Terraform should not replace the currently deployed
  # Lambda code when we are importing the existing function.
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
  environment {
    variables = {
      OUTPUT_BUCKET = "cloudvision-output-hk2005"
      JPEG_QUALITY  = "85"
      WEBP_QUALITY  = "85"
      MAX_DIMENSION = "1600"
    }
  }

  layers = [
    "arn:aws:lambda:ap-south-1:056641105958:layer:cloudvision-pillow-v2:1"
  ]
}

resource "aws_lambda_function" "upload" {
  function_name = "cloudvision-upload-image"
  role          = "arn:aws:iam::056641105958:role/cloudvision-upload-image-role-ijoxfs7t"
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.14"
  memory_size   = 128
  timeout       = 3
  architectures = ["x86_64"]
  filename      = "placeholder.zip"
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
  environment {
    variables = {
      UPLOAD_BUCKET = "cloudvision-input-hk2005"
    }
  }
  layers = [
    "arn:aws:lambda:ap-south-1:056641105958:layer:cloudvision-pillow-v2:1"
  ]
}