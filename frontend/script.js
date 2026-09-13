const imageInput = document.getElementById("imageInput");
const uploadArea = document.getElementById("uploadArea");
const fileSection = document.getElementById("fileSection");
const preview = document.getElementById("preview");
const fileInfo = document.getElementById("fileInfo");
const statusSection = document.getElementById("statusSection");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const resultSection = document.getElementById("resultSection");
const resultImage = document.getElementById("resultImage");
const originalSize = document.getElementById("originalSize");
const optimizedSize = document.getElementById("optimizedSize");
const reduction = document.getElementById("reduction");
const outputFormat = document.getElementById("outputFormat");
const downloadButton = document.getElementById("downloadButton");
const errorSection = document.getElementById("errorSection");
const errorMessage = document.getElementById("errorMessage");
const retryButton = document.getElementById("retryButton");
const resetButton = document.getElementById("resetButton");

const API_URL =
  "https://j79eb6dc77.execute-api.ap-south-1.amazonaws.com/upload";

let selectedFiles = [];
let selectedInputKeys = [];
let batchId = null;
let previewURL = null;
let processingTimer = null;
let isProcessing = false;

const contentTypeMap = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

uploadArea.addEventListener("dragover", function (event) {
  event.preventDefault();
  uploadArea.classList.add("drag-over");
});

uploadArea.addEventListener("dragleave", function () {
  uploadArea.classList.remove("drag-over");
});

uploadArea.addEventListener("drop", function (event) {
  event.preventDefault();
  uploadArea.classList.remove("drag-over");
  const files = Array.from(event.dataTransfer.files);
  if (!files || files.length === 0) {
    return;
  }
  if (files.length > 3) {
    showError("Please select a maximum of 3 images.");
    return;
  }
  try {
    const dataTransfer = new DataTransfer();
    files.forEach(function (file) {
      dataTransfer.items.add(file);
    });
    imageInput.files = dataTransfer.files;
  } catch (error) {
    console.log("Could not update file input:", error);
  }
  imageInput.dispatchEvent(new Event("change"));
});

imageInput.addEventListener("change", async function () {
  const files = Array.from(imageInput.files);
  if (!files || files.length === 0) {
    return;
  }
  if (files.length > 3) {
    showError("Please select a maximum of 3 images.");
    imageInput.value = "";
    return;
  }
  stopProcessingTimer();
  for (const file of files) {
    const validationError = validateFile(file);
    if (validationError) {
      showError(`${file.name}: ${validationError}`);
      imageInput.value = "";
      return;
    }
  }
  selectedFiles = files;
  selectedInputKeys = [];
  batchId = null;
  isProcessing = true;
  showFiles(files);
  await uploadImages(files);
});

function validateFile(file) {
  if (!file) {
    return "Please select an image.";
  }
  if (file.size === 0) {
    return "The selected file is empty.";
  }
  const extension = file.name.split(".").pop().toLowerCase();
  if (!contentTypeMap[extension]) {
    return "Unsupported image format. Please select a JPG, PNG or WebP image.";
  }
  return null;
}

function showFiles(files) {
  const totalSize = files.reduce(function (total, file) {
    return total + file.size;
  }, 0);
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = null;
  }
  if (files.length > 0) {
    previewURL = URL.createObjectURL(files[0]);
    preview.src = previewURL;
  }
  fileSection.classList.remove("hidden");
  fileInfo.innerHTML = `
    <strong>${files.length} image${files.length > 1 ? "s" : ""} selected</strong>
    <br>
    ${formatFileSize(totalSize)}
    <br>
    ${files.map(function (file) {
      return escapeHTML(file.name);
    }).join("<br>")}
  `;
}

async function uploadImages(files) {
  hideError();
  resultSection.classList.add("hidden");
  statusSection.classList.remove("hidden");
  setStatus(
    "Preparing your images...",
    "Requesting secure upload URLs."
  );
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
        "The server did not return upload URLs for all selected images."
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
      `Uploading ${files.length} image${files.length > 1 ? "s" : ""} to CloudVision.`
    );
    const uploadPromises = files.map(function (file, index) {
      const upload = data.uploads[index];
      const extension = file.name.split(".").pop().toLowerCase();
      const contentType = contentTypeMap[extension];
      return fetch(upload.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: file,
      }).then(async function (uploadResponse) {
        if (!uploadResponse.ok) {
          throw new Error(
            `The image "${file.name}" could not be uploaded to storage.`
          );
        }
        console.log(`Image uploaded successfully: ${file.name}`);
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
      "All images have been uploaded. CloudVision is processing them."
    );
    startBatchPolling();
  } catch (error) {
    console.error("Upload error:", error);
    isProcessing = false;
    showError(getFriendlyError(error));
  }
}

