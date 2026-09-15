resource "aws_dynamodb_table" "batches" {
  name         = var.dynamodb_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "batchId"
  attribute {
    name = "batchId"
    type = "S"
  }
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  tags = {
    Project = "CloudVision"
  }
}