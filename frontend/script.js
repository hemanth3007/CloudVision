const API_URL =
  "https://j79eb6dc77.execute-api.ap-south-1.amazonaws.com/upload";
const imageInput = document.getElementById("imageInput");
const uploadArea = document.getElementById("uploadArea");
const fileSection = document.getElementById("fileSection");
const previewGrid = document.getElementById("previewGrid");
const fileInfo = document.getElementById("fileInfo");
const batchProgress = document.getElementById("batchProgress");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");
const fileStatusList = document.getElementById("fileStatusList");
const statusSection = document.getElementById("statusSection");
const statusIcon = document.getElementById("statusIcon");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const resultSection = document.getElementById("resultSection");
const resultTitle = document.getElementById("resultTitle");
const resultDescription = document.getElementById("resultDescription");
const resultImageGrid = document.getElementById("resultImageGrid");
const processedCount = document.getElementById("processedCount");
const totalOriginalSize = document.getElementById("totalOriginalSize");
const outputFormats = document.getElementById("outputFormats");
const batchDownloads = document.getElementById("batchDownloads");
const errorSection = document.getElementById("errorSection");
const errorMessage = document.getElementById("errorMessage");
const resetButton = document.getElementById("resetButton");
const retryButton = document.getElementById("retryButton");

const contentTypeMap = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

let selectedFiles = [];
let selectedInputKeys = [];
let batchId = null;
let isProcessing = false;
let processingTimer = null;
let previewURLs = [];
let resultCards = new Map();

/* FILE INPUT */
imageInput.addEventListener("change", function () {
  handleFiles(Array.from(imageInput.files || []));
});

/* DRAG AND DROP */
uploadArea.addEventListener("dragover", function (event) {
  event.preventDefault();
  uploadArea.classList.add("dragover");
});
uploadArea.addEventListener("dragleave", function () {
  uploadArea.classList.remove("dragover");
});
uploadArea.addEventListener("drop", function (event) {
  event.preventDefault();
  uploadArea.classList.remove("dragover");
  handleFiles(Array.from(event.dataTransfer.files || []));
});

/* BUTTONS */
resetButton.addEventListener("click", resetApplication);
retryButton.addEventListener("click", resetApplication);
/* HANDLE FILES */
function handleFiles(files) {
  hideError();
  const validationError = validateFiles(files);
  if (validationError) {
    showError(validationError);
    return;
  }
  selectedFiles = files;
  resetProcessingState();
  showFiles(files);
  createResultCards(files);
  uploadImages(files);
}

/* VALIDATE FILES */
function validateFiles(files) {
  if (!files.length) {
    return "Please select at least one image.";
  }
  if (files.length > 3) {
    return "Please select a maximum of 3 images.";
  }
  for (const file of files) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (!contentTypeMap[extension]) {
      return (
        "Unsupported image format. " + "Please select a JPG, PNG or WebP image."
      );
    }
  }
  return null;
}

/* SHOW SELECTED FILES */
function showFiles(files) {
  const totalSize = files.reduce(function (total, file) {
    return total + file.size;
  }, 0);
  revokePreviewURLs();
  previewGrid.innerHTML = "";
  files.forEach(function (file) {
    const previewURL = URL.createObjectURL(file);
    previewURLs.push(previewURL);
    const card = document.createElement("div");
    card.className = "preview-card";
    const image = document.createElement("img");
    image.src = previewURL;
    image.alt = file.name;
    const body = document.createElement("div");
    body.className = "preview-card-body";
    const name = document.createElement("div");
    name.className = "preview-card-name";
    name.textContent = file.name;
    const size = document.createElement("div");
    size.className = "preview-card-size";
    size.textContent = formatFileSize(file.size);
    body.appendChild(name);
    body.appendChild(size);
    card.appendChild(image);
    card.appendChild(body);
    previewGrid.appendChild(card);
  });
  fileInfo.textContent =
    files.length +
    " image" +
    (files.length > 1 ? "s" : "") +
    " selected • " +
    formatFileSize(totalSize) +
    " total";
  fileSection.classList.remove("hidden");
  batchProgress.classList.remove("hidden");
  updateProgress(0, files.length);
  createFileStatusRows(files);
}