function startBatchPolling() {
  stopProcessingTimer();
  if (!batchId) {
    showError("The batch could not be tracked.");
    return;
  }
  checkBatchStatus();
}

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
    const total = Number(data.total || 0);
    const completed = Number(data.completed || 0);
    if (data.status === "COMPLETED" || completed >= total) {
      isProcessing = false;
      stopProcessingTimer();
      setStatus(
        "Processing complete!",
        `All ${total} image${total > 1 ? "s" : ""} have been optimized successfully.`
      );
      console.log("Batch completed:", data);
      return;
    }
    setStatus(
      "Optimizing your images...",
      `${completed} of ${total} images processed.`
    );
    processingTimer = setTimeout(function () {
      checkBatchStatus();
    }, 2000);
  } catch (error) {
    console.error("Batch status error:", error);
    isProcessing = false;
    stopProcessingTimer();
    showError(getFriendlyError(error));
  }
}

async function checkProcessing(inputKey, originalFileSize) {
  if (!isProcessing) {
    return;
  }
  try {
    console.log("Checking processing status...");
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "result",
        key: inputKey,
      }),
    });
    const data = await readJSON(response);
    console.log("Processing response:", data);
    if (response.status === 202) {
      setStatus(
        "Optimizing your image...",
        "Your image is still being processed."
      );
      processingTimer = setTimeout(function () {
        checkProcessing(inputKey, originalFileSize);
      }, 2000);
      return;
    }
    if (response.ok && data.status === "completed") {
      isProcessing = false;
      displayResult(data, originalFileSize);
      return;
    }
    throw new Error(data.error || "Image processing failed.");
  } catch (error) {
    console.error("Processing error:", error);
    isProcessing = false;
    showError(getFriendlyError(error));
  }
}

function displayResult(data, originalFileSize) {
  stopProcessingTimer();
  statusSection.classList.add("hidden");
  if (!data.downloadUrl || !data.size) {
    showError(
      "The optimized image was created, but the result could not be loaded."
    );
    return;
  }
  const optimizedFileSize = data.size;
  const reductionValue =
    ((originalFileSize - optimizedFileSize) / originalFileSize) * 100;
  const reductionPercent = Math.max(0, reductionValue).toFixed(2);
  resultImage.src = data.downloadUrl;
  originalSize.textContent = formatFileSize(originalFileSize);
  optimizedSize.textContent = formatFileSize(optimizedFileSize);
  reduction.textContent = reductionPercent + "%";
  if (data.key) {
    const extension = data.key.split(".").pop().toUpperCase();
    outputFormat.textContent = extension;
  } else {
    outputFormat.textContent = "Unknown";
  }
  downloadButton.href = data.downloadUrl;
  resultSection.classList.remove("hidden");
}

function setStatus(title, message) {
  statusTitle.textContent = title;
  statusMessage.textContent = message;
}

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
    return "The image upload failed. Please try again.";
  }
  if (message.includes("processing")) {
    return "The image could not be processed. Please try again.";
  }
  return message || "Something went wrong. Please try again.";
}

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

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + " B";
  }
  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + " KB";
  }
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function stopProcessingTimer() {
  if (processingTimer) {
    clearTimeout(processingTimer);
    processingTimer = null;
  }
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function resetApplication() {
  stopProcessingTimer();
  isProcessing = false;
  selectedFiles = [];
  selectedInputKeys = [];
  batchId = null;
  imageInput.value = "";
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = null;
  }
  preview.src = "";
  fileSection.classList.add("hidden");
  statusSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  errorSection.classList.add("hidden");
  outputFormat.textContent = "-";
}

resetButton.addEventListener("click", resetApplication);
retryButton.addEventListener("click", resetApplication);