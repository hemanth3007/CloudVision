import json
import os
import uuid
import boto3

UPLOAD_BUCKET = os.environ.get("UPLOAD_BUCKET", "cloudvision-input-hk2005")
OUTPUT_BUCKET = "cloudvision-output-hk2005"
BATCH_TABLE = "CloudVisionBatches"
REGION = "ap-south-1"
URL_EXPIRATION = 900
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp"
}

s3 = boto3.client("s3", region_name=REGION)
dynamodb = boto3.client("dynamodb", region_name=REGION)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "http://127.0.0.1:5500",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json"
}

def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body)
    }

def parse_body(event):
    body = event.get("body", event)
    if isinstance(body, str):
        if not body:
            return {}
        return json.loads(body)
    return body if isinstance(body, dict) else {}

def create_upload_urls(files):
    if not isinstance(files, list) or not files:
        raise ValueError("Please select at least one image.")
    if len(files) > 3:
        raise ValueError("You can upload a maximum of 3 images at a time.")

    batch_id = str(uuid.uuid4())
    uploads = []
    batch_files = []
    for file in files:
        if not isinstance(file, dict):
            raise ValueError("Invalid file information.")
        file_name = str(file.get("fileName", "")).strip()
        content_type = str(file.get("contentType", "")).lower().strip()
        if not file_name:
            raise ValueError("Every file must have a file name.")
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValueError(
                f"Unsupported image format for '{file_name}'. "
                "Please use JPG, PNG or WebP."
            )
        extension = os.path.splitext(file_name)[1].lower()
        if extension == ".jpeg":
            extension = ".jpg"
        if extension not in (".jpg", ".png", ".webp"):
            raise ValueError(
                f"Unsupported image format for '{file_name}'. "
                "Please use JPG, PNG or WebP."
            )
        object_key = f"{batch_id}/{uuid.uuid4()}{extension}"
        upload_url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": UPLOAD_BUCKET,
                "Key": object_key,
                "ContentType": content_type
            },
            ExpiresIn=URL_EXPIRATION
        )
        uploads.append({
            "fileName": file_name,
            "key": object_key,
            "uploadUrl": upload_url
        })
        batch_files.append({
            "M": {
                "fileName": {"S": file_name},
                "key": {"S": object_key},
                "status": {"S": "PENDING"}
            }
        })
    dynamodb.put_item(
        TableName=BATCH_TABLE,
        Item={
            "batchId": {"S": batch_id},
            "total": {"N": str(len(batch_files))},
            "completed": {"N": "0"},
            "status": {"S": "PROCESSING"},
            "files": {"L": batch_files}
        }
    )
    return {
        "batchId": batch_id,
        "uploads": uploads
    }

def build_download_url(output_key, file_name=None, content_type=None):
    params = {
        "Bucket": OUTPUT_BUCKET,
        "Key": output_key
    }
    if file_name:
        safe_name = file_name.replace('"', "")
        params["ResponseContentDisposition"] = (
            f'attachment; filename="{safe_name}"'
        )
    if content_type:
        params["ResponseContentType"] = content_type
    return s3.generate_presigned_url(
        ClientMethod="get_object",
        Params=params,
        ExpiresIn=URL_EXPIRATION
    )

def get_batch_status(batch_id):
    if not batch_id:
        raise ValueError("Batch ID is required.")
    result = dynamodb.get_item(
        TableName=BATCH_TABLE,
        Key={"batchId": {"S": batch_id}}
    )
    item = result.get("Item")
    if not item:
        raise ValueError("Batch not found.")
    total = int(item.get("total", {"N": "0"})["N"])
    completed = int(item.get("completed", {"N": "0"})["N"])
    status = item.get("status", {"S": "PROCESSING"})["S"]
    files = []
    for file_item in item.get("files", {}).get("L", []):
        file_map = file_item["M"]
        file_name = file_map.get("fileName", {"S": "processed-image"})["S"]
        input_key = file_map["key"]["S"]
        file_status = file_map.get("status", {"S": "PENDING"})["S"]
        file_data = {
            "fileName": file_name,
            "key": input_key,
            "status": file_status
        }
        output_key_attribute = file_map.get("outputKey")
        if output_key_attribute:
            output_key = output_key_attribute["S"]
            file_data["outputKey"] = output_key
            if file_status == "COMPLETED":
                extension = os.path.splitext(output_key)[1].lower()
                content_type = {
                    ".jpg": "image/jpeg",
                    ".webp": "image/webp",
                    ".png": "image/png"
                }.get(extension)
                download_name = os.path.basename(output_key)
                file_data["downloadUrl"] = build_download_url(
                    output_key,
                    download_name,
                    content_type
                )
        files.append(file_data)
    result_body = {
        "batchId": batch_id,
        "total": total,
        "completed": completed,
        "status": status,
        "files": files
    }
    zip_key_attribute = item.get("zipKey")
    if zip_key_attribute:
        zip_key = zip_key_attribute["S"]
        result_body["zipKey"] = zip_key
        result_body["zipDownloadUrl"] = build_download_url(
            zip_key,
            "cloudvision-processed-images.zip",
            "application/zip"
        )
    return result_body

def get_single_result(input_key):
    if not input_key:
        raise ValueError("Input key is required.")
    batch_id = input_key.split("/", 1)[0]
    result = dynamodb.get_item(
        TableName=BATCH_TABLE,
        Key={"batchId": {"S": batch_id}}
    )
    item = result.get("Item")
    if not item:
        return {
            "status": "processing"
        }
    for file_item in item.get("files", {}).get("L", []):
        file_map = file_item["M"]
        if file_map["key"]["S"] != input_key:
            continue
        if file_map.get("status", {"S": "PENDING"})["S"] != "COMPLETED":
            return {
                "status": "processing"
            }
        output_key_attribute = file_map.get("outputKey")
        if not output_key_attribute:
            return {
                "status": "processing"
            }
        output_key = output_key_attribute["S"]
        extension = os.path.splitext(output_key)[1].lower()
        content_type = {
            ".jpg": "image/jpeg",
            ".webp": "image/webp",
            ".png": "image/png"
        }.get(extension)
        head = s3.head_object(
            Bucket=OUTPUT_BUCKET,
            Key=output_key
        )
        return {
            "status": "completed",
            "key": output_key,
            "size": head["ContentLength"],
            "downloadUrl": build_download_url(
                output_key,
                os.path.basename(output_key),
                content_type
            )
        }
    return {
        "status": "processing"
    }

def lambda_handler(event, context):
    try:
        if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
            return response(200, {"message": "OK"})
        body = parse_body(event)
        action = body.get("action")
        if action == "status":
            return response(
                200,
                get_batch_status(body.get("batchId"))
            )
        if action == "result":
            result = get_single_result(body.get("key"))
            if result.get("status") == "processing":
                return response(202, result)
            return response(200, result)
        if action in (None, "upload"):
            result = create_upload_urls(body.get("files"))
            return response(200, result)
        raise ValueError("Unsupported action.")
    except json.JSONDecodeError:
        return response(400, {"error": "Invalid JSON request."})
    except ValueError as error:
        return response(400, {"error": str(error)})
    except Exception as error:
        print(f"Upload API error: {error}")
        return response(
            500,
            {"error": "An internal server error occurred. Please try again."}
        )