/* FILE STATUS ROWS */
function createFileStatusRows(files) {
  fileStatusList.innerHTML = "";
  files.forEach(function (file, index) {
    const row = document.createElement("div");
    row.className = "file-status-item";
    row.dataset.index = String(index);
    const name = document.createElement("span");
    name.className = "file-status-name";
    name.textContent = file.name;
    const value = document.createElement("span");
    value.className = "file-status-value";
    value.textContent = "Waiting";
    row.appendChild(name);
    row.appendChild(value);
    fileStatusList.appendChild(row);
  });
}

/* UPDATE FILE STATUS */
function setFileStatus(index, status) {
  const row = fileStatusList.querySelector(
    `.file-status-item[data-index="${index}"]`,
  );
  if (!row) {
    return;
  }
  const value = row.querySelector(".file-status-value");
  if (!value) {
    return;
  }
  value.textContent = status;
}

/* CREATE RESULT CARDS */
function createResultCards(files) {
  resultCards.clear();
  resultImageGrid.innerHTML = "";
  files.forEach(function (file, index) {
    const card = document.createElement("div");
    card.className = "result-image-card";
    const image = document.createElement("img");
    image.alt = file.name;
    const body = document.createElement("div");
    body.className = "result-card-body";
    const header = document.createElement("div");
    header.className = "result-card-header";
    const name = document.createElement("span");
    name.className = "result-file-name";
    name.textContent = file.name;
    name.title = file.name;
    const status = document.createElement("span");
    status.className = "result-file-status processing-label";
    status.textContent = "Processing...";
    const format = document.createElement("div");
    format.className = "result-file-format";
    format.textContent = "CloudVision is processing this image";
    header.appendChild(name);
    header.appendChild(status);
    body.appendChild(header);
    body.appendChild(format);
    card.appendChild(image);
    card.appendChild(body);
    resultImageGrid.appendChild(card);
    resultCards.set(index, {
      card: card,
      image: image,
      body: body,
      header: header,
      name: name,
      status: status,
      format: format,
    });
  });
  resultSection.classList.remove("hidden");
  resultTitle.textContent = "Processing Your Images";
  resultDescription.textContent =
    "Each image will become available for download as soon as processing finishes.";
  batchDownloads.classList.add("hidden");
  batchDownloads.innerHTML = "";
}

/* UPDATE INDIVIDUAL RESULT CARD */
function updateResultCard(index, fileData) {
  const cardData = resultCards.get(index);
  if (!cardData) {
    return;
  }
  const status = String(fileData.status || "").toUpperCase();

  /* COMPLETED */
  if (status === "COMPLETED" && fileData.downloadUrl) {
    cardData.image.src = fileData.downloadUrl;
    cardData.status.className = "result-file-status completed-label";
    cardData.status.textContent = "✓ Completed";
    const outputKey = fileData.outputKey || fileData.key || "";
    const extension = getExtension(outputKey);
    const sizeNote = fileData.optimizedSize
      ? " • " + formatFileSize(fileData.optimizedSize)
      : " • Ready to download";
    cardData.format.textContent = extension
      ? extension + sizeNote
      : (fileData.optimizedSize ? formatFileSize(fileData.optimizedSize) : "Ready to download");
    const oldButton = cardData.header.querySelector(".card-download-button");
    if (oldButton) {
      oldButton.remove();
    }
    const downloadButton = document.createElement("a");
    downloadButton.className = "card-download-button";
    downloadButton.href = fileData.downloadUrl;
    downloadButton.target = "_blank";
    downloadButton.rel = "noopener noreferrer";
    downloadButton.textContent = "Download";
    downloadButton.title = "Download " + getDisplayFileName(fileData, index);
    cardData.header.appendChild(downloadButton);
    return;
  }

  /* PROCESSING */
  if (status === "PROCESSING") {
    cardData.status.className = "result-file-status processing-label";
    cardData.status.textContent = "Processing...";
    cardData.format.textContent = "CloudVision is optimizing this image";
    return;
  }
  /* PENDING */
  if (status === "PENDING") {
    cardData.status.className = "result-file-status processing-label";
    cardData.status.textContent = "Waiting...";
    cardData.format.textContent = "Waiting for processing";
    return;
  }
  /* FAILED */
  if (status === "FAILED" || status === "ERROR") {
    cardData.status.className = "result-file-status processing-label";
    cardData.status.textContent = "Failed";
    cardData.format.textContent = "This image could not be processed";
  }
}

