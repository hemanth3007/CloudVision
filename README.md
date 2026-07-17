# CloudVision

> A serverless image preprocessing pipeline built on AWS using S3, Lambda, API Gateway, and DynamoDB.

CloudVision is a cloud-native application that automatically processes images uploaded by users. The project leverages AWS serverless services to create a scalable, event-driven image processing pipeline capable of resizing, compressing, converting image formats, and storing metadata—all while remaining within the AWS Free Tier.

This project is being developed to demonstrate practical cloud engineering skills, serverless architecture, event-driven workflows, and Infrastructure as Code concepts.

---

## 🚀 Features

- Upload images through a web interface
- Automatic image preprocessing using AWS Lambda
- Event-driven architecture with Amazon S3
- Store processed images in a separate S3 bucket
- Maintain processing metadata using DynamoDB
- REST API using Amazon API Gateway
- CloudWatch logging and monitoring
- Secure IAM roles following the Principle of Least Privilege
- Infrastructure as Code (planned)
- CI/CD pipeline (planned)

---

## 🏗️ High-Level Architecture

```
                 User
                   │
                   ▼
           React Frontend
                   │
                   ▼
             API Gateway
                   │
                   ▼
                Lambda
                   │
                   ▼
        Upload Image to Amazon S3
                   │
          S3 Event Notification
                   │
                   ▼
        Image Processing Lambda
             │              │
             │              ▼
             │         DynamoDB
             │
             ▼
   Processed Images Bucket
                   │
                   ▼
              Download Image
```

---

## 🛠️ Tech Stack

### Cloud Services

- Amazon S3
- AWS Lambda
- Amazon API Gateway
- Amazon DynamoDB
- Amazon CloudWatch
- AWS IAM

### Backend

- Python
- Pillow (Image Processing)
- Boto3

### Frontend

- React
- HTML
- CSS
- JavaScript

### DevOps & Tools

- Git
- GitHub
- VS Code
- AWS CLI

---

## 📁 Project Structure

```
CloudVision/
│
├── backend/
│   ├── lambda/
│   ├── requirements/
│   └── tests/
│
├── frontend/
│
├── infrastructure/
│
├── docs/
│   ├── architecture/
│   └── screenshots/
│
├── .gitignore
└── README.md
```

### Folder Description

| Folder         | Purpose                                               |
| -------------- | ----------------------------------------------------- |
| backend        | AWS Lambda source code and backend logic              |
| frontend       | React application                                     |
| infrastructure | Infrastructure as Code templates and deployment files |
| docs           | Architecture diagrams, screenshots, and documentation |

---

## 🎯 Project Objectives

- Learn AWS serverless architecture
- Build an event-driven cloud application
- Understand secure IAM practices
- Gain experience with cloud storage and APIs
- Build a production-ready portfolio project
- Stay within AWS Free Tier

---

## 🗺️ Development Roadmap

- [x] Project Setup
- [ ] AWS Foundation
- [ ] S3 Buckets
- [ ] Lambda Function
- [ ] Image Processing
- [ ] Event Notifications
- [ ] DynamoDB Integration
- [ ] API Gateway
- [ ] React Frontend
- [ ] CloudWatch Monitoring
- [ ] Security Improvements
- [ ] Infrastructure as Code
- [ ] CI/CD Pipeline
- [ ] Deployment
- [ ] Documentation

---

## 📚 Learning Goals

This project focuses on understanding:

- Event-driven architecture
- Serverless computing
- Cloud storage
- Image processing
- REST APIs
- Cloud security
- Monitoring and logging
- Infrastructure automation

---

## 📄 License

This project is developed for educational and portfolio purposes.
