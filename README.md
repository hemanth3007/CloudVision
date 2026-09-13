🚀 CloudVision

<p align="center">
  <img src="https://img.shields.io/badge/AWS-Serverless-orange?style=for-the-badge&logo=amazon-aws" alt="AWS Serverless">
  <img src="https://img.shields.io/badge/Python-3.14-blue?style=for-the-badge&logo=python" alt="Python">
  <img src="https://img.shields.io/badge/Terraform-IaC-7B42BC?style=for-the-badge&logo=terraform" alt="Terraform">
  <img src="https://img.shields.io/badge/Tests-7%20Passed-success?style=for-the-badge&logo=pytest" alt="Tests">
</p>

<p align="center">
  <strong>A production-style serverless image optimization platform built on AWS.</strong>
</p>

<p align="center">
  Upload up to <strong>3 images</strong> → Process them independently → Track progress → Download optimized images or a ZIP archive.
</p>

✨ Project Highlights

Feature

Status

🖼️ Multi-image upload

✅

⚡ Serverless image processing

✅

📊 Batch progress tracking

✅

🗜️ Automatic ZIP generation

✅

📥 Individual downloads

✅

📦 ZIP download

✅

🔐 Presigned S3 URLs

✅

🧪 Automated tests

7/7 Passed

🏗️ Terraform infrastructure

✅

📈 CloudWatch observability

✅

🌐 Production frontend

🚧 Next

<mark>CloudVision Backend is already deployed and operational on AWS.</mark>

🎯 What is CloudVision?

CloudVision is a serverless image optimization application designed to demonstrate a real-world AWS event-driven architecture.

Users can select up to three images, upload them directly to Amazon S3 using secure presigned URLs, and have each image processed independently by AWS Lambda.

Once processing is complete, users can:

👁️ View processed images

📥 Download individual images

📦 Download all processed images as a ZIP file

📊 Track batch progress in real time

The project was built with a focus on serverless architecture, scalability, security, Infrastructure as Code, testing, and observability.

🏗️ Architecture

                         ┌──────────────────────┐
                         │      FRONTEND        │
                         │    HTML / CSS / JS   │
                         └──────────┬───────────┘
                                    │
                                  HTTPS
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     API GATEWAY      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    UPLOAD LAMBDA     │
                         │ cloudvision-upload-  │
                         │       image         │
                         └──────────┬───────────┘
                                    │
                           Presigned PUT URLs
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │        S3 INPUT             │
                    │  cloudvision-input-hk2005   │
                    └──────────────┬──────────────┘
                                   │
                              S3 Object Event
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │      PROCESSOR LAMBDA       │
                    │    CloudVisionProcessor     │
                    │                             │
                    │           Pillow            │
                    │      Image Optimization     │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │        S3 OUTPUT            │
                    │ cloudvision-output-hk2005   │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │          DYNAMODB            │
                    │      CloudVisionBatches      │
                    │                              │
                    │   Batch / Progress / Status  │
                    └──────────────┬──────────────┘
                                   │
                            All images done
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │       ZIP GENERATION        │
                    │    processed-images.zip     │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                         Temporary Presigned
                            Download URLs
                                   │
                                   ▼
                         ┌──────────────────────┐
                         │      FRONTEND        │
                         │  Image / ZIP Download│
                         └──────────────────────┘

🔄 How It Works

1️⃣ Select Images

The user selects up to 3 images.

Supported formats:

JPG

JPEG

PNG

WebP

2️⃣ Create Upload Batch

The frontend calls the API Gateway endpoint.

The Upload Lambda:

Generates a unique batch ID.

Creates a DynamoDB batch record.

Generates presigned S3 upload URLs.

Returns the URLs to the frontend.

3️⃣ Direct S3 Upload

The browser uploads images directly to Amazon S3.

Browser
   │
   │ Presigned PUT
   ▼
S3 Input Bucket

This avoids sending image data through Lambda and reduces unnecessary backend processing.