/* PROGRESS */
function updateProgress(completed, total) {
  const safeTotal = Math.max(0, total);
  const safeCompleted = Math.min(Math.max(0, completed), safeTotal);
  const percent =
    safeTotal === 0 ? 0 : Math.round((safeCompleted / safeTotal) * 100);
  progressText.textContent =
    safeCompleted +
    " of " +
    safeTotal +
    " image" +
    (safeTotal === 1 ? "" : "s") +
    " processed";
  progressPercent.textContent = percent + "%";
  progressFill.style.width = percent + "%";
  processedCount.textContent = safeCompleted + "/" + safeTotal;
}

/* UPLOAD IMAGES */
async function uploadImages(files) {
  hideError();
  isProcessing = true;
  statusSection.classList.remove("hidden");
  statusIcon.textContent = "⏳";
  setStatus("Preparing your images...", "Requesting secure upload URLs.");
  try {
    const fileRequests = files.map(function (file) {
      const extension = file.name.split(".").pop().toLowerCase();
      return {
        fileName: file.name,
        contentType: contentTypeMap[extension],
      };
    });
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: fileRequests,
      }),
    });
    const data = await readJSON(response);
    if (!response.ok) {
      throw new Error(data.error || "Unable to prepare the uploads.");
    }
    if (!data.uploads || data.uploads.length !== files.length) {
      throw new Error(
        "The server did not return upload URLs for all selected images.",
      );
    }
    batchId = data.batchId;
    if (!batchId) {
      throw new Error("The server did not return a batch ID.");
    }
    console.log("Upload API Response:", data);
    selectedInputKeys = data.uploads.map(function (upload) {
      return upload.key;
    });
    setStatus(
      "Uploading images...",
      "Uploading " +
        files.length +
        " image" +
        (files.length > 1 ? "s" : "") +
        " to CloudVision.",
    );
    const uploadPromises = files.map(function (file, index) {
      const upload = data.uploads[index];
      const extension = file.name.split(".").pop().toLowerCase();
      const contentType = contentTypeMap[extension];
      setFileStatus(index, "Uploading");
      return fetch(upload.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: file,
      }).then(function (uploadResponse) {
        if (!uploadResponse.ok) {
          throw new Error(
            `The image "${file.name}" could not be uploaded to storage.`,
          );
        }
        setFileStatus(index, "Uploaded");
        console.log("Image uploaded successfully:", file.name);
        return {
          fileName: file.name,
          key: upload.key,
        };
      });
    });
    const uploadResults = await Promise.all(uploadPromises);
    console.log("All images uploaded successfully:", uploadResults);
    console.log("Uploaded input keys:", selectedInputKeys);
    setStatus(
      "Optimizing your images...",
      "All images have been uploaded. CloudVision is processing them.",
    );
    startBatchPolling();
  } catch (error) {
    console.error("Upload error:", error);
    isProcessing = false;
    showError(getFriendlyError(error));
  }
}

/* START BATCH POLLING */
function startBatchPolling() {
  stopProcessingTimer();
  if (!batchId) {
    showError("The batch could not be tracked.");
    return;
  }
  checkBatchStatus();
}

/* CHECK BATCH STATUS */
async function checkBatchStatus() {
  if (!isProcessing || !batchId) {
    return;
  }
  try {
    console.log("Checking batch status:", batchId);
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "status",
        batchId: batchId,
      }),
    });
    const data = await readJSON(response);
    console.log("Batch status response:", data);
    if (!response.ok) {
      throw new Error(data.error || "Unable to check batch status.");
    }
    const total = Number(data.total || selectedFiles.length || 0);
    const completed = Number(data.completed || 0);
    const files = Array.isArray(data.files) ? data.files : [];
    /* Update progress */
    updateProgress(completed, total);
    /* Update individual statuses */
    updateBatchFileStatuses(files);
    /* Update individual result cards */
    files.forEach(function (fileData) {
      const index = findSelectedFileIndex(fileData);
      if (index !== -1) {
        updateResultCard(index, fileData);
      }
    });
    /* Update summary */
    updateResultSummary(files, completed, total);
    /* Entire batch complete */
    if (data.status === "COMPLETED" || (total > 0 && completed >= total)) {
      isProcessing = false;
      stopProcessingTimer();
      updateProgress(total, total);
      updateBatchFileStatuses(files);
      setStatus(
        "Processing complete!",
        "All " +
          total +
          " image" +
          (total > 1 ? "s" : "") +
          " have been optimized successfully.",
      );
      statusIcon.textContent = "✓";
      statusSection.classList.add("hidden");
      resultTitle.textContent = "Optimization Complete";
      resultDescription.textContent =
        "Your images are ready. Download each image individually or download the complete batch as a ZIP file.";
      updateResultSummary(files, total, total);
      updateZipDownload(data);
      if (!data.zipDownloadUrl && batchId) {
        pollForZip(batchId, 8);
      }
      console.log("Batch completed:", data);
      return;
    }
    /* Continue polling */
    setStatus(
      "Optimizing your images...",
      completed +
        " of " +
        total +
        " image" +
        (total > 1 ? "s" : "") +
        " processed.",
    );
    processingTimer = setTimeout(checkBatchStatus, 2000);
  } catch (error) {
    console.error("Batch status error:", error);
    isProcessing = false;
    stopProcessingTimer();
    showError(getFriendlyError(error));
  }
}

