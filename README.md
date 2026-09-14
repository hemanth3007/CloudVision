<div align="center">

# 🚀 CloudVision

<p align="center">
  <img src="https://img.shields.io/badge/AWS-Serverless-orange?style=for-the-badge&logo=amazon-aws" alt="AWS Serverless">
  <img src="https://img.shields.io/badge/Python-3.14-blue?style=for-the-badge&logo=python" alt="Python">
  <img src="https://img.shields.io/badge/Terraform-IaC-7B42BC?style=for-the-badge&logo=terraform" alt="Terraform">
  <img src="https://img.shields.io/badge/GitHub-Actions-2088FF?style=for-the-badge&logo=github-actions" alt="GitHub Actions">
  <img src="https://img.shields.io/badge/Tests-7%20Passed-success?style=for-the-badge&logo=pytest" alt="Tests">
</p>

### **A production-style serverless image optimization platform built on AWS.**

Upload up to **3 images** → Process them independently → Track real-time progress → Download optimized images or a complete ZIP archive.

<p>
  <a href="https://d28272gnmhhti1.cloudfront.net">
    <img src="https://img.shields.io/badge/Live%20Demo-CloudFront-FF9900?style=for-the-badge&logo=amazon-aws" alt="Live Demo">
  </a>
  <a href="https://github.com/hemanth3007/CloudVision/actions">
    <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=for-the-badge&logo=github-actions" alt="CI/CD">
  </a>
</p>

> [!NOTE]
> **Live Deployment:** CloudVision is fully deployed and operational in AWS region `ap-south-1`, with the frontend delivered through Amazon CloudFront.

</div>

---

## 📑 Table of Contents

