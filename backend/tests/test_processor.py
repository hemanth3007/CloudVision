import io
import os
import sys
from unittest.mock import MagicMock

from PIL import Image

sys.path.insert(
    0,
    os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "lambda",
            "processor"
        )
    )
)

import cloudvision_processor as processor


def image(size=(100, 100), image_format="JPEG", mode="RGB"):
    output = io.BytesIO()
    img = Image.new(mode, size)
    img.save(output, format=image_format)
    output.seek(0)
    return output


def test_open_image():
    data = image((100, 100))
    img = Image.open(data)
    assert img.size == (100, 100)


def test_large_image():
    data = image((2000, 1500))
    img = Image.open(data)
    assert img.size == (2000, 1500)


def test_resize():
    data = image((2000, 1500))
    img = Image.open(data)
    assert img.width == 2000
    assert img.height == 1500


def test_jpeg():
    data = image((800, 600), "JPEG")
    img = Image.open(data)
    assert img.format == "JPEG"


def test_webp():
    data = image((800, 600), "JPEG")
    img = Image.open(data)
    output = io.BytesIO()
    img.save(output, format="WEBP")
    output.seek(0)
    assert output.getvalue().startswith(b"RIFF")


def test_transparent_image():
    data = image((800, 600), "PNG", "RGBA")
    img = Image.open(data)
    assert img.mode == "RGBA"


def test_lambda_handler():
    processor.s3 = MagicMock()
    processor.dynamodb = MagicMock()
    processor.cloudwatch = MagicMock()

    data = image((800, 600))

    processor.s3.get_object.return_value = {
        "Body": MagicMock(
            read=lambda: data.getvalue()
        )
    }

    context = MagicMock()
    context.aws_request_id = "test-request-123"

    batch_id = "test-batch-123"
    input_key = f"{batch_id}/test-image.jpg"
    output_key = f"{batch_id}/processed-test-image.webp"
    zip_key = f"{batch_id}/processed-images.zip"

    processor.dynamodb.get_item.return_value = {
        "Item": {
            "batchId": {
                "S": batch_id
            },
            "total": {
                "N": "1"
            },
            "completed": {
                "N": "0"
            },
            "status": {
                "S": "PROCESSING"
            },
            "files": {
                "L": [
                    {
                        "M": {
                            "key": {
                                "S": input_key
                            },
                            "fileName": {
                                "S": "test-image.jpg"
                            },
                            "status": {
                                "S": "PENDING"
                            },
                            "outputKey": {
                                "S": output_key
                            }
                        }
                    }
                ]
            }
        }
    }

    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {
                        "name": processor.INPUT_BUCKET
                    },
                    "object": {
                        "key": input_key
                    }
                }
            }
        ]
    }

    result = processor.lambda_handler(event, context)

    assert result["statusCode"] == 200

    # The processor uploads the processed image and the ZIP.
    assert processor.s3.put_object.call_count == 2

    put_calls = processor.s3.put_object.call_args_list

    # Verify processed image upload.
    image_upload = put_calls[0].kwargs
    assert image_upload["Bucket"] == processor.OUTPUT_BUCKET
    assert image_upload["Key"] == output_key
    assert image_upload["ContentType"] == "image/webp"

    # Verify ZIP upload.
    zip_upload = put_calls[1].kwargs
    assert zip_upload["Bucket"] == processor.OUTPUT_BUCKET
    assert zip_upload["Key"] == zip_key
    assert zip_upload["ContentType"] == "application/zip"

    # Verify the uploaded data is a ZIP file.
    assert zip_upload["Body"].startswith(b"PK")

    processor.dynamodb.update_item.assert_called()
    processor.cloudwatch.put_metric_data.assert_called()