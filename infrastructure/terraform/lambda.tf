resource "aws_lambda_function" "processor" {
  function_name = "CloudVisionProcessor"
  role          = aws_iam_role.processor.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.14"
  memory_size   = 512
  timeout       = 30
  architectures = ["x86_64"]
  filename      = "placeholder.zip"
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
  environment {
    variables = {
      INPUT_BUCKET  = aws_s3_bucket.input.id
      OUTPUT_BUCKET = aws_s3_bucket.output.id
      BATCH_TABLE   = aws_dynamodb_table.batches.name
      JPEG_QUALITY  = "85"
      WEBP_QUALITY  = "85"
      MAX_DIMENSION = "1600"
    }
  }
  layers = [
    var.pillow_layer_arn
  ]
}

resource "aws_lambda_function" "upload" {
  function_name = "cloudvision-upload-image"
  role          = aws_iam_role.upload.arn
  handler       = "cloudvision_upload.lambda_handler"
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
      UPLOAD_BUCKET = aws_s3_bucket.input.id
      OUTPUT_BUCKET = aws_s3_bucket.output.id
      BATCH_TABLE   = aws_dynamodb_table.batches.name
    }
  }
  layers = [
    var.pillow_layer_arn
  ]
}