/* UPDATE BATCH FILE STATUSES */

function updateBatchFileStatuses(files) {
  files.forEach(function (fileData) {
    const index = findSelectedFileIndex(fileData);
    if (index === -1) {
      return;
    }
    const status = String(fileData.status || "").toUpperCase();
    if (status === "COMPLETED") {
      setFileStatus(index, "✓ Completed");
    } else if (status === "PROCESSING") {
      setFileStatus(index, "Processing");
    } else if (status === "PENDING") {
      setFileStatus(index, "Waiting");
    } else if (status === "FAILED" || status === "ERROR") {
      setFileStatus(index, "Failed");
    }
  });
}

/* UPDATE RESULT SUMMARY */
function fetchFileSizes(files, completed, total) {
  if (!Array.isArray(files) || files.length === 0) return;
  files.forEach(function (fileData) {
    const status = String(fileData.status || "").toUpperCase();
    const key = fileData.key || fileData.inputKey || "";
    if (status === "COMPLETED" && key && !fileData.optimizedSize && !fileData._fetchingSize) {
      fileData._fetchingSize = true;
      fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "result",
          key: key,
        }),
      })
        .then(function (res) {
          return readJSON(res);
        })
        .then(function (resData) {
          fileData._fetchingSize = false;
          if (resData && resData.size) {
            fileData.optimizedSize = Number(resData.size);
            const index = findSelectedFileIndex(fileData);
            if (index !== -1 && resultCards.has(index)) {
              const cardData = resultCards.get(index);
              const outputKey = fileData.outputKey || resData.key || fileData.key || "";
              const ext = getExtension(outputKey);
              if (cardData.format) {
                cardData.format.textContent = (ext ? ext + " • " : "") + formatFileSize(fileData.optimizedSize);
              }
            }
            updateResultSummary(files, completed, total);
          }
        })
        .catch(function (err) {
          fileData._fetchingSize = false;
          console.error("Size fetch error:", err);
        });
    }
  });
}
function updateResultSummary(files, completed, total) {
  processedCount.textContent = completed + "/" + total;
  if (Array.isArray(files)) {
    fetchFileSizes(files, completed, total);
  }
  let totalOptimized = 0;
  let hasOptimizedData = false;
  if (Array.isArray(files)) {
    files.forEach(function (fileData) {
      const optSize = Number(
        fileData.optimizedSize ||
        fileData.outputSize ||
        fileData.size ||
        fileData.finalSize ||
        0
      );
      if (optSize > 0) {
        totalOptimized += optSize;
        hasOptimizedData = true;
      }
    });
  }
  if (hasOptimizedData && totalOptimized > 0) {
    totalOriginalSize.textContent = formatFileSize(totalOptimized);
  } else if (completed > 0) {
    totalOriginalSize.textContent = "Calculating...";
  } else {
    totalOriginalSize.textContent = "-";
  }
  const formats = new Set();
  files.forEach(function (fileData) {
    const status = String(fileData.status || "").toUpperCase();
    if (status !== "COMPLETED") {
      return;
    }
    const outputKey = fileData.outputKey || fileData.key || "";
    const extension = getExtension(outputKey);
    if (extension) {
      formats.add(extension);
    }
  });
  outputFormats.textContent =
    formats.size > 0 ? Array.from(formats).join(", ") : "-";
}

/* POLL FOR ZIP DOWNLOAD */
function pollForZip(bId, attemptsLeft) {
  if (attemptsLeft <= 0 || !bId) {
    return;
  }
  setTimeout(async function () {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "status",
          batchId: bId,
        }),
      });
      const data = await readJSON(response);
      if (data && data.zipDownloadUrl) {
        updateZipDownload(data);
      } else {
        pollForZip(bId, attemptsLeft - 1);
      }
    } catch (err) {
      console.error("ZIP polling error:", err);
    }
  }, 1200);
}

