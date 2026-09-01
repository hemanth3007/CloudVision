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

/*
=================================================
APPLICATION STATE
=================================================
*/

let selectedFile = null;

let selectedInputKey = null;

let previewURL = null;

let processingTimer = null;

let isProcessing = false;

/*
=================================================
SUPPORTED IMAGE TYPES
=================================================
*/

const contentTypeMap = {
  jpg: "image/jpeg",

  jpeg: "image/jpeg",

  png: "image/png",

  webp: "image/webp",
};

/*
=================================================
IMAGE SELECTION
=================================================
*/

imageInput.addEventListener("change", async function () {
  const file = imageInput.files[0];

  if (!file) {
    return;
  }

  /*
        -----------------------------------------
        Stop previous processing
        -----------------------------------------
        */

  stopProcessingTimer();

  /*
        -----------------------------------------
        Validate file
        -----------------------------------------
        */

  const validationError = validateFile(file);

  if (validationError) {
    showError(validationError);

    imageInput.value = "";

    return;
  }

  /*
        -----------------------------------------
        Store file
        -----------------------------------------
        */

  selectedFile = file;

  isProcessing = true;

  /*
        -----------------------------------------
        Show preview
        -----------------------------------------
        */

  showFile(file);

  /*
        -----------------------------------------
        Upload
        -----------------------------------------
        */

  await uploadImage(file);
});

/*
=================================================
FILE VALIDATION
=================================================
*/

function validateFile(file) {
  if (!file) {
    return "Please select an image.";
  }

  if (file.size === 0) {
    return "The selected file is empty.";
  }

  const extension = file.name.split(".").pop().toLowerCase();

  if (!contentTypeMap[extension]) {
    return (
      "Unsupported image format. " + "Please select a JPG, PNG or WebP image."
    );
  }

  return null;
}

/*
=================================================
SHOW SELECTED FILE
=================================================
*/

function showFile(file) {
  const size = formatFileSize(file.size);

  /*
    -----------------------------------------
    Clean previous preview URL
    -----------------------------------------
    */

  if (previewURL) {
    URL.revokeObjectURL(previewURL);
  }

  previewURL = URL.createObjectURL(file);

  preview.src = previewURL;

  fileSection.classList.remove("hidden");

  fileInfo.innerHTML = `
        <strong>${escapeHTML(file.name)}</strong>
        <br>
        ${size}
    `;
}

/*
=================================================
UPLOAD IMAGE
=================================================
*/

async function uploadImage(file) {
  hideError();

  resultSection.classList.add("hidden");

  statusSection.classList.remove("hidden");

  setStatus("Preparing your image...", "Requesting a secure upload URL.");

  try {
    /*
        -----------------------------------------
        Determine extension
        -----------------------------------------
        */

    const extension = file.name.split(".").pop().toLowerCase();

    const contentType = contentTypeMap[extension];

    /*
        -----------------------------------------
        Request presigned URL
        -----------------------------------------
        */

    const response = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        fileName: file.name,

        contentType: contentType,
      }),
    });

    const data = await readJSON(response);

    if (!response.ok) {
      throw new Error(data.error || "Unable to prepare the upload.");
    }

    console.log("Upload API Response:", data);

    selectedInputKey = data.key;

    /*
        -----------------------------------------
        Upload directly to S3
        -----------------------------------------
        */

    setStatus(
      "Uploading image...",
      "Securely uploading your image to CloudVision.",
    );

    const uploadResponse = await fetch(
      data.uploadUrl,

      {
        method: "PUT",

        headers: {
          "Content-Type": contentType,
        },

        body: file,
      },
    );

    if (!uploadResponse.ok) {
      throw new Error("The image could not be uploaded to storage.");
    }

    console.log("Image uploaded successfully!");

    /*
        -----------------------------------------
        Start processing
        -----------------------------------------
        */

    setStatus(
      "Optimizing your image...",
      "CloudVision is reducing the image size while preserving quality.",
    );

    checkProcessing(data.key, file.size);
  } catch (error) {
    console.error("Upload error:", error);

    isProcessing = false;

    showError(getFriendlyError(error));
  }
}

