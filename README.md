CloudVision

CloudVision is a serverless image optimization application built on AWS. It allows users to upload up to three images at once, process them independently using AWS Lambda, track batch progress, and download the optimized images individually or as a ZIP archive.

The project demonstrates a practical event-driven serverless architecture using AWS services, Infrastructure as Code with Terraform, automated testing, observability, and a frontend application.

Features

Upload up to 3 images per batch

Supports JPG, JPEG, PNG, and WebP input

Client-side image previews

Displays selected filenames and file sizes

Secure direct uploads to Amazon S3 using presigned URLs

Event-driven image processing

Image optimization using Pillow

Automatic WebP output

Batch progress tracking

Per-image processing status

DynamoDB-based batch state management

Automatic ZIP generation after batch completion

Individual optimized-image downloads

ZIP download containing all processed images

Temporary presigned download URLs

Error handling and retry flow

Automated processor unit tests

Terraform infrastructure configuration

CloudWatch logging and monitoring

Serverless architecture with no continuously running server

Architecture

                         ┌──────────────────────┐
                         │      Frontend        │
                         │  HTML / CSS / JS     │
                         └──────────┬───────────┘
                                    │
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │     API Gateway      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    Upload Lambda     │
                         │ cloudvision-upload-  │
                         │       image         │
                         └──────────┬───────────┘
                                    │
                         Presigned PUT URLs
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │       S3 Input Bucket       │
                    │  cloudvision-input-hk2005   │
                    └──────────────┬──────────────┘
                                   │
                              S3 Object Event
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │     Processor Lambda        │
                    │    CloudVisionProcessor     │
                    │                             │
                    │          Pillow             │
                    │      Image Optimization     │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │      S3 Output Bucket       │
                    │ cloudvision-output-hk2005   │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │         DynamoDB            │
                    │      CloudVisionBatches     │
                    │                             │
                    │  Batch / Progress / Status  │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │       ZIP Generation        │
                    │    processed-images.zip     │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                         Presigned Downloads
                                   │
                                   ▼
                         ┌──────────────────────┐
                         │       Frontend       │
                         │ Image / ZIP Download │
                         └──────────────────────┘

How CloudVision Works

1. User selects images

The frontend allows the user to select a maximum of three images.

Supported formats:

JPG

JPEG

PNG

WebP

The frontend displays a preview of each selected image along with its filename and size.

2. Frontend requests upload URLs

The frontend sends the selected filenames and content types to the Upload Lambda through API Gateway.

The Upload Lambda:

Creates a unique batch ID.

Creates the DynamoDB batch record.

Generates presigned S3 upload URLs.

Returns the URLs and batch ID to the frontend.

3. Images are uploaded directly to S3

The browser uploads each image directly to the S3 input bucket using its presigned URL.

The images do not need to pass through the Lambda function. This reduces unnecessary Lambda workload and allows Amazon S3 to handle the file transfer.

4. S3 triggers image processing

After an image is uploaded, an S3 object-created event triggers:

CloudVisionProcessor

Each image can therefore be processed independently.

5. Lambda optimizes the image

The Processor Lambda uses Pillow to:

Read the original image

Process the image

Resize when necessary

Optimize the output

Convert the result to WebP

Upload the processed image to the output bucket

The processor is configured with:

Memory: 512 MB
Timeout: 30 seconds
Runtime: Python 3.14
Architecture: x86_64

6. DynamoDB tracks progress

The batch record tracks the processing state.

For example:

Total:     3
Completed: 1
Status:    PROCESSING

The frontend periodically checks the batch status and updates the UI.

The progress therefore becomes:

0 / 3
  ↓
1 / 3
  ↓
2 / 3
  ↓
3 / 3

7. ZIP generation

When all images in the batch are successfully processed, CloudVision creates:

processed-images.zip

The ZIP contains the processed images belonging to that batch.

ZIP generation uses an in-memory io.BytesIO buffer rather than relying on a persistent local filesystem.

8. Downloads

The application provides temporary presigned download URLs.

Users can download:

Individual processed images

The complete batch as a ZIP file

The S3 buckets do not need to be publicly accessible for users to download their results.

AWS Services Used

Service

Purpose

Amazon S3

Stores input and processed images

AWS Lambda

Upload URL generation and image processing