/* ZIP DOWNLOAD */
function updateZipDownload(data) {
  batchDownloads.innerHTML = "";
  if (!data || !data.zipDownloadUrl) {
    batchDownloads.classList.add("hidden");
    return;
  }
  const zipButton = document.createElement("a");
  zipButton.className = "zip-download-link";
  zipButton.href = data.zipDownloadUrl;
  zipButton.target = "_blank";
  zipButton.rel = "noopener noreferrer";
  zipButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;margin-right:6px;vertical-align:middle;">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
    <span>Download ZIP</span>
  `;
  batchDownloads.appendChild(zipButton);
  batchDownloads.classList.remove("hidden");
}

/* FIND SELECTED FILE INDEX */
function findSelectedFileIndex(fileData) {
  const fileName = getFileName(fileData);
  const key = fileData.key || fileData.inputKey || "";
  if (key) {
    const keyIndex = selectedInputKeys.indexOf(key);
    if (keyIndex !== -1) {
      return keyIndex;
    }
  }
  if (fileName) {
    const fileIndex = selectedFiles.findIndex(function (file) {
      return file.name === fileName;
    });
    if (fileIndex !== -1) {
      return fileIndex;
    }
  }
  return -1;
}

/* GET FILE NAME */
function getFileName(fileData) {
  return fileData.fileName || fileData.filename || fileData.name || "";
}

/* GET DISPLAY FILE NAME */
function getDisplayFileName(fileData, index) {
  return getFileName(fileData) || selectedFiles[index]?.name || "image";
}

/* GET FILE EXTENSION */
function getExtension(key) {
  if (!key || !key.includes(".")) {
    return "";
  }
  return key.split(".").pop().toUpperCase();
}

/* SET STATUS */
function setStatus(title, message) {
  statusTitle.textContent = title;
  statusMessage.textContent = message;
}

/* ERROR HANDLING */
function showError(message) {
  stopProcessingTimer();
  isProcessing = false;
  statusSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  errorMessage.textContent = message;
  errorSection.classList.remove("hidden");
}
function hideError() {
  errorSection.classList.add("hidden");
}

/* FRIENDLY ERROR */
function getFriendlyError(error) {
  const message = error?.message || "";
  if (message.includes("Failed to fetch")) {
    return (
      "Unable to contact CloudVision. " +
      "Please check your internet connection and try again."
    );
  }
  if (message.includes("Unsupported image")) {
    return message;
  }
  if (message.includes("upload")) {
    return "The image upload failed. " + "Please try again.";
  }
  if (message.includes("processing")) {
    return "The image could not be processed. " + "Please try again.";
  }
  return message || "Something went wrong. Please try again.";
}

/* READ JSON */
async function readJSON(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text,
    };
  }
}

/* FORMAT FILE SIZE */
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + " B";
  }
  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + " KB";
  }
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/* STOP PROCESSING TIMER */
function stopProcessingTimer() {
  if (processingTimer) {
    clearTimeout(processingTimer);
    processingTimer = null;
  }
}

/* REVOKE PREVIEW URLS */
function revokePreviewURLs() {
  previewURLs.forEach(function (url) {
    URL.revokeObjectURL(url);
  });
  previewURLs = [];
}

/* RESET PROCESSING STATE */
function resetProcessingState() {
  stopProcessingTimer();
  isProcessing = false;
  batchId = null;
  selectedInputKeys = [];
}

/* RESET APPLICATION */
function resetApplication() {
  stopProcessingTimer();
  isProcessing = false;
  selectedFiles = [];
  selectedInputKeys = [];
  batchId = null;
  resultCards.clear();
  imageInput.value = "";
  revokePreviewURLs();
  previewGrid.innerHTML = "";
  fileInfo.textContent = "";
  fileStatusList.innerHTML = "";
  resultImageGrid.innerHTML = "";
  batchDownloads.innerHTML = "";
  progressFill.style.width = "0%";
  progressText.textContent = "0 of 0 images processed";
  progressPercent.textContent = "0%";
  processedCount.textContent = "0/0";
  totalOriginalSize.textContent = "-";
  outputFormats.textContent = "-";
  fileSection.classList.add("hidden");
  batchProgress.classList.add("hidden");
  statusSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  batchDownloads.classList.add("hidden");
  errorSection.classList.add("hidden");
  uploadArea.classList.remove("dragover");
}