/*
=================================================
CHECK PROCESSING STATUS
=================================================
*/

async function checkProcessing(inputKey, originalFileSize) {
  /*
    -----------------------------------------
    Safety check
    -----------------------------------------
    */

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

    /*
        -----------------------------------------
        Still processing
        -----------------------------------------
        */

    if (response.status === 202) {
      setStatus(
        "Optimizing your image...",
        "Your image is still being processed.",
      );

      processingTimer = setTimeout(
        function () {
          checkProcessing(inputKey, originalFileSize);
        },

        2000,
      );

      return;
    }

    /*
        -----------------------------------------
        Processing complete
        -----------------------------------------
        */

    if (response.ok && data.status === "completed") {
      isProcessing = false;

      displayResult(data, originalFileSize);

      return;
    }

    /*
        -----------------------------------------
        Backend error
        -----------------------------------------
        */

    throw new Error(data.error || "Image processing failed.");
  } catch (error) {
    console.error("Processing error:", error);

    isProcessing = false;

    showError(getFriendlyError(error));
  }
}

/*
=================================================
DISPLAY RESULT
=================================================
*/

function displayResult(data, originalFileSize) {
  stopProcessingTimer();

  statusSection.classList.add("hidden");

  /*
    -----------------------------------------
    Validate result
    -----------------------------------------
    */

  if (!data.downloadUrl || !data.size) {
    showError(
      "The optimized image was created, but the result could not be loaded.",
    );

    return;
  }

  const optimizedFileSize = data.size;

  /*
    -----------------------------------------
    Calculate reduction
    -----------------------------------------
    */

  const reductionValue =
    ((originalFileSize - optimizedFileSize) / originalFileSize) * 100;

  const reductionPercent = Math.max(0, reductionValue).toFixed(2);

  /*
    -----------------------------------------
    Display optimized image
    -----------------------------------------
    */

  resultImage.src = data.downloadUrl;

  /*
    -----------------------------------------
    Display statistics
    -----------------------------------------
    */

  originalSize.textContent = formatFileSize(originalFileSize);

  optimizedSize.textContent = formatFileSize(optimizedFileSize);

  reduction.textContent = reductionPercent + "%";

  /*
    -----------------------------------------
    Output format
    -----------------------------------------
    */

  if (data.key) {
    const extension = data.key.split(".").pop().toUpperCase();

    outputFormat.textContent = extension;
  } else {
    outputFormat.textContent = "Unknown";
  }

  /*
    -----------------------------------------
    Download
    -----------------------------------------
    */

  downloadButton.href = data.downloadUrl;

  /*
    -----------------------------------------
    Show result
    -----------------------------------------
    */

  resultSection.classList.remove("hidden");
}

/*
=================================================
STATUS
=================================================
*/

function setStatus(title, message) {
  statusTitle.textContent = title;

  statusMessage.textContent = message;
}

/*
=================================================
ERROR HANDLING
=================================================
*/

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

/*
=================================================
FRIENDLY ERROR MESSAGE
=================================================
*/

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

/*
=================================================
READ JSON SAFELY
=================================================
*/

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

/*
=================================================
FORMAT FILE SIZE
=================================================
*/

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return bytes + " B";
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + " KB";
  }

  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/*
=================================================
STOP PROCESSING TIMER
=================================================
*/

function stopProcessingTimer() {
  if (processingTimer) {
    clearTimeout(processingTimer);

    processingTimer = null;
  }
}

/*
=================================================
ESCAPE HTML
=================================================
*/

function escapeHTML(value) {
  const div = document.createElement("div");

  div.textContent = value;

  return div.innerHTML;
}

/*
=================================================
RESET APPLICATION
=================================================
*/

function resetApplication() {
  stopProcessingTimer();

  isProcessing = false;

  selectedFile = null;

  selectedInputKey = null;

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

/*
=================================================
BUTTONS
=================================================
*/

resetButton.addEventListener("click", resetApplication);

retryButton.addEventListener("click", resetApplication);