Amazon API Gateway

HTTP API endpoint

Amazon DynamoDB

Batch and progress tracking

Amazon CloudWatch

Logs and monitoring

AWS IAM

Permissions and roles

Terraform

Infrastructure as Code

AWS Configuration

Region

ap-south-1

S3 Input Bucket

cloudvision-input-hk2005

S3 Output Bucket

cloudvision-output-hk2005

Processor Lambda

CloudVisionProcessor

Upload Lambda

cloudvision-upload-image

DynamoDB Table

CloudVisionBatches

Maximum Batch Size

3 images

Project Structure

CloudVision/
│
├── backend/
│   ├── lambda/
│   │   ├── processor/
│   │   │   └── cloudvision_processor.py
│   │   │
│   │   └── upload/
│   │       └── cloudvision_upload.py
│   │
│   └── tests/
│       └── test_processor.py
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── infrastructure/
│   └── terraform/
│       ├── api_gateway.tf
│       ├── dynamodb.tf
│       ├── iam.tf
│       ├── lambda.tf
│       ├── provider.tf
│       └── s3.tf
│
├── .gitignore
└── README.md

Local Frontend Setup

The frontend is a static HTML, CSS, and JavaScript application.

It can be run locally using a development server such as VS Code Live Server.

Open:

frontend/index.html

The local application can be accessed at:

http://127.0.0.1:5500/frontend/index.html

The frontend communicates with the deployed AWS backend through API Gateway.

Backend API

The application uses the deployed API endpoint:

https://j79eb6dc77.execute-api.ap-south-1.amazonaws.com/upload

The frontend communicates with this endpoint to:

Create upload batches

Obtain presigned upload URLs

Check batch processing status

Obtain presigned download URLs

Image Processing

The Processor Lambda uses the Pillow library.

Current optimization configuration:

JPEG Quality: 85
WebP Quality: 85
Maximum Dimension: 1600

Processed images are generated in WebP format.

Batch Processing

CloudVision intentionally limits each batch to three images.

Example:

User selects:

image1.jpg
image2.png
image3.webp

        ↓

Batch created

        ↓

3 presigned upload URLs

        ↓

S3 Input

        ↓

3 independent S3 events

        ↓

3 Lambda processing operations

        ↓

DynamoDB:

Total     = 3
Completed = 3
Status    = COMPLETED

        ↓

processed-images.zip

        ↓

Downloads

Frontend Workflow

The frontend provides the following user experience:

Select up to 3 images
        ↓
Preview selected images
        ↓
Upload images
        ↓
Show upload status
        ↓
Show processing progress
        ↓
Display processed images
        ↓
Provide individual downloads
        ↓
Generate ZIP after batch completion
        ↓
Provide ZIP download

The UI tracks each image independently while also displaying overall batch progress.

Error Handling

The application includes error handling across the workflow.

Examples include:

Unsupported file format

More than 3 selected images

Failed upload

Failed API request

Failed batch status request

Failed image processing

Failed ZIP generation

The frontend displays a user-friendly error message and provides a retry/reset option.

Important Bug Fixed During Phase 8

During Phase 8 testing, the Processor Lambda successfully processed an image but failed while updating DynamoDB.

The problem was caused by:

total

being a reserved DynamoDB keyword.

The DynamoDB update expression was corrected by using an expression attribute name alias.

After the fix, the processor successfully updated batch progress and the batch workflow completed correctly.

ZIP Generation

After all images in a batch are processed successfully, CloudVision creates:

processed-images.zip

The ZIP contains the processed output images for that batch.

The implementation uses:

io.BytesIO()

for in-memory ZIP creation.

This avoids depending on a persistent local filesystem.

Secure Downloads

Processed files are stored in the S3 output bucket.

The application does not make the output bucket publicly accessible.

Instead, the backend generates temporary presigned download URLs.

This allows users to download their files without exposing the S3 bucket publicly.

Testing

Processor unit tests were executed using:

pytest .\backend\tests\test_processor.py -v

Final result:

7 passed

End-to-End Testing

The following functionality was tested successfully:

Test

Result

Single-image processing

Passed

Two-image batch

Passed

Three-image batch

Passed

JPG input

Passed

PNG input

Passed

WebP input

Passed

Batch progress tracking

Passed

S3 event processing

