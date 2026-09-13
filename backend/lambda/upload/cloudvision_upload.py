import json
import boto3
import uuid

s3 = boto3.client("s3")
dynamodb = boto3.client("dynamodb")

INPUT_BUCKET = "cloudvision-input-hk2005"
OUTPUT_BUCKET = "cloudvision-output-hk2005"
BATCH_TABLE = "CloudVisionBatches"

ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
}

def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "http://127.0.0.1:5500",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST,OPTIONS"
        },
        "body": json.dumps(body)
    }

def get_batch_status(batch_id):
    result = dynamodb.get_item(
        TableName=BATCH_TABLE,
        Key={
            "batchId": {
                "S": batch_id
            }
        }
    )

    item = result.get("Item")

    if not item:
        return response(
            404,
            {
                "error": "Batch not found.",
                "batchId": batch_id
            }
        )

    total = int(item.get("total", {}).get("N", "0"))
    completed = int(item.get("completed", {}).get("N", "0"))
    status = item.get("status", {}).get("S", "PROCESSING")

    files = []

    for file_item in item.get("files", {}).get("L", []):
        file_map = file_item.get("M", {})

        file_key = file_map.get("key", {}).get("S", "")
        file_name = file_map.get("fileName", {}).get("S", "")
        file_status = file_map.get("status", {}).get("S", "PENDING")

        files.append(
            {
                "key": file_key,
                "fileName": file_name,
                "status": file_status
            }
        )

    return response(
        200,
        {
            "batchId": batch_id,
            "total": total,
            "completed": completed,
            "status": status,
            "files": files
        }
    )

def lambda_handler(event, context):
    try:
        body = event.get("body", "{}")

        if isinstance(body, str):
            body = json.loads(body)

        # BATCH STATUS REQUEST
        if body.get("action") == "status":
            batch_id = body.get("batchId", "").strip()

            if not batch_id:
                return response(
                    400,
                    {
                        "error": "Missing batchId."
                    }
                )

            print("Checking batch status:", batch_id)

            return get_batch_status(batch_id)

        # RESULT REQUEST
        if body.get("action") == "result":
            input_key = body.get("key", "")

            if not input_key:
                return response(
                    400,
                    {
                        "error": "Missing key"
                    }
                )

            input_name = input_key.rsplit("/", 1)[-1]
            base_name = input_name.rsplit(".", 1)[0]
            prefix = f"processed-{base_name}"

            print("Searching output bucket with prefix:", prefix)

            result = s3.list_objects_v2(
                Bucket=OUTPUT_BUCKET,
                Prefix=prefix
            )

            objects = result.get("Contents", [])

            if not objects:
                return response(
                    202,
                    {
                        "status": "processing"
                    }
                )

            output_object = objects[0]
            output_key = output_object["Key"]
            output_size = output_object["Size"]

            print("Processed object found:", output_key)

            download_url = s3.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": OUTPUT_BUCKET,
                    "Key": output_key
                },
                ExpiresIn=300,
                HttpMethod="GET"
            )

            return response(
                200,
                {
                    "status": "completed",
                    "downloadUrl": download_url,
                    "key": output_key,
                    "size": output_size
                }
            )

        # MULTI-FILE UPLOAD REQUEST
        files = body.get("files")

        if files is not None:
            if not isinstance(files, list):
                return response(
                    400,
                    {
                        "error": "Files must be provided as a list."
                    }
                )

            if len(files) == 0:
                return response(
                    400,
                    {
                        "error": "No files provided."
                    }
                )

            if len(files) > 3:
                return response(
                    400,
                    {
                        "error": "A maximum of 3 images can be uploaded at once."
                    }
                )

            batch_id = str(uuid.uuid4())
            uploads = []
            batch_files = []

            for file in files:
                file_name = file.get("fileName", "")
                content_type = file.get("contentType", "")

                if not content_type:
                    content_type = file.get("content_type", "")

                content_type = content_type.lower().strip()

                print("File name:", file_name)
                print("Content type:", content_type)

                if not file_name:
                    return response(
                        400,
                        {
                            "error": "Missing file name."
                        }
                    )

                if content_type not in ALLOWED_TYPES:
                    return response(
                        400,
                        {
                            "error": "Unsupported image type",
                            "fileName": file_name,
                            "received_type": content_type,
                            "supported_types": [
                                "image/jpeg",
                                "image/png",
                                "image/webp"
                            ]
                        }
                    )

                extension = ALLOWED_TYPES[content_type]
                key = f"{batch_id}/{uuid.uuid4()}.{extension}"

                upload_url = s3.generate_presigned_url(
                    "put_object",
                    Params={
                        "Bucket": INPUT_BUCKET,
                        "Key": key,
                        "ContentType": content_type
                    },
                    ExpiresIn=300,
                    HttpMethod="PUT"
                )

                print("Generated upload key:", key)

                uploads.append(
                    {
                        "uploadUrl": upload_url,
                        "key": key,
                        "fileName": file_name
                    }
                )

                batch_files.append(
                    {
                        "key": {
                            "S": key
                        },
                        "fileName": {
                            "S": file_name
                        },
                        "status": {
                            "S": "PENDING"
                        }
                    }
                )

            dynamodb.put_item(
                TableName=BATCH_TABLE,
                Item={
                    "batchId": {
                        "S": batch_id
                    },
                    "total": {
                        "N": str(len(files))
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
                                "M": file
                            }
                            for file in batch_files
                        ]
                    }
                }
            )

            print("Created batch:", batch_id)

            return response(
                200,
                {
                    "batchId": batch_id,
                    "uploads": uploads
                }
            )

        # SINGLE-FILE UPLOAD REQUEST
        file_name = body.get("fileName", "")
        content_type = body.get("contentType", "")

        if not content_type:
            content_type = body.get("content_type", "")

        content_type = content_type.lower().strip()

        print("File name:", file_name)
        print("Content type:", content_type)

        if not content_type:
            return response(
                400,
                {
                    "error": "Missing content type."
                }
            )

        if content_type not in ALLOWED_TYPES:
            return response(
                400,
                {
                    "error": "Unsupported image type",
                    "received_type": content_type,
                    "supported_types": [
                        "image/jpeg",
                        "image/png",
                        "image/webp"
                    ]
                }
            )

        extension = ALLOWED_TYPES[content_type]
        key = f"{uuid.uuid4()}.{extension}"

        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": INPUT_BUCKET,
                "Key": key,
                "ContentType": content_type
            },
            ExpiresIn=300,
            HttpMethod="PUT"
        )

        print("Generated upload key:", key)

        return response(
            200,
            {
                "uploadUrl": upload_url,
                "key": key
            }
        )

    except Exception as e:
        print("Error:", str(e))

        return response(
            500,
            {
                "error": str(e)
            }
        )