4️⃣ Event-Driven Processing

When an image arrives in the input bucket, S3 generates an object-created event.

That event triggers:

CloudVisionProcessor

Each image is processed independently.

5️⃣ Image Optimization

The processor uses Pillow to:

Read the image

Resize oversized images

Optimize the image

Convert the output to WebP

Upload the processed image to the output bucket

6️⃣ Batch Progress Tracking

DynamoDB stores the state of every batch.

Example:

Total:       3
Completed:   2
Status:      PROCESSING

The frontend polls the API and updates the progress.

0 / 3
  ↓
1 / 3
  ↓
2 / 3
  ↓
3 / 3
  ↓
COMPLETED

7️⃣ ZIP Generation

When every image in the batch is successfully processed:

processed-images.zip

is generated automatically.

The ZIP is created using an in-memory io.BytesIO() buffer.

8️⃣ Secure Downloads

The backend generates temporary presigned download URLs.

Users can download:

Individual optimized images

The complete ZIP archive

<mark>The S3 output bucket does not need to be publicly accessible.</mark>

☁️ AWS Services

AWS Service

Purpose

🪣 Amazon S3

Input and processed image storage

⚡ AWS Lambda

Upload URL generation and image processing

🌐 API Gateway

HTTP API

🗄️ DynamoDB

Batch and progress tracking

📊 CloudWatch

Logs and monitoring

🔐 IAM

Permissions and execution roles

🏗️ Terraform

Infrastructure as Code

🌍 CloudFront

Planned production frontend hosting

⚙️ AWS Configuration

Region

ap-south-1

Input Bucket

cloudvision-input-hk2005

Output Bucket

cloudvision-output-hk2005

Processor Lambda

CloudVisionProcessor

Upload Lambda

cloudvision-upload-image

DynamoDB Table

CloudVisionBatches

Maximum Batch Size

3 images

🖼️ Image Processing Configuration

Setting

Value

JPEG Quality

85

WebP Quality

85

Maximum Dimension

1600 px

Output Format

WebP

Processor Memory

512 MB

Processor Timeout

30 seconds

Runtime

Python 3.14

Architecture

x86_64

📁 Project Structure

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

🧪 Testing

Processor unit tests were executed using:

pytest .\backend\tests\test_processor.py -v

Result

<p align="center">

✅ 7 / 7 TESTS PASSED

</p>

End-to-end functionality was also verified:

Test

Result

Single-image processing

✅

Two-image batch

✅

Three-image batch

✅

JPG input

✅

PNG input

✅

WebP input

✅

S3 event processing

✅

DynamoDB progress tracking

✅

Individual download

✅

ZIP generation

✅

ZIP download

✅

ZIP contents

✅

Frontend reset

✅

🐛 Important Production Bug Fixed

During Phase 8 testing, the Processor Lambda successfully processed images but failed while updating DynamoDB.

The cause was the DynamoDB reserved keyword:

total

The update expression was corrected by using an Expression Attribute Name alias.

After the fix:

Image Processing
       ↓
DynamoDB Progress Update
       ↓
Batch Completion
       ↓
ZIP Generation
       ↓
Downloads

worked correctly.

🔐 Security

CloudVision follows several security practices:

🔑 Presigned URLs for uploads

📥 Presigned URLs for downloads

🔐 IAM-based Lambda permissions

🚫 No AWS credentials in frontend JavaScript

🪣 Separate input and output buckets

⏱️ Temporary download URLs

🌐 API Gateway for controlled backend access

🏗️ Infrastructure managed with Terraform

💰 Serverless Cost Model

CloudVision does not require an always-running backend server.

Potential AWS usage costs come from:

AWS Lambda invocations and execution time

S3 storage and requests

API Gateway requests

DynamoDB usage

CloudWatch logs

CloudFront requests and data transfer after production deployment

The current batch limit of 3 images also keeps the application lightweight and predictable for a portfolio project.