Passed

Individual image download

Passed

ZIP generation

Passed

ZIP download

Passed

ZIP contents

Passed

Frontend reset

Passed

Infrastructure as Code

Terraform configuration is located in:

infrastructure/terraform/

Main Terraform files:

provider.tf
s3.tf
dynamodb.tf
iam.tf
lambda.tf
api_gateway.tf

Terraform is used to define and maintain the AWS infrastructure.

Application source code for Lambda functions is deployed separately.

Deployment Status

Backend

The AWS backend is deployed and operational.

API Gateway       ✓
Upload Lambda     ✓
Processor Lambda  ✓
S3 Input          ✓
S3 Output         ✓
DynamoDB          ✓
CloudWatch        ✓

Frontend

The frontend currently runs locally using a development server.

http://127.0.0.1:5500/frontend/index.html

The next deployment step is to host the frontend using Amazon S3 and Amazon CloudFront.

Production Deployment Plan

The planned production architecture is:

                    Internet
                       │
                       ▼
                ┌──────────────┐
                │  CloudFront  │
                │    HTTPS     │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ S3 Frontend  │
                │    Bucket    │
                └──────────────┘

                       │
                       │ API Requests
                       ▼

                ┌──────────────┐
                │ API Gateway  │
                └──────┬───────┘
                       │
                       ▼
                AWS Serverless
                   Backend

The production frontend will be hosted in Amazon S3 and delivered through Amazon CloudFront.

This will provide a public HTTPS URL instead of the current localhost development URL.

Security Considerations

CloudVision uses several security mechanisms:

S3 presigned URLs for uploads

S3 presigned URLs for downloads

IAM roles for Lambda permissions

Separate input and output S3 buckets

API Gateway for backend API access

Temporary download URLs

No AWS credentials inside frontend JavaScript

Infrastructure managed through Terraform

Cost Considerations

CloudVision uses serverless AWS services that generally charge based on usage.

Potential usage-based services include:

AWS Lambda invocations and compute duration

S3 storage and requests

API Gateway requests

DynamoDB usage

CloudWatch logs

CloudFront requests and data transfer after production deployment

The application does not require an always-running backend server.

Future Improvements

Possible future improvements include:

User authentication

Larger batch sizes

Image quality selection

Output format selection

Compression statistics

Display optimized file sizes

Display percentage storage reduction

Authentication-based user history

Automatic cleanup of old files

CloudFront production deployment

Custom domain

Additional image-processing options

More detailed monitoring dashboards

Project Progress

Phase 1  ✓
Phase 2  ✓
Phase 3  ✓
Phase 4  ✓
Phase 5  ✓
Phase 6  ✓
Phase 7  ✓
Phase 8  ✓

Current status:

CloudVision Backend:              DEPLOYED ✓
CloudVision Frontend:             LOCAL ✓
Multi-Image Processing:           COMPLETE ✓
Batch Tracking:                   COMPLETE ✓
ZIP Generation:                   COMPLETE ✓
Individual Downloads:             COMPLETE ✓
ZIP Downloads:                    COMPLETE ✓
Automated Tests:                  PASSED ✓
Phase 8:                          COMPLETE ✓
Production Frontend Deployment:   NEXT

Key Technologies

Frontend
- HTML5
- CSS3
- JavaScript

Backend
- Python
- AWS Lambda
- Pillow

AWS
- Amazon S3
- AWS Lambda
- Amazon API Gateway
- Amazon DynamoDB
- Amazon CloudWatch
- AWS IAM
- Amazon CloudFront (planned)

Infrastructure
- Terraform

Testing
- Pytest

What This Project Demonstrates

CloudVision demonstrates practical experience with:

Serverless architecture

Event-driven architecture

AWS Lambda

Amazon S3

API Gateway

DynamoDB

IAM

CloudWatch

Presigned URLs

Batch processing

Asynchronous processing

Image optimization

ZIP file generation

Infrastructure as Code

Terraform

Python

JavaScript

Automated testing

Error handling

Observability

Cloud architecture design

Author

Hemanth K

CloudVision is a personal AWS serverless project created to demonstrate cloud architecture, event-driven processing, infrastructure as code, backend development, frontend integration, testing, observability, and production deployment practices.

License

This project is intended for educational and portfolio purposes.
