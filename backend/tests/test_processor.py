import io
import importlib.util
from pathlib import Path
from unittest.mock import MagicMock

from PIL import Image

PROCESSOR_PATH = (
    Path(__file__).resolve().parents[1]
    / "lambda"
    / "processor"
    / "cloudvision_processor.py"
)

spec = importlib.util.spec_from_file_location(
    "cloudvision_processor",
    PROCESSOR_PATH
)
processor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(processor)

def image(size=(800, 600), mode="RGB", format="JPEG"):
    img = Image.new(mode, size)

    if mode == "RGBA":
        img.putalpha(255)

    buffer = io.BytesIO()
    img.save(buffer, format=format)
    buffer.seek(0)

    return buffer

def test_open_image():
    data = image()

    img = Image.open(data)

    assert img.size == (800, 600)

def test_large_image():
    data = image((3000, 2000))

    img = Image.open(data)

    assert img.size == (3000, 2000)

def test_resize():
    data = image((3000, 2000))

    img = Image.open(data)
    resized = img.resize((1600, 1066))

    assert resized.size == (1600, 1066)

def test_jpeg():
    data = image(format="JPEG")

    img = Image.open(data)

    assert img.format == "JPEG"

def test_webp():
    data = image(format="WEBP")

    img = Image.open(data)

    assert img.format == "WEBP"

def test_transparent_image():
    data = image(
        mode="RGBA",
        format="PNG"
    )

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
                            }
                        }
                    }
                ]
            }
        }
    }

    event = {
        "Records": [{
            "s3": {
                "bucket": {
                    "name": processor.INPUT_BUCKET
                },
                "object": {
                    "key": input_key
                }
            }
        }]
    }

    result = processor.lambda_handler(event, context)

    assert result["statusCode"] == 200

    processor.s3.put_object.assert_called_once()
    processor.dynamodb.get_item.assert_called_once()
    processor.dynamodb.update_item.assert_called_once()
    processor.cloudwatch.put_metric_data.assert_called_once()