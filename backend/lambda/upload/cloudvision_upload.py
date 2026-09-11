import json
import boto3
import uuid
from botocore.exceptions import ClientError

s3 = boto3.client("s3")
INPUT_BUCKET = "cloudvision-input-hk2005"
OUTPUT_BUCKET = "cloudvision-output-hk2005"

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

def lambda_handler(event, context):
    try:
        body = event.get("body", "{}")
        if isinstance(body, str):
            body = json.loads(body)
        
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
            
            # Find processed object
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

            # Get the processed object
            output_object = objects[0]
            output_key = output_object["Key"]
            output_size = output_object["Size"]
            print("Processed object found:", output_key)
            
            # Generate secure download URL
            download_url = s3.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": OUTPUT_BUCKET,
                    "Key": output_key
                },
                ExpiresIn=300,
                HttpMethod="GET"
            )

            # Return result
            return response(
                200,
                {
                    "status": "completed",
                    "downloadUrl": download_url,
                    "key": output_key,
                    "size": output_size
                }
            )

        # UPLOAD REQUEST
        file_name = body.get("fileName", "")
        content_type = body.get("contentType", "")
        if not content_type:
            content_type = body.get("content_type", "")
        content_type = content_type.lower().strip()
        print("File name:", file_name)
        print("Content type:", content_type)

        # Validate image type
        allowed_types = {
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp"
        }
        if content_type not in allowed_types:
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

        # Select extension
        extension = {
            "image/jpeg": "jpg",
            "image/jpg": "jpg",
            "image/png": "png",
            "image/webp": "webp"
        }[content_type]

        # Generate unique key
        key = f"{uuid.uuid4()}.{extension}"

        # Generate presigned PUT URL
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

        # Return upload URL
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