🖥️ Run the Frontend Locally

The frontend is a static HTML/CSS/JavaScript application.

For local development, use a development server such as VS Code Live Server.

Open:

frontend/index.html

Example local address:

http://127.0.0.1:5500/frontend/index.html

The local frontend communicates with the deployed AWS backend.

🔗 Backend API

The deployed API endpoint is:

https://j79eb6dc77.execute-api.ap-south-1.amazonaws.com/upload

It is used for:

Creating upload batches

Generating presigned upload URLs

Checking batch status

Obtaining presigned download URLs

🏗️ Infrastructure as Code

Terraform configuration is located at:

infrastructure/terraform/

Main configuration files:

provider.tf
s3.tf
dynamodb.tf
iam.tf
lambda.tf
api_gateway.tf

Terraform manages the AWS infrastructure while Lambda application source code is deployed separately.

🚀 Deployment Status

Backend

Component

Status

API Gateway

🟢 DEPLOYED

Upload Lambda

🟢 DEPLOYED

Processor Lambda

🟢 DEPLOYED

S3 Input

🟢 ACTIVE

S3 Output

🟢 ACTIVE

DynamoDB

🟢 ACTIVE

CloudWatch

🟢 ACTIVE

Frontend

🟡 Currently running locally

Production frontend deployment is the next step.

🌍 Production Deployment Plan

The planned production frontend architecture is:

                    🌐 Internet
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
                 └──────┬───────┘
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

This will replace the current localhost frontend with a public HTTPS application.

📈 Project Progress

Phase

Description

Status

1

Initial project setup

✅

2

S3 bucket infrastructure

✅

3

Core backend

✅

4

Frontend integration

✅

5

Production improvements

✅

6

Observability & reliability

✅

7

Frontend & project structure

✅

8

Multi-image processing & downloads

✅

9

Production deployment

🚧 Next

<mark>Phase 8 is complete. The AWS backend is deployed and the complete multi-image workflow has been tested successfully.</mark>

🧰 Technology Stack

Frontend

HTML5

CSS3

JavaScript

Backend

Python

AWS Lambda

Pillow

AWS

Amazon S3

AWS Lambda

Amazon API Gateway

Amazon DynamoDB

Amazon CloudWatch

AWS IAM

Amazon CloudFront (planned)

Infrastructure

Terraform

Testing

Pytest

💡 What This Project Demonstrates

CloudVision demonstrates hands-on experience with:

☁️ Serverless architecture

🔄 Event-driven architecture

⚡ AWS Lambda

🪣 Amazon S3

🌐 API Gateway

🗄️ DynamoDB

🔐 IAM

📊 CloudWatch

🔑 Presigned URLs

📦 Batch processing

🔀 Asynchronous workflows

🖼️ Image optimization

🗜️ ZIP generation

🏗️ Infrastructure as Code

🧪 Automated testing

🛡️ Error handling

📈 Observability

💻 Python backend development

🌐 JavaScript frontend development

🔮 Future Improvements

Potential future improvements:

🔐 User authentication

📦 Larger batch sizes

🎚️ Image quality selection

🖼️ Multiple output formats

📊 Compression statistics

💾 Storage reduction percentage

🧹 Automatic cleanup of old files

👤 User-specific processing history

🌍 CloudFront production deployment

🔗 Custom domain

📈 Advanced monitoring dashboard

🖼️ Additional image-processing options

👨‍💻 Author

Hemanth K

CloudVision is a personal AWS serverless project created to demonstrate practical skills in cloud architecture, backend development, event-driven processing, Infrastructure as Code, testing, observability, and production deployment.

<p align="center">
  <strong>⭐ If you find this project useful, consider giving the repository a star!</strong>
</p>

<p align="center">
  Built with ☁️ AWS + 🐍 Python + 🏗️ Terraform + ❤️
</p>

📄 License

This project is intended for educational and portfolio purposes.
