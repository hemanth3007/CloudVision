resource "aws_dynamodb_table" "batches" {
  name         = "CloudVisionBatches"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "batchId"
  attribute {
    name = "batchId"
    type = "S"
  }
  tags = {
    Project = "CloudVision"
  }
}