import io
import os
import time
import logging
import boto3

from PIL import Image, ImageOps, UnidentifiedImageError

# Configuration
INPUT_BUCKET = "cloudvision-input-hk2005"
OUTPUT_BUCKET = "cloudvision-output-hk2005"
BATCH_TABLE = "CloudVisionBatches"
MAX_DIMENSION = 1600
JPEG_QUALITY = 85
WEBP_QUALITY = 82

# AWS / Logging
s3 = boto3.client("s3")
dynamodb = boto3.client("dynamodb")
cloudwatch = boto3.client("cloudwatch")
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def update_batch_progress(batch_id, key):
    response = dynamodb.get_item(
        TableName=BATCH_TABLE,
        Key={
            "batchId": {
                "S": batch_id
            }
        }
    )
    item = response.get("Item")
    if not item:
        logger.warning("Batch not found: %s", batch_id)
        return
    completed = int(item["completed"]["N"])
    total = int(item["total"]["N"])
    files = item.get("files", {}).get("L", [])
    for file_item in files:
        file_map = file_item["M"]
        file_key = file_map["key"]["S"]
        if file_key == key:
            file_map["status"] = {
                "S": "COMPLETED"
            }
            break
    completed += 1
    if completed >= total:
        completed = total
        batch_status = "COMPLETED"
    else:
        batch_status = "PROCESSING"
    dynamodb.update_item(
        TableName=BATCH_TABLE,
        Key={
            "batchId": {
                "S": batch_id
            }
        },
        UpdateExpression="SET completed = :completed, #status = :status, files = :files",
        ExpressionAttributeNames={
            "#status": "status"
        },
        ExpressionAttributeValues={
            ":completed": {
                "N": str(completed)
            },
            ":status": {
                "S": batch_status
            },
            ":files": {
                "L": files
            }
        }
    )
    logger.info(
        "Batch progress updated | Batch ID: %s | Progress: %d/%d | Status: %s",
        batch_id,
        completed,
        total,
        batch_status
    )

