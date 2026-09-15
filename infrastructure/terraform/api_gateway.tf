resource "aws_apigatewayv2_api" "upload" {
  name          = "cloudvision_upload_api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false

    allow_headers = [
      "content-type"
    ]

    allow_methods = [
      "POST",
      "OPTIONS"
    ]

    allow_origins = [
      "http://127.0.0.1:5500",
      "https://${var.cloudfront_domain}"
    ]

    max_age = 0
  }
}

resource "aws_apigatewayv2_integration" "upload" {
  api_id                 = aws_apigatewayv2_api.upload.id
  integration_type       = "AWS_PROXY"
  integration_uri        = "arn:aws:lambda:ap-south-1:056641105958:function:cloudvision-upload-image"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "upload" {
  api_id    = aws_apigatewayv2_api.upload.id
  route_key = "POST /upload"
  target    = "integrations/${aws_apigatewayv2_integration.upload.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.upload.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway_upload" {
  statement_id  = "e42abde1-fd93-5bf4-a102-ae64a8e19b8e"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.upload.execution_arn}/*/*/upload"
}