- [✨ Project Highlights](#-project-highlights)
- [🎯 What is CloudVision?](#-what-is-cloudvision)
- [🏗️ Architecture](#️-architecture)
- [🔄 How It Works](#-how-it-works)
- [☁️ AWS Services Used](#️-aws-services-used)
- [🔐 Security Architecture](#-security-architecture)
- [🗂️ Data Lifecycle](#️-data-lifecycle)
- [⚙️ Configuration](#️-configuration)
- [📁 Project Structure](#-project-structure)
- [🧪 Testing](#-testing)
- [🐛 Production Bug Solved](#-production-bug-solved)
- [🚀 CI/CD Pipeline](#-cicd-pipeline)
- [🏗️ Infrastructure as Code](#️-infrastructure-as-code)
- [🌐 Deployment](#-deployment)
- [💰 Cost Model](#-cost-model)
- [🖥️ Running Locally](#️-running-locally)
- [🔗 Backend API](#-backend-api)
- [🧰 Technology Stack](#-technology-stack)
- [📈 Project Milestones](#-project-milestones)
- [💡 What This Project Demonstrates](#-what-this-project-demonstrates)
- [🔮 Future Improvements](#-future-improvements)
- [👨‍💻 Author](#-author)
- [📄 License](#-license)

---

## ✨ Project Highlights

| Feature                            | Status | Description                                                    |
| :--------------------------------- | :----: | :------------------------------------------------------------- |
| 🖼️ **Multi-Image Upload**          |   ✅   | Select and upload up to 3 images concurrently                  |
| ⚡ **Serverless Image Processing** |   ✅   | AWS Lambda + Pillow for resizing and compression               |
| 📊 **Batch Progress Tracking**     |   ✅   | Real-time per-file and batch processing state                  |
| 🗜️ **Automatic ZIP Generation**    |   ✅   | Packages completed images into a ZIP archive                   |
| 📥 **Individual Downloads**        |   ✅   | Secure presigned download URLs                                 |
| 📦 **Batch ZIP Download**          |   ✅   | Download the complete processed batch                          |
| 🔐 **Presigned S3 URLs**           |   ✅   | Direct browser-to-S3 uploads without exposing buckets publicly |
| 🧪 **Automated Testing**           |   ✅   | Backend test suite with **7 / 7 tests passing**                |
| 🏗️ **Infrastructure as Code**      |   ✅   | AWS infrastructure managed using Terraform                     |
| 📈 **CloudWatch Observability**    |   ✅   | Structured logs and custom operational metrics                 |
| 🌐 **CloudFront Deployment**       |   ✅   | HTTPS frontend delivery through Amazon CloudFront              |
| 🔄 **GitHub Actions CI/CD**        |   ✅   | Automatic frontend deployment on pushes to `main`              |
| 🧹 **Automatic Data Cleanup**      |   ✅   | S3 lifecycle rules and DynamoDB TTL                            |

---

## 🎯 What is CloudVision?

**CloudVision** is a cloud-native image optimization platform designed around a real-world, event-driven AWS serverless architecture.

The project demonstrates how an image-processing workload can be distributed across managed AWS services instead of relying on a traditional always-running backend server.

### Core design principles

**1. Direct Client Upload**

The browser uploads images directly to Amazon S3 using short-lived presigned URLs.

**2. Event-Driven Processing**

S3 object creation events trigger the image-processing Lambda automatically.

**3. Stateless Processing**

Each uploaded image can be processed independently by the serverless processing layer.

**4. Asynchronous Batch Tracking**

DynamoDB maintains batch-level and per-file processing state while the frontend polls for progress.

**5. Secure Artifact Delivery**

Processed images remain private in S3 and are accessed through short-lived presigned GET URLs.

**6. Automatic Data Lifecycle**

Temporary input data, batch metadata, and processed artifacts are automatically cleaned up according to their retention policies.

---

## 🏗️ Architecture

```text
                         ┌──────────────────────────┐
                         │          USER            │
                         │       Web Browser        │
                         └────────────┬─────────────┘
                                      │
                                   HTTPS
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │       CLOUDFRONT         │
                         │      Global CDN + TLS    │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │      S3 FRONTEND         │
                         │     HTML / CSS / JS      │
                         └──────────────────────────┘


Browser
   │
   │ POST /upload
   ▼
┌──────────────────────────┐
│      API GATEWAY         │
│        HTTP API          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│      UPLOAD LAMBDA       │
│ cloudvision-upload-image │
│                          │
│ • Create batch           │
│ • Generate presigned URL │
│ • Initialize DynamoDB    │
└────────────┬─────────────┘
             │
       Presigned PUT
             │
             ▼
┌──────────────────────────┐
│       S3 INPUT           │
│ cloudvision-input-...    │
│                          │
│     Original Images      │
└────────────┬─────────────┘
             │
        ObjectCreated
             │
             ▼
┌──────────────────────────┐
│    PROCESSOR LAMBDA      │
│   CloudVisionProcessor   │
│                          │
│        Pillow            │
│ • EXIF correction        │
│ • Resize                 │
│ • Compression            │
│ • Format optimization    │
└────────────┬─────────────┘
             │
       ┌─────┴──────┐
       │            │
       ▼            ▼
┌──────────────┐ ┌────────────────────┐
│  S3 OUTPUT   │ │     DYNAMODB       │
│              │ │                    │
│ Processed    │ │ Batch metadata     │
│ Images       │ │ Progress / Status  │
│ ZIP Archive  │ │ File metadata      │
└──────┬───────┘ └────────────────────┘
       │
       │ Presigned GET
       ▼
┌──────────────────────────┐
│          USER            │
│ Image / ZIP Download     │
└──────────────────────────┘
```

### Architecture diagrams

Detailed architecture diagrams are available in:

```text
docs/architecture/
```

---

## 🔄 How It Works

### 1️⃣ Image Selection

The user selects up to **3 images** using the CloudVision frontend.

Supported input formats include:

```text
JPG / JPEG
PNG
WebP
```

---

### 2️⃣ Batch Initialization

The frontend sends file metadata to the API Gateway `/upload` endpoint.

The Upload Lambda:

- Creates a unique `batchId`
- Generates presigned S3 `PUT` URLs
- Initializes the DynamoDB batch record
- Returns the upload information to the browser

---

### 3️⃣ Direct-to-S3 Upload

The browser uploads each image directly to the input bucket.

```text
Browser
   │
   │ Presigned PUT
   ▼
S3 Input Bucket
```

This avoids sending image payloads through API Gateway or Lambda.

---

### 4️⃣ Event-Driven Processing

When an image arrives in the input bucket, an S3 event triggers:

```text
CloudVisionProcessor
```

The processor:

- Reads the image
- Corrects EXIF orientation
- Resizes oversized images
- Generates optimized image candidates
- Selects an efficient output
- Stores the processed image in the output bucket

---

### 5️⃣ Real-Time Batch Tracking

DynamoDB tracks processing progress.

Example:

```text
0 / 3
  ↓
1 / 3
  ↓
2 / 3
  ↓
3 / 3
  ↓
COMPLETED
```

The frontend polls the batch status and updates the UI accordingly.

---

### 6️⃣ ZIP Generation

When all images in a batch finish processing:

```text
Processed Images
       │
       ▼
In-Memory ZIP
       │
       ▼
S3 Output Bucket
```

The ZIP object key is stored in DynamoDB.

---

### 7️⃣ Secure Download

The frontend requests temporary presigned GET URLs.

Users can download:

- Individual processed images
- The complete ZIP archive

The output bucket remains private.

---

## ☁️ AWS Services Used

| AWS Service               | Role                                                          |
| :------------------------ | :------------------------------------------------------------ |
| 🪣 **Amazon S3**          | Frontend hosting, input image storage and processed artifacts |
| ⚡ **AWS Lambda**         | Upload orchestration and image processing                     |
| 🌐 **Amazon API Gateway** | HTTP API for frontend/backend communication                   |
| 🗄️ **Amazon DynamoDB**    | Batch state, progress tracking and metadata                   |
| 🌍 **Amazon CloudFront**  | HTTPS and global delivery for the frontend                    |
| 📊 **Amazon CloudWatch**  | Logs, metrics and operational observability                   |
| 🔐 **AWS IAM**            | Least-privilege service and deployment permissions            |
| 🏗️ **Terraform**          | Infrastructure as Code                                        |
| 🔄 **GitHub Actions**     | Automated frontend CI/CD                                      |
| 🔑 **GitHub OIDC**        | Keyless GitHub-to-AWS authentication                          |
| 🖼️ **Pillow**             | Image decoding, resizing and optimization                     |

---

## 🔐 Security Architecture

CloudVision follows several security-first design principles.

### 🔑 Presigned URLs

Images are uploaded directly to S3 using short-lived presigned URLs.

```text
Browser
   │
   │ Temporary signed URL
   ▼
Private S3 Bucket
```

No AWS credentials are exposed to the browser.

---

### 🔒 Private S3 Storage

The input and output buckets are not publicly accessible.

Processed files are downloaded through temporary presigned URLs.

---

### 🛡️ Least-Privilege IAM

Lambda execution roles are restricted to the AWS resources required by each function.

The GitHub Actions deployment role is separately restricted to:

- Frontend S3 deployment
- CloudFront invalidation

---

### 🔐 GitHub OIDC

GitHub Actions does not use long-lived AWS access keys.

Instead:

```text
GitHub Actions
      │
      │ OIDC token
      ▼
AWS IAM
      │
      ▼
Temporary AWS credentials
```

The IAM trust policy restricts deployment access to the CloudVision `main` branch.

---

### ⏱️ Temporary Access

Presigned upload and download URLs expire automatically.

This limits the lifetime of temporary access to stored objects.

---

## 🗂️ Data Lifecycle

CloudVision intentionally treats uploaded data as temporary.

| Data                     | Storage   |   Retention    |
| :----------------------- | :-------- | :------------: |
| Original uploaded images | Input S3  |   **2 days**   |
| Batch metadata           | DynamoDB  | **2 days TTL** |
| Processed images / ZIP   | Output S3 |  **20 days**   |

```text
             USER UPLOAD
                  │
                  ▼
          ┌───────────────┐
          │   INPUT S3    │
          │   2 DAYS      │
          └───────┬───────┘
                  │
                  ▼
          PROCESSING LAMBDA
                  │
          ┌───────┴────────┐
          ▼                ▼
   ┌─────────────┐   ┌──────────────┐
   │  OUTPUT S3  │   │   DYNAMODB   │
   │   20 DAYS   │   │    2 DAYS    │
   └─────────────┘   └──────────────┘
```

The output retention period is a cleanup/safety window and is **not intended to provide permanent user history**.

---

## ⚙️ Configuration

### AWS Configuration

| Parameter                   | Value                         |
| :-------------------------- | :---------------------------- |
| **AWS Region**              | `ap-south-1`                  |
| **Frontend Bucket**         | `cloudvision-frontend-hk2005` |
| **Input Bucket**            | `cloudvision-input-hk2005`    |
| **Output Bucket**           | `cloudvision-output-hk2005`   |
| **Processor Lambda**        | `CloudVisionProcessor`        |
| **Upload Lambda**           | `cloudvision-upload-image`    |
| **DynamoDB Table**          | `CloudVisionBatches`          |
| **CloudFront Distribution** | `E136IR91GKFPST`              |
| **Maximum Batch Size**      | `3 images`                    |

---

### Image Processing Configuration

| Setting               | Value         |
| :-------------------- | :------------ |
| **JPEG Quality**      | `85`          |
| **WebP Quality**      | `85`          |
| **Maximum Dimension** | `1600 px`     |
| **Processor Memory**  | `512 MB`      |
| **Processor Timeout** | `30 seconds`  |
| **Runtime**           | `Python 3.14` |
| **Architecture**      | `x86_64`      |

---

## 📁 Project Structure

```text
CloudVision/
│
├── .github/
│   └── workflows/
│       └── frontend-deploy.yml
│
├── backend/
│   ├── lambda/
│   │   ├── processor/
│   │   │   └── cloudvision_processor.py
│   │   │
│   │   └── upload/
│   │       └── cloudvision_upload.py
│   │
│   ├── requirements/
│   │   └── processor.txt
│   │
│   └── tests/
│       └── test_processor.py
│
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
│
├── infrastructure/
│   └── terraform/
│       ├── .terraform.lock.hcl
│       ├── api_gateway.tf
│       ├── dynamodb.tf
│       ├── iam.tf
│       ├── lambda.tf
│       ├── provider.tf
│       └── s3.tf
│
├── docs/
│   └── architecture/
│       ├── 01-system-architecture.png
│       ├── 02-upload-processing-flow.png
│       ├── 03-aws-infrastructure.png
│       ├── 04-ci-cd-pipeline.png
│       └── 05-data-lifecycle.png
│
├── .gitignore
└── README.md
```

> Local Terraform state, provider cache, test cache and other generated files are excluded through `.gitignore`.

---

## 🧪 Testing

CloudVision uses **Pytest** for backend image-processing validation.

Run the test suite:

```bash
pytest .\backend\tests\test_processor.py -v
```

### Current Result

```text
7 passed
```

Test coverage includes:

| Test                        | Result |
| :-------------------------- | :----: |
| Image resizing              |   ✅   |
| Small image handling        |   ✅   |
| EXIF orientation correction |   ✅   |
| JPEG optimization           |   ✅   |
| PNG optimization            |   ✅   |
| WebP optimization           |   ✅   |
| Invalid image handling      |   ✅   |

### End-to-End Verification

| Scenario                         | Result |
| :------------------------------- | :----: |
| Single-image processing          |   ✅   |
| Two-image batch                  |   ✅   |
| Three-image batch                |   ✅   |
| JPG/JPEG input                   |   ✅   |
| PNG input                        |   ✅   |
| WebP input                       |   ✅   |
| S3 event triggering              |   ✅   |
| DynamoDB progress tracking       |   ✅   |
| Individual downloads             |   ✅   |
| ZIP generation                   |   ✅   |
| ZIP download                     |   ✅   |
| Frontend reset state             |   ✅   |
| Production CloudFront deployment |   ✅   |
| GitHub Actions deployment        |   ✅   |

---

## 🐛 Production Bug Solved

During multi-image processing, the processor initially generated the output image successfully but failed while updating DynamoDB.

### Error

```text
ValidationException:
Syntax error; token: "total"
```

### Root Cause

`total` is a DynamoDB reserved keyword.

### Solution

The DynamoDB expression was changed to use `ExpressionAttributeNames`:

```python
ExpressionAttributeNames = {
    "#total": "total",
    "#status": "status",
    "#files": "files"
}
```

This allowed the processor to safely reference the reserved attribute name.

### Result

After the fix:

```text
Image Processing
       ↓
DynamoDB Progress Update
       ↓
All Images Completed
       ↓
ZIP Generation
       ↓
Download
```

The complete multi-image workflow passed end-to-end verification.

---

## 🚀 CI/CD Pipeline

CloudVision uses **GitHub Actions + AWS OIDC** for automated frontend deployment.

### Deployment Flow

```text
Developer
    │
    │ git push origin main
    ▼
GitHub Repository
    │
    ▼
GitHub Actions
    │
    │ OIDC Authentication
    ▼
AWS IAM
    │
    │ Temporary Credentials
    ▼
S3 Frontend Bucket
    │
    ▼
CloudFront Invalidation
    │
    ▼
Live Website
```

### Workflow

The deployment workflow is located at:

```text
.github/workflows/frontend-deploy.yml
```

Every push to `main`:

1. Checks out the repository
2. Authenticates with AWS using OIDC
3. Synchronizes `frontend/` with the S3 frontend bucket
4. Removes obsolete frontend files
5. Invalidates the CloudFront cache

### Deployment Command

```bash
aws s3 sync frontend/ s3://cloudvision-frontend-hk2005 --delete
```

### CloudFront Invalidation

```bash
aws cloudfront create-invalidation \
  --distribution-id E136IR91GKFPST \
  --paths "/*"
```

### CI/CD Verification

A frontend UI change was pushed to `main` and successfully propagated through:

```text
GitHub
  ↓
GitHub Actions
  ↓
AWS OIDC
  ↓
S3
  ↓
CloudFront
  ↓
Live Website
```

---

## 🏗️ Infrastructure as Code

Terraform configuration is maintained under:

```text
infrastructure/terraform/
```

### Main Terraform Components

```text
api_gateway.tf
dynamodb.tf
iam.tf
lambda.tf
provider.tf
s3.tf
```

### Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

### Validate

```bash
terraform validate
```

### Preview Changes

```bash
terraform plan
```

### Apply Infrastructure

```bash
terraform apply
```

Terraform state and generated provider files are intentionally excluded from Git tracking.

---

## 🌐 Deployment

### Frontend

The production frontend is hosted using:

```text
Amazon S3
     ↓
Amazon CloudFront
     ↓
HTTPS
```

### Live Demo

**CloudVision Production Frontend:**

https://d28272gnmhhti1.cloudfront.net

### Backend

The frontend communicates with:

```text
Amazon API Gateway
        ↓
Upload Lambda
        ↓
S3 + DynamoDB
        ↓
Processor Lambda
```

The backend is deployed in:

```text
ap-south-1
```

---

## 💰 Cost Model

CloudVision uses a predominantly serverless architecture, meaning there is no traditional always-running application server.

The main AWS services are usage-based:

| Service         | Usage Pattern                         |
| :-------------- | :------------------------------------ |
| **AWS Lambda**  | Per invocation and execution duration |
| **Amazon S3**   | Storage and request based             |
| **API Gateway** | API request based                     |
| **DynamoDB**    | On-demand request based               |
| **CloudFront**  | Data transfer and request based       |
| **CloudWatch**  | Logs and metrics                      |
| **IAM**         | No direct charge                      |

Actual cost depends on AWS account eligibility, Free Tier status, traffic, storage and usage.

Lifecycle policies reduce unnecessary storage accumulation by automatically deleting temporary data.

---

## 🖥️ Running Locally

CloudVision's frontend is a static application with no Node.js runtime dependency.

### Clone

```bash
git clone https://github.com/hemanth3007/CloudVision.git
cd CloudVision
```

### Run Frontend

```bash
cd frontend
python -m http.server 5500
```

Open:

```text
http://127.0.0.1:5500
```

The local frontend can communicate with the deployed backend API because the required CORS origins are configured for local development.

---

## 🔗 Backend API

### Base Endpoint

```text
https://j79eb6dc77.execute-api.ap-south-1.amazonaws.com/upload
```

### Initialize Upload Batch

**POST**

```text
/upload
```

Example request:

```json
{
  "files": [
    {
      "fileName": "photo1.jpg",
      "contentType": "image/jpeg"
    },
    {
      "fileName": "photo2.png",
      "contentType": "image/png"
    }
  ]
}
```

The response contains:

- `batchId`
- Presigned upload URLs
- Object keys

---

### Check Batch Status

**POST**

```json
{
  "action": "status",
  "batchId": "batch-uuid"
}
```

Used by the frontend to track:

```text
Pending
Processing
Completed
Failed
```

---

### Fetch Result Metadata

**POST**

```json
{
  "action": "result",
  "key": "processed-object-key"
}
```

Returns information required for secure artifact retrieval.

---

## 🧰 Technology Stack

### Cloud

- **Amazon Web Services**
- AWS Lambda
- Amazon S3
- Amazon API Gateway
- Amazon DynamoDB
- Amazon CloudFront
- Amazon CloudWatch
- AWS IAM

### Backend

- Python 3.14
- Pillow
- Boto3
- Pytest

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript
- Responsive SaaS-style UI

### Infrastructure

- Terraform
- GitHub Actions
- GitHub OIDC

---

## 📈 Project Milestones

- [x] **Phase 1** — Initial project setup and Git repository
- [x] **Phase 2** — S3 infrastructure
- [x] **Phase 3** — Core backend and Pillow processor
- [x] **Phase 4** — Frontend integration and presigned URLs
- [x] **Phase 5** — Production hardening and error handling
- [x] **Phase 6** — Observability and CloudWatch metrics
- [x] **Phase 7** — Frontend architecture and project structure
- [x] **Phase 8** — Multi-image processing and ZIP generation
- [x] **Phase 9** — CloudFront deployment and GitHub Actions CI/CD

### 🏁 Project Status

**CloudVision is fully deployed and operational.**

---

## 💡 What This Project Demonstrates

### ☁️ Cloud-Native Architecture

Designing an application around managed AWS services instead of traditional always-running servers.

### ⚡ Event-Driven Computing

Using S3 events to trigger asynchronous image-processing workloads.

### 🏗️ Infrastructure as Code

Managing AWS resources through Terraform for reproducible infrastructure.

### 🔐 Security

Applying:

- Presigned URLs
- Private S3 buckets
- Least-privilege IAM
- GitHub OIDC
- Temporary credentials

### 📊 Distributed State Management

Using DynamoDB for asynchronous batch and per-file progress tracking.

### 🔄 CI/CD

Implementing automated deployment from GitHub to AWS using GitHub Actions.

### 🐛 Production Debugging

Diagnosing real AWS issues involving:

- DynamoDB reserved keywords
- CORS configuration
- S3 permissions
- CloudFront caching
- GitHub OIDC trust policies

### 🧹 Data Lifecycle Management

Using S3 lifecycle policies and DynamoDB TTL to prevent unnecessary long-term storage.

---

## 🔮 Future Improvements

- [ ] User authentication with Amazon Cognito
- [ ] Configurable image quality controls
- [ ] Additional formats such as AVIF and TIFF
- [ ] Larger batch sizes
- [ ] Custom domain with Amazon Route 53
- [ ] Automated backend Lambda deployment through CI/CD
- [ ] Automated Terraform deployment pipeline
- [ ] Background job queue using Amazon SQS
- [ ] More advanced image optimization strategies
- [ ] CloudFront security headers and additional edge optimizations

---

## 👨‍💻 Author

<div align="center">

### **Hemanth K**

**AWS & Cloud Engineering Enthusiast**

Building cloud-native applications with  
☁️ **AWS** • 🐍 **Python** • 🏗️ **Terraform** • 🔄 **CI/CD**

</div>

---

## 📄 License

This project is open source and available under the MIT License for educational and portfolio purposes.

---

<div align="center">

### ⭐ If you find CloudVision useful, consider giving the repository a star!

**Built with ☁️ AWS • 🐍 Python • 🏗️ Terraform • 🔄 GitHub Actions**

</div>
