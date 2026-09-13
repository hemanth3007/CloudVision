<div align="center">

# 🚀 CloudVision

<p align="center">
  <img src="https://img.shields.io/badge/AWS-Serverless-orange?style=for-the-badge&logo=amazon-aws" alt="AWS Serverless">
  <img src="https://img.shields.io/badge/Python-3.14-blue?style=for-the-badge&logo=python" alt="Python">
  <img src="https://img.shields.io/badge/Terraform-IaC-7B42BC?style=for-the-badge&logo=terraform" alt="Terraform">
  <img src="https://img.shields.io/badge/Tests-7%20Passed-success?style=for-the-badge&logo=pytest" alt="Tests">
</p>

### **A production-style serverless image optimization platform built on AWS.**

Upload up to **3 images** → Process them independently → Track real-time progress → Download optimized images or a complete ZIP archive.

---

> [!NOTE]
> **Live Backend Status**: The CloudVision Backend is fully deployed and operational in AWS region `ap-south-1`.

</div>

---

## 📑 Table of Contents

- [✨ Project Highlights](#-project-highlights)
- [🎯 What is CloudVision?](#-what-is-cloudvision)
- [🏗️ Architecture](#️-architecture)
- [🔄 How It Works](#-how-it-works)
- [☁️ AWS Services Used](#️-aws-services-used)
- [⚙️ Configuration](#️-configuration)
  - [AWS Configuration](#aws-configuration)
  - [Image Processing Configuration](#image-processing-configuration)
- [📁 Project Structure](#-project-structure)
- [🧪 Automated & Integration Testing](#-automated--integration-testing)
- [🐛 Critical Production Bug Solved](#-critical-production-bug-solved)
- [🔐 Security Best Practices](#-security-best-practices)
- [💰 Serverless Cost Model](#-serverless-cost-model)
- [🖥️ Running Locally](#️-running-locally)
- [🔗 Backend API Specification](#-backend-api-specification)
- [🏗️ Infrastructure as Code (Terraform)](#️-infrastructure-as-code-terraform)
- [🚀 Deployment Status](#-deployment-status)
- [🌍 Production Deployment Plan](#-production-deployment-plan)
- [📈 Project Roadmap & Milestones](#-project-roadmap--milestones)
- [🧰 Technology Stack](#-technology-stack)
- [💡 What This Project Demonstrates](#-what-this-project-demonstrates)
- [🔮 Future Improvements](#-future-improvements)
- [👨‍💻 Author](#-author)
- [📄 License](#-license)

---

## ✨ Project Highlights

| Feature | Status | Description |
| :--- | :---: | :--- |
| 🖼️ **Multi-Image Upload** | ✅ | Select and upload up to 3 images concurrently |
| ⚡ **Serverless Image Processing** | ✅ | AWS Lambda with Pillow for automatic resizing & compression |
| 📊 **Batch Progress Tracking** | ✅ | Real-time batch and per-file progress state in DynamoDB |
| 🗜️ **Automatic ZIP Generation** | ✅ | Packaging processed images into an in-memory ZIP archive |
| 📥 **Individual Downloads** | ✅ | Instant download for each processed image via presigned URLs |
| 📦 **Batch ZIP Download** | ✅ | One-click single download for the entire batch |
| 🔐 **Presigned S3 URLs** | ✅ | Direct client-to-S3 uploads without touching web servers |
| 🧪 **Automated Testing** | ✅ | Comprehensive test suite (**7 / 7 passed**) |
| 🏗️ **Infrastructure as Code** | ✅ | 100% reproducible AWS setup with Terraform |
| 📈 **CloudWatch Observability** | ✅ | Structured logging and custom operational metrics |
| 🌐 **Production Frontend** | 🚧 | Studio 2-column cockpit with real-time feedback |

---

## 🎯 What is CloudVision?

**CloudVision** is a cloud-native image optimization application architected to showcase a real-world, event-driven AWS serverless pipeline. 

Instead of traditional compute servers handling heavy image resizing tasks, CloudVision delegates the ingestion, processing, and distribution layers to scalable AWS cloud primitives:
1. **Zero Server Overhead**: The browser uploads directly to Amazon S3 using temporary presigned URLs.
2. **Event-Driven Execution**: S3 `ObjectCreated` events trigger AWS Lambda instances independently.
3. **Optimized Distribution**: Pillow converts images to WebP/JPEG, stores them in an output bucket, updates DynamoDB status, and generates a packaged ZIP file.
4. **Secure Distribution**: Users retrieve processed artifacts via secure, short-lived presigned GET URLs—ensuring the S3 output bucket never needs to be public.

---

## 🏗️ Architecture

```text
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
```

---

## 🔄 How It Works

### 1️⃣ Image Selection
The user chooses up to **3 images** (JPG, PNG, or WebP) via drag-and-drop or file picker.

### 2️⃣ Batch Initialization
The frontend sends metadata (`fileName`, `contentType`) to the API Gateway `/upload` endpoint.
- Upload Lambda creates a unique `batchId` (UUID).
- Generates presigned `PUT` URLs with a 15-minute TTL.
- Initializes a batch record in DynamoDB with `status: PROCESSING`.

### 3️⃣ Direct-to-S3 Upload
The browser uploads files directly to the **S3 Input Bucket** via presigned `PUT` URLs:
```text
Browser ──[ Presigned PUT ]──▶ S3 Input Bucket
```
> [!TIP]
> This pattern bypasses API Gateway payload size limits (10 MB) and prevents Lambda execution timeouts during slow uploads.

### 4️⃣ Event-Driven Image Optimization
Arrival of an object in `cloudvision-input-hk2005` immediately emits an S3 Event Notification triggering `CloudVisionProcessor`:
- Reads raw image bytes into memory.
- Corrects orientation using EXIF tags.
- Resizes oversized images (capped at `1600px` max dimension).
- Generates optimized candidates (WebP, optimized JPEG, PNG) and picks the candidate with the highest compression efficiency.
- Saves the processed artifact to `cloudvision-output-hk2005`.

### 5️⃣ Real-time Progress Tracking
Each processed image updates the DynamoDB batch record atomically:
```text
0/3 (Pending) ──▶ 1/3 (Processing) ──▶ 2/3 (Processing) ──▶ 3/3 (COMPLETED)
```
The frontend polls the batch status and updates individual file badges and progress bars in real time.

### 6️⃣ In-Memory ZIP Packaging
When the final image in a batch finishes, the processor automatically triggers `create_batch_zip()`:
- Downloads all processed images from S3 into an in-memory `io.BytesIO()` buffer.
- Compresses them using `zipfile.ZIP_DEFLATED`.
- Uploads `processed-images.zip` to the output bucket and stores the `zipKey` in DynamoDB.

### 7️⃣ Secure Artifact Retrieval
The frontend receives presigned GET download URLs for both individual images and the complete ZIP package. The S3 output bucket remains private and protected.

---

## ☁️ AWS Services Used

| AWS Service | Role in CloudVision |
| :--- | :--- |
| 🪣 **Amazon S3** | Ingestion bucket with lifecycle rules & private output artifact bucket |
| ⚡ **AWS Lambda** | Presigned URL generator (`Upload`) & Pillow image pipeline (`Processor`) |
| 🌐 **API Gateway** | REST HTTP API interface with CORS handling |
| 🗄️ **Amazon DynamoDB** | Atomic batch tracking, completion counts, and file metadata |
| 📊 **Amazon CloudWatch** | Structured JSON logging, alarm metrics, and storage reduction telemetry |
| 🔐 **AWS IAM** | Granular execution roles adhering to the Principle of Least Privilege |
| 🏗️ **Terraform** | Automated provisioning and lifecycle management for all infrastructure |
| 🌍 **Amazon CloudFront** | Global edge distribution for the production frontend (*planned*) |

---

## ⚙️ Configuration

### AWS Configuration
| Parameter | Value | Description |
| :--- | :--- | :--- |
| **AWS Region** | `ap-south-1` | Mumbai |
| **Input Bucket** | `cloudvision-input-hk2005` | Raw image ingestion bucket |
| **Output Bucket** | `cloudvision-output-hk2005` | Processed images & ZIP storage |
| **Processor Lambda** | `CloudVisionProcessor` | Event-driven image processing engine |
| **Upload Lambda** | `cloudvision-upload-image` | Batch manager and presigned URL issuer |
| **DynamoDB Table** | `CloudVisionBatches` | Primary key: `batchId` (String) |
| **Max Batch Size** | `3 images` | Keeps usage well within Free Tier |

### Image Processing Configuration
| Setting | Value | Rationale |
| :--- | :--- | :--- |
| **JPEG Quality** | `85` | Balanced visual fidelity and file compression |
| **WebP Quality** | `85` | High-efficiency modern web standard |
| **Max Dimension** | `1600 px` | Automatic aspect-ratio-preserving downscaling |
| **Output Format** | `WebP` / `JPEG` / `PNG` | Dynamic candidate selection for smallest file size |
| **Processor Memory** | `512 MB` | Optimized for PIL operations & fast CPU allocation |
| **Processor Timeout**| `30 seconds` | Sufficient buffer for multi-megabyte image processing |
| **Runtime** | `Python 3.14` | Latest high-performance Python runtime |
| **Architecture** | `x86_64` | Broad compatibility for native Pillow wheels |

---

## 📁 Project Structure

```text
CloudVision/
│
├── backend/
│   ├── lambda/
│   │   ├── processor/
│   │   │   └── cloudvision_processor.py   # Event-driven Pillow processing & ZIP creation
│   │   │
│   │   └── upload/
│   │       └── cloudvision_upload.py      # Upload batch creation & status polling
│   │
│   ├── requirements/
│   │   ├── processor.txt                  # Pillow, boto3
│   │   └── upload.txt                     # boto3
│   │
│   └── tests/
│       └── test_processor.py              # Unit tests for resizing, orientation & formats
│
├── frontend/
│   ├── index.html                         # SaaS studio layout with 2-column cockpit
│   ├── style.css                          # Modern dark glassmorphic styling
│   └── script.js                          # Batch polling, async size lookups & state management
│
├── infrastructure/
│   └── terraform/
│       ├── api_gateway.tf                 # HTTP API & routes
│       ├── dynamodb.tf                    # DynamoDB tables & TTL
│       ├── iam.tf                         # Least-privilege IAM policies
│       ├── lambda.tf                      # Lambda definitions, memory & timeouts
│       ├── provider.tf                    # AWS provider definition
│       └── s3.tf                          # Buckets, encryption & lifecycle rules
│
├── .gitignore
└── README.md
```

---

## 🧪 Automated & Integration Testing

CloudVision utilizes **Pytest** for backend validation, ensuring robust image decoding, transparent PNG handling, and dimension scaling.

```bash
pytest .\backend\tests\test_processor.py -v
```

```text
============================= test session starts =============================
platform win32 -- Python 3.14.0, pytest-8.3.4, pluggy-1.5.0
collected 7 items

backend/tests/test_processor.py::test_resize PASSED                     [ 14%]
backend/tests/test_processor.py::test_no_resize_small_image PASSED      [ 28%]
backend/tests/test_processor.py::test_exif_transpose PASSED             [ 42%]
backend/tests/test_processor.py::test_optimize_jpeg PASSED              [ 57%]
backend/tests/test_processor.py::test_optimize_png PASSED               [ 71%]
backend/tests/test_processor.py::test_optimize_webp PASSED              [ 85%]
backend/tests/test_processor.py::test_invalid_image PASSED              [100%]

============================== 7 passed in 0.48s ==============================
```

### End-to-End Integration Verification

| Test Scenario | Result | Details |
| :--- | :---: | :--- |
| **Single-Image Processing** | ✅ | Verified individual image optimization workflow |
| **Two-Image Batch** | ✅ | Verified concurrent Lambda execution |
| **Three-Image Batch** | ✅ | Maximum allowed batch size verified |
| **JPG / JPEG Input** | ✅ | Quality compression to 85% with EXIF normalization |
| **PNG Input** | ✅ | Preserved alpha transparency during WebP conversion |
| **WebP Input** | ✅ | Re-compressed and optimized without generational loss |
| **S3 Event Notification** | ✅ | Sub-second trigger of `CloudVisionProcessor` |
| **DynamoDB State Machine** | ✅ | Atomic counter increments (`ADD completed :one`) |
| **Individual Download URLs** | ✅ | Presigned GET URLs generated with proper headers |
| **In-Memory ZIP Creation** | ✅ | Valid `.zip` archive containing all batch images |
| **ZIP Download & Extraction** | ✅ | Files unpack correctly with matching checksums |
| **Frontend Reset State** | ✅ | DOM and polling timers cleanly reset |

---

## 🐛 Critical Production Bug Solved

> [!IMPORTANT]
> **Issue Identified During Phase 8**:
> When processing images, the Lambda function successfully generated output images but crashed with `ClientError: An error occurred (ValidationException) on UpdateItem: Syntax error; token: "total"` when updating DynamoDB.
> 
> **Root Cause**: `total` is an **AWS DynamoDB Reserved Keyword**.
> 
> **Fix Applied**: Aliased the field using `ExpressionAttributeNames`:
> ```python
> UpdateExpression="SET #files[:idx].#status = :completed ADD completed :one",
> ConditionExpression="completed < #total",
> ExpressionAttributeNames={
>     "#total": "total",
>     "#status": "status",
>     "#files": "files"
> }
> ```
> Following this fix, the multi-image progress update and ZIP generation completed flawlessly.

---

## 🔐 Security Best Practices

- 🔑 **Presigned Upload URLs**: Direct S3 PUTs using short-lived (15 min) signed URLs.
- 📥 **Presigned Download URLs**: S3 output bucket has `block_public_acls = true` and `block_public_policy = true`. No public object access.
- 🛡️ **Zero Hardcoded Secrets**: Frontend contains zero AWS access keys or secrets.
- ⏱️ **Time-Bound Credentials**: Presigned URLs automatically expire.
- 🔒 **Least-Privilege IAM**: Lambdas only have read/write access to designated S3 prefixes and DynamoDB tables.
- 🧹 **Automatic Data Hygiene**: Input bucket lifecycle rule deletes raw images after 2 days.

---

## 💰 Serverless Cost Model

CloudVision requires **$0/month in idle costs**. All resources operate within the AWS Free Tier:

| Service | Free Tier Allowance | CloudVision Impact |
| :--- | :--- | :--- |
| **AWS Lambda** | 1,000,000 requests / month | ~2 requests per upload batch |
| **Amazon S3** | 5 GB standard storage | Cleaned up via lifecycle policies |
| **API Gateway** | 1,000,000 HTTP API calls / month | Minimal API calls per session |
| **DynamoDB** | 25 GB storage & 25 WCU/RCU | On-demand billing mode, micro-loads |
| **CloudWatch** | 5 GB log ingestion | Free tier logs with retention policy |

---

## 🖥️ Running Locally

The frontend is a modern static web studio with zero npm/node runtime dependencies.

```bash
# Clone the repository
git clone https://github.com/hemanth3007/CloudVision.git
cd CloudVision/frontend
```

Run with any local HTTP server (such as VS Code Live Server, Python HTTP server, or `npx serve`):

```bash
# Using Python
python -m http.server 5500
```

Navigate to:
```text
http://127.0.0.1:5500/index.html
```

---

## 🔗 Backend API Specification

Base Endpoint:
```text
https://j79eb6dc77.execute-api.ap-south-1.amazonaws.com/upload
```

### 1. Initialize Batch & Request Upload URLs
- **Method**: `POST`
- **Body**:
  ```json
  {
    "files": [
      { "fileName": "photo1.jpg", "contentType": "image/jpeg" },
      { "fileName": "photo2.png", "contentType": "image/png" }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "batchId": "6c3a2f90-1e5b-4c28-9d41-3b7c89f01234",
    "uploads": [
      {
        "fileName": "photo1.jpg",
        "key": "6c3a2f90.../uuid.jpg",
        "uploadUrl": "https://cloudvision-input-hk2005.s3.amazonaws.com/..."
      }
    ]
  }
  ```

### 2. Check Batch Status & Progress
- **Method**: `POST`
- **Body**:
  ```json
  {
    "action": "status",
    "batchId": "6c3a2f90-1e5b-4c28-9d41-3b7c89f01234"
  }
  ```

### 3. Fetch Single Output Metadata & Size
- **Method**: `POST`
- **Body**:
  ```json
  {
    "action": "result",
    "key": "6c3a2f90.../uuid.jpg"
  }
  ```

---

## 🏗️ Infrastructure as Code (Terraform)

All infrastructure is codified inside `infrastructure/terraform/`.

```bash
cd infrastructure/terraform

# Initialize Terraform providers
terraform init

# Validate configuration
terraform validate

# Plan deployment
terraform plan

# Apply infrastructure
terraform apply
```

---

## 🚀 Deployment Status

| Component | Layer | Status |
| :--- | :--- | :---: |
| **Amazon API Gateway** | API Routing | 🟢 Deployed & Operational |
| **Upload Lambda** | Backend | 🟢 Deployed & Operational |
| **Processor Lambda** | Image Engine | 🟢 Deployed & Operational |
| **S3 Input Bucket** | Ingestion | 🟢 Active (`ap-south-1`) |
| **S3 Output Bucket** | Artifacts | 🟢 Active (`ap-south-1`) |
| **DynamoDB Batches** | State Engine | 🟢 Active |
| **CloudWatch Metrics** | Monitoring | 🟢 Active |
| **Frontend Studio** | UI | 🟡 Localhost (Production Hosting Next) |

---

## 🌍 Production Deployment Plan

```text
                          🌐 Users / Internet
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   CloudFront    │
                         │   Global CDN    │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   S3 Frontend   │
                         │   Static Host   │
                         └────────┬────────┘
                                  │
                       API Calls  │
                                  ▼
                         ┌─────────────────┐
                         │   API Gateway   │
                         └────────┬────────┘
                                  │
                                  ▼
                         AWS Serverless Core
```

---

## 📈 Project Roadmap & Milestones

- [x] **Phase 1**: Initial Project Setup & Git Repository Initialization
- [x] **Phase 2**: S3 Bucket Infrastructure & Lifecycle Rules
- [x] **Phase 3**: Core Backend & Pillow Processor Implementation
- [x] **Phase 4**: Frontend Integration & Presigned URL Handshake
- [x] **Phase 5**: Production Hardening & Error Handling
- [x] **Phase 6**: Observability, Custom CloudWatch Metrics & Logging
- [x] **Phase 7**: UI Redesign into Modern SaaS Studio Cockpit
- [x] **Phase 8**: Multi-image Batch Processing, In-Memory ZIP Generation & Verification
- [ ] **Phase 9**: Production S3/CloudFront Static Website Hosting & CI/CD Pipeline

---

## 🧰 Technology Stack

- **Cloud Platform**: Amazon Web Services (AWS)
- **Compute**: AWS Lambda (Python 3.14)
- **Storage**: Amazon S3
- **Database**: Amazon DynamoDB
- **API**: Amazon API Gateway (HTTP API)
- **Monitoring**: Amazon CloudWatch
- **Infrastructure as Code**: Terraform (HCL)
- **Image Processing**: Pillow (PIL Fork)
- **Frontend**: HTML5, Modern CSS3 (Glassmorphism), Vanilla ES6+ JavaScript
- **Testing**: Pytest

---

## 💡 What This Project Demonstrates

- **Cloud Native Architecture**: Designing scalable, decoupled systems using serverless building blocks.
- **Event-Driven Workflows**: Triggering computation purely based on storage events.
- **Infrastructure as Code**: Managing cloud resources reproducibly via Terraform.
- **Security-First Mindset**: Presigned URLs, least-privilege IAM roles, and private S3 buckets.
- **State & Asynchronous Operations**: Managing batch states in DynamoDB with atomic updates.
- **Production Debugging**: Diagnosing and overcoming AWS reserved keywords and CORS boundaries.

---

## 🔮 Future Improvements

- [ ] Support for raw camera formats (TIFF, SVG, AVIF)
- [ ] User authentication with Amazon Cognito
- [ ] Configurable compression quality slider in UI
- [ ] Automated CI/CD pipeline with GitHub Actions
- [ ] Edge delivery of frontend via AWS CloudFront with Custom Domain & SSL

---

## 👨‍💻 Author

**Hemanth K**  
*AWS & Cloud Engineering Enthusiast*

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE) for educational and portfolio purposes.

<div align="center">

**⭐ If you find this project useful, consider giving the repository a star!**

Built with ☁️ **AWS** • 🐍 **Python** • 🏗️ **Terraform** • ❤️

</div>
