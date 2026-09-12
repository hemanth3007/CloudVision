import io
import sys
import importlib.util
from pathlib import Path
from unittest.mock import MagicMock
from PIL import Image

# Find Processor Lambda
backend = Path(__file__).resolve().parents[1]
lambda_file = next(
    p for p in backend.rglob("cloudvision_processor.py")
    if "processor" in str(p).lower()
)

# Mock AWS
boto3 = MagicMock()
sys.modules["boto3"] = boto3

# Import actual Lambda
spec = importlib.util.spec_from_file_location("processor", lambda_file)
processor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(processor)

def image(size=(800, 600), fmt="JPEG"):
    data = io.BytesIO()
    Image.new("RGB", size, "red").save(data, fmt)
    data.seek(0)
    return data

def test_open_image():
    img = Image.open(image())
    assert img.format == "JPEG"

def test_large_image():
    img = Image.open(image((3000, 2000)))
    assert max(img.size) > processor.MAX_DIMENSION

def test_resize():
    img = Image.open(image((3000, 2000)))
    img.thumbnail((processor.MAX_DIMENSION, processor.MAX_DIMENSION))
    assert max(img.size) <= processor.MAX_DIMENSION

def test_jpeg():
    img = Image.open(image())
    out = io.BytesIO()
    img.save(out, "JPEG", quality=processor.JPEG_QUALITY)
    assert len(out.getvalue()) > 0

def test_webp():
    img = Image.open(image())
    out = io.BytesIO()
    img.save(out, "WEBP", quality=processor.WEBP_QUALITY)
    assert len(out.getvalue()) > 0

def test_transparent_image():
    data = io.BytesIO()
    img = Image.new("RGBA", (500, 500), (255, 0, 0, 0))
    img.save(data, "PNG")
    data.seek(0)
    result = Image.open(data)
    assert result.mode == "RGBA"

def test_lambda_handler():
    processor.s3 = MagicMock()
    data = image((800, 600))
    processor.s3.get_object.return_value = {
        "Body": MagicMock(read=lambda: data.getvalue())
    }
    context = MagicMock()
    context.aws_request_id = "test-request-123"
    event = {
        "Records": [{
            "s3": {
                "bucket": {
                    "name": processor.INPUT_BUCKET
                },
                "object": {
                    "key": "test.jpg"
                }
            }
        }]
    }
    result = processor.lambda_handler(event, context)
    assert result["statusCode"] == 200
    processor.s3.get_object.assert_called_once()
    processor.s3.put_object.assert_called_once()