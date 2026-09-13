import io
import os
import time
import logging
import zipfile
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

def update_batch_progress(batch_id, key, output_key):
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
        return False
    files = item.get("files", {}).get("L", [])
    file_index = None
    for index, file_item in enumerate(files):
        file_map = file_item["M"]
        file_key = file_map["key"]["S"]
        if file_key == key:
            file_index = index
            break
    if file_index is None:
        logger.warning(
            "File not found in batch | Batch ID: %s | Key: %s",
            batch_id,
            key
        )
        return False
    try:
        result = dynamodb.update_item(
            TableName=BATCH_TABLE,
            Key={
                "batchId": {
                    "S": batch_id
                }
            },
            UpdateExpression=(
                f"SET #files[{file_index}].#file_status = :completed, "
                f"#files[{file_index}].#output_key = :output_key, "
                "#batch_status = :processing "
                "ADD completed :one"
            ),
            ConditionExpression=(
                f"#files[{file_index}].#file_status = :pending "
                "AND completed < #total"
            ),
            ExpressionAttributeNames={
                "#files": "files",
                "#file_status": "status",
                "#output_key": "outputKey",
                "#batch_status": "status",
                "#total": "total"
            },
            ExpressionAttributeValues={
                ":completed": {
                    "S": "COMPLETED"
                },
                ":pending": {
                    "S": "PENDING"
                },
                ":processing": {
                    "S": "PROCESSING"
                },
                ":output_key": {
                    "S": output_key
                },
                ":one": {
                    "N": "1"
                }
            },
            ReturnValues="ALL_NEW"
        )
    except dynamodb.exceptions.ConditionalCheckFailedException:
        logger.info(
            "File already completed or batch already complete | "
            "Batch ID: %s | Key: %s",
            batch_id,
            key
        )
        return False
    updated_item = result["Attributes"]
    completed = int(updated_item["completed"]["N"])
    total = int(updated_item["total"]["N"])
    logger.info(
        "Batch progress updated | Batch ID: %s | Progress: %d/%d",
        batch_id,
        completed,
        total
    )
    if completed < total:
        return False
    dynamodb.update_item(
        TableName=BATCH_TABLE,
        Key={
            "batchId": {
                "S": batch_id
            }
        },
        UpdateExpression="SET #status = :completed",
        ExpressionAttributeNames={
            "#status": "status"
        },
        ExpressionAttributeValues={
            ":completed": {
                "S": "COMPLETED"
            }
        }
    )
    logger.info(
        "Batch completed | Batch ID: %s",
        batch_id
    )
    return True

def create_batch_zip(batch_id):
    response = dynamodb.get_item(
        TableName=BATCH_TABLE,
        Key={"batchId": {"S": batch_id}}
    )
    item = response.get("Item")
    if not item:
        raise ValueError(f"Batch not found: {batch_id}")
    files = item.get("files", {}).get("L", [])
    if not files:
        raise ValueError(f"No files found for batch: {batch_id}")
    zip_buffer = io.BytesIO()
    zip_key = f"{batch_id}/processed-images.zip"
    logger.info(f"Creating ZIP for batch: {batch_id}")
    with zipfile.ZipFile(
        zip_buffer,
        "w",
        compression=zipfile.ZIP_DEFLATED
    ) as zip_file:
        for file_item in files:
            file_map = file_item["M"]
            output_key_attribute = file_map.get("outputKey")
            if not output_key_attribute:
                raise ValueError(
                    f"Output key missing for batch: {batch_id}"
                )
            output_key = output_key_attribute["S"]
            logger.info(
                f"Adding processed image to ZIP: {output_key}"
            )
            response = s3.get_object(
                Bucket=OUTPUT_BUCKET,
                Key=output_key
            )
            image_bytes = response["Body"].read()
            zip_file.writestr(
                os.path.basename(output_key),
                image_bytes
            )
    zip_bytes = zip_buffer.getvalue()
    s3.put_object(
        Bucket=OUTPUT_BUCKET,
        Key=zip_key,
        Body=zip_bytes,
        ContentType="application/zip"
    )
    dynamodb.update_item(
        TableName=BATCH_TABLE,
        Key={"batchId": {"S": batch_id}},
        UpdateExpression="SET zipKey = :zip_key",
        ExpressionAttributeValues={
            ":zip_key": {"S": zip_key}
        }
    )
    logger.info(
        f"ZIP created successfully | Batch ID: {batch_id} | "
        f"ZIP: {zip_key} | Size: {len(zip_bytes)} bytes"
    )
    return zip_key

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
        batch_completed = update_batch_progress(
            batch_id,
            key,
            output_key
        )
        # Create ZIP when the batch becomes complete.
        # Also recover if a previous ZIP creation failed after the batch completed.
        zip_key = None
        if batch_completed:
            zip_key = create_batch_zip(batch_id)
        else:
            batch_response = dynamodb.get_item(
                TableName=BATCH_TABLE,
                Key={"batchId": {"S": batch_id}}
            )
            batch_item = batch_response.get("Item")
            if batch_item:
                batch_total = int(batch_item["total"]["N"])
                batch_completed_count = int(batch_item["completed"]["N"])
                existing_zip_key = batch_item.get("zipKey")
                if (
                    batch_completed_count == batch_total
                    and not existing_zip_key
                ):
                    zip_key = create_batch_zip(batch_id)
                elif existing_zip_key:
                    zip_key = existing_zip_key["S"]
        logger.info(
            "CloudVision image optimization completed"
        )
        return {
            "statusCode": 200,
            "body": {
                "message": "Image optimized successfully",
                "request_id": request_id,
                "batch_id": batch_id,
                "input_file": key,
                "output_file": output_key,
                "zip_file": zip_key,
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