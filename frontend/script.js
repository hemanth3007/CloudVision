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

const downloadButton = document.getElementById("downloadButton");

const errorSection = document.getElementById("errorSection");

const errorMessage = document.getElementById("errorMessage");

const retryButton = document.getElementById("retryButton");

const resetButton = document.getElementById("resetButton");

const API_URL =
  "https://j79eb6dc77.execute-api.ap-south-1.amazonaws.com/upload";

let selectedFile = null;

let selectedInputKey = null;

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

  selectedFile = file;

  showFile(file);

  await uploadImage(file);
});

/*
=================================================
SHOW SELECTED FILE
=================================================
*/

function showFile(file) {
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

  const imageURL = URL.createObjectURL(file);

  preview.src = imageURL;

  fileSection.classList.remove("hidden");

  fileInfo.innerHTML = `
        <strong>${file.name}</strong>
        <br>
        ${sizeMB} MB
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

  statusTitle.textContent = "Preparing your image...";

  statusMessage.textContent = "Requesting a secure upload URL.";

  try {
    /*
        -----------------------------------------
        Determine content type
        -----------------------------------------
        */

    const extension = file.name.split(".").pop().toLowerCase();

    const contentTypeMap = {
      jpg: "image/jpeg",

      jpeg: "image/jpeg",

      png: "image/png",

      webp: "image/webp",
    };

    const contentType = contentTypeMap[extension];

    if (!contentType) {
      throw new Error("Unsupported image format.");
    }

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

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(errorText);
    }

    const data = await response.json();

    console.log("Upload API Response:", data);

    selectedInputKey = data.key;

    /*
        -----------------------------------------
        Upload directly to S3
        -----------------------------------------
        */

    statusTitle.textContent = "Uploading image...";

    statusMessage.textContent = "Securely uploading your image to CloudVision.";

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
      throw new Error("Image upload failed.");
    }

    console.log("Image uploaded successfully!");

    /*
        -----------------------------------------
        Start processing
        -----------------------------------------
        */

    statusTitle.textContent = "Optimizing your image...";

    statusMessage.textContent =
      "CloudVision is reducing the image size while preserving quality.";

    checkProcessing(data.key, file.size);
  } catch (error) {
    console.error("Upload error:", error);

    showError("Unable to upload the image. Please try again.");
  }
}

/*
=================================================
CHECK PROCESSING STATUS
=================================================
*/

async function checkProcessing(inputKey, originalFileSize) {
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

    const data = await response.json();

    console.log("Processing response:", data);

    /*
        -----------------------------------------
        Still processing
        -----------------------------------------
        */

    if (response.status === 202) {
      statusTitle.textContent = "Optimizing your image...";

      statusMessage.textContent = "Almost there. Please wait...";

      setTimeout(
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
      displayResult(data, originalFileSize);

      return;
    }

    throw new Error(data.error || "Image processing failed.");
  } catch (error) {
    console.error("Processing error:", error);

    showError("The image could not be processed. Please try again.");
  }
}

/*
=================================================
DISPLAY RESULT
=================================================
*/

function displayResult(data, originalFileSize) {
  const optimizedFileSize = data.size;

  const reductionValue =
    ((originalFileSize - optimizedFileSize) / originalFileSize) * 100;

  const reductionPercent = reductionValue.toFixed(2);

  /*
    -----------------------------------------
    Hide processing section
    -----------------------------------------
    */

  statusSection.classList.add("hidden");

  /*
    -----------------------------------------
    Show optimized image
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
    Download button
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
ERROR HANDLING
=================================================
*/

function showError(message) {
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
RESET
=================================================
*/

function resetApplication() {
  imageInput.value = "";

  selectedFile = null;

  selectedInputKey = null;

  preview.src = "";

  fileSection.classList.add("hidden");

  statusSection.classList.add("hidden");

  resultSection.classList.add("hidden");

  errorSection.classList.add("hidden");
}

resetButton.addEventListener("click", resetApplication);

retryButton.addEventListener("click", resetApplication);