def lambda_handler(event, context):
    request_id = context.aws_request_id
    start_time = time.perf_counter()
    logger.info(
        "CloudVision image optimization started | Request ID: %s",
        request_id
    )
    try:
        # Validate S3 event
        record = event["Records"][0]
        bucket = record["s3"]["bucket"]["name"]
        key = record["s3"]["object"]["key"]
        logger.info("Input bucket: %s", bucket)
        logger.info("Input image: %s", key)
        if bucket != INPUT_BUCKET:
            raise ValueError(f"Unexpected input bucket: {bucket}")
        # Extract batch ID from S3 key
        if "/" not in key:
            raise ValueError("Image key does not contain a batch ID")
        batch_id = key.split("/", 1)[0]
        logger.info("Batch ID: %s", batch_id)
        # Download original image
        response = s3.get_object(
            Bucket=bucket,
            Key=key
        )
        original_bytes = response["Body"].read()
        original_size = len(original_bytes)
        logger.info(
            "Original file size: %d bytes",
            original_size
        )
        # Open image
        try:
            image = Image.open(io.BytesIO(original_bytes))
            image.load()
        except UnidentifiedImageError:
            raise ValueError("Uploaded file is not a valid image")
        except Exception as e:
            raise ValueError(
                f"Unable to decode image: {str(e)}"
            )
        original_format = image.format
        original_mode = image.mode
        original_width, original_height = image.size
        logger.info(
            "Original image: %dx%d, format: %s, mode: %s",
            original_width,
            original_height,
            original_format,
            original_mode
        )
        # Detect transparency properly
        has_transparency = False
        if image.mode in ("RGBA", "LA"):
            alpha = image.getchannel("A")
            alpha_min, alpha_max = alpha.getextrema()
            has_transparency = alpha_min < 255
        elif image.mode == "P":
            transparency = image.info.get("transparency")
            if transparency is not None:
                has_transparency = True
        logger.info(
            "Actual transparency detected: %s",
            has_transparency
        )
        # Handle EXIF orientation
        image = ImageOps.exif_transpose(image)
        # Resize only when required
        width, height = image.size
        if max(width, height) > MAX_DIMENSION:
            scale = MAX_DIMENSION / max(width, height)
            new_width = max(1, int(width * scale))
            new_height = max(1, int(height * scale))
            image = image.resize(
                (new_width, new_height),
                Image.Resampling.LANCZOS
            )
            logger.info(
                "Image resized to %dx%d",
                new_width,
                new_height
            )
        else:
            logger.info(
                "Image does not exceed maximum dimension. "
                "Resize not required."
            )
        # Prepare image modes
        if not has_transparency:
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
        else:
            if image.mode not in ("RGBA", "LA"):
                image = image.convert("RGBA")
        # Candidate generation
        candidates = []
        # NON-TRANSPARENT IMAGE
        if not has_transparency:
            # JPEG candidate
            jpeg_buffer = io.BytesIO()
            image.convert("RGB").save(
                jpeg_buffer,
                format="JPEG",
                quality=JPEG_QUALITY,
                optimize=True,
                progressive=True
            )
            jpeg_bytes = jpeg_buffer.getvalue()
            candidates.append(
                {
                    "format": "JPEG",
                    "extension": ".jpg",
                    "content_type": "image/jpeg",
                    "data": jpeg_bytes
                }
            )
            logger.info(
                "Candidate: JPEG | %d bytes",
                len(jpeg_bytes)
            )
            # WebP candidate
            webp_buffer = io.BytesIO()
            image.convert("RGB").save(
                webp_buffer,
                format="WEBP",
                quality=WEBP_QUALITY,
                method=4
            )
            webp_bytes = webp_buffer.getvalue()
            candidates.append(
                {
                    "format": "WEBP",
                    "extension": ".webp",
                    "content_type": "image/webp",
                    "data": webp_bytes
                }
            )
            logger.info(
                "Candidate: WEBP | %d bytes",
                len(webp_bytes)
            )
        # TRANSPARENT IMAGE
        else:
            # WebP lossless candidate
            webp_buffer = io.BytesIO()
            image.save(
                webp_buffer,
                format="WEBP",
                lossless=True,
                method=4
            )
            webp_bytes = webp_buffer.getvalue()
            candidates.append(
                {
                    "format": "WEBP",
                    "extension": ".webp",
                    "content_type": "image/webp",
                    "data": webp_bytes
                }
            )
            logger.info(
                "Candidate: WEBP LOSSLESS | %d bytes",
                len(webp_bytes)
            )
            # PNG candidate
            png_buffer = io.BytesIO()
            image.save(
                png_buffer,
                format="PNG",
                optimize=True,
                compress_level=6
            )
            png_bytes = png_buffer.getvalue()
            candidates.append(
                {
                    "format": "PNG",
                    "extension": ".png",
                    "content_type": "image/png",
                    "data": png_bytes
                }
            )
            logger.info(
                "Candidate: PNG | %d bytes",
                len(png_bytes)
            )
        # Select smallest candidate
        best = min(
            candidates,
            key=lambda candidate: len(candidate["data"])
        )
        final_bytes = best["data"]
        final_format = best["format"]
        final_extension = best["extension"]
        final_content_type = best["content_type"]
        logger.info(
            "Best candidate: %s | %d bytes",
            final_format,
            len(final_bytes)
        )
        # Generate output key inside the same batch folder
        base_name = os.path.splitext(
            os.path.basename(key)
        )[0]
        output_key = (
            f"{batch_id}/"
            f"processed-{base_name}"
            f"{final_extension}"
        )
        logger.info(
            "Output key: %s",
            output_key
        )
        # Upload optimized image
        s3.put_object(
            Bucket=OUTPUT_BUCKET,
            Key=output_key,
            Body=final_bytes,
            ContentType=final_content_type
        )
        final_size = len(final_bytes)
        # Storage reduction
        if original_size > 0:
            reduction = (
                (original_size - final_size)
                / original_size
            ) * 100
        else:
            reduction = 0
        # Processing time
        processing_time_ms = (
            time.perf_counter() - start_time
        ) * 1000
        # CloudWatch Custom Metrics
        cloudwatch.put_metric_data(
            Namespace="CloudVision",
            MetricData=[
                {
                    "MetricName": "ImagesProcessed",
                    "Value": 1,
                    "Unit": "Count"
                },
                {
                    "MetricName": "StorageReductionPercent",
                    "Value": reduction,
                    "Unit": "Percent"
                },
                {
                    "MetricName": "ProcessingTimeMs",
                    "Value": processing_time_ms,
                    "Unit": "Milliseconds"
                }
            ]
        )
        final_width, final_height = image.size
        logger.info(
            "Processing time: %.2f ms",
            processing_time_ms
        )
        logger.info(
            "Final image uploaded successfully: %s",
            output_key
        )
        logger.info(
            "Final format: %s",
            final_format
        )
        logger.info(
            "Original size: %d bytes",
            original_size
        )
        logger.info(
            "Final size: %d bytes",
            final_size
        )
        logger.info(
            "Storage reduction: %.2f%%",
            reduction
        )
        logger.info(
            "Final dimensions: %dx%d",
            final_width,
            final_height
        )
        # Update batch progress
        update_batch_progress(
            batch_id,
            key
        )
        logger.info(
            "CloudVision image optimization completed"
        )
        # Response
        return {
            "statusCode": 200,
            "body": {
                "message": "Image optimized successfully",
                "request_id": request_id,
                "batch_id": batch_id,
                "input_file": key,
                "output_file": output_key,
                "original_format": original_format,
                "final_format": final_format,
                "original_size": original_size,
                "final_size": final_size,
                "storage_reduction_percent": round(
                    reduction,
                    2
                ),
                "original_dimensions": [
                    original_width,
                    original_height
                ],
                "final_dimensions": [
                    final_width,
                    final_height
                ],
                "transparency": has_transparency
            }
        }
    # Expected errors
    except KeyError as e:
        logger.error(
            "Invalid S3 event. Missing field: %s",
            str(e),
            exc_info=True
        )
        raise
    except ValueError as e:
        logger.error(
            "Image validation failed: %s",
            str(e),
            exc_info=True
        )
        raise
    # Unexpected errors
    except Exception as e:
        logger.error(
            "Image processing failed: %s",
            str(e),
            exc_info=True
        )
        raise