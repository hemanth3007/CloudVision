const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const fileInfo = document.getElementById("fileInfo");

const API_URL =
  "https://j79eb6dc77.execute-api.ap-south-1.amazonaws.com/upload";

imageInput.addEventListener("change", async function () {
  const file = imageInput.files[0];

  if (!file) {
    return;
  }

  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

  fileInfo.innerHTML = `
        <strong>${file.name}</strong><br>
        Size: ${sizeMB} MB<br>
        <br>
        Requesting upload URL...
    `;

  const imageURL = URL.createObjectURL(file);

  preview.src = imageURL;
  preview.style.display = "block";

  try {
    // -----------------------------------------
    // Step 1: Determine content type
    // -----------------------------------------

    const extension = file.name.split(".").pop().toLowerCase();

    const contentTypeMap = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

    const contentType = contentTypeMap[extension];

    if (!contentType) {
      throw new Error("Unsupported image format");
    }

    // -----------------------------------------
    // Step 2: Request presigned upload URL
    // -----------------------------------------

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

      console.error("API Error:", errorText);

      throw new Error(errorText);
    }

    const data = await response.json();

    console.log("Upload API Response:", data);

    fileInfo.innerHTML = `
            <strong>${file.name}</strong><br>
            Size: ${sizeMB} MB<br>
            <br>
            Upload URL received!<br>
            Uploading image...
        `;

    // -----------------------------------------
    // Step 3: Upload directly to S3
    // -----------------------------------------

    const uploadResponse = await fetch(data.uploadUrl, {
      method: "PUT",

      headers: {
        "Content-Type": contentType,
      },

      body: file,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();

      console.error("S3 Upload Error:", errorText);

      throw new Error("Image upload failed");
    }

    console.log("Image uploaded successfully!");

    fileInfo.innerHTML = `
            <strong>${file.name}</strong><br>
            Size: ${sizeMB} MB<br>
            <br>
            Image uploaded successfully!<br>
            Processing image...
        `;

    // -----------------------------------------
    // Step 4: Check processing status
    // -----------------------------------------

    checkProcessing(data.key, file.size);
  } catch (error) {
    console.error("Error:", error);

    fileInfo.innerHTML = `
            <strong>${file.name}</strong><br>
            <br>
            Upload failed.
        `;
  }
});

// =================================================
// Check whether optimized image is ready
// =================================================

async function checkProcessing(inputKey, originalSize) {
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

    // -----------------------------------------
    // Still processing
    // -----------------------------------------

    if (response.status === 202) {
      fileInfo.innerHTML = `
                <strong>Processing image...</strong><br>
                Please wait.
            `;

      setTimeout(function () {
        checkProcessing(inputKey, originalSize);
      }, 2000);

      return;
    }

    // -----------------------------------------
    // Processing completed
    // -----------------------------------------

    if (response.ok && data.status === "completed") {
      displayResult(data, originalSize);

      return;
    }

    throw new Error(data.error || "Processing failed");
  } catch (error) {
    console.error("Processing error:", error);

    fileInfo.innerHTML = `
            <strong>Processing failed.</strong><br>
            Please try again.
        `;
  }
}

// =================================================
// Display optimized image
// =================================================

function displayResult(data, originalSize) {
  const optimizedSize = data.size;

  const reduction = ((originalSize - optimizedSize) / originalSize) * 100;

  const reductionPercent = reduction.toFixed(2);

  preview.src = data.downloadUrl;

  preview.style.display = "block";

  fileInfo.innerHTML = `
        <strong>Optimization Complete!</strong>
        <br><br>

        Original Size:
        ${(originalSize / (1024 * 1024)).toFixed(2)} MB

        <br>

        Optimized Size:
        ${(optimizedSize / (1024 * 1024)).toFixed(2)} MB

        <br>

        Storage Reduction:
        ${reductionPercent}%

        <br><br>

        <a
            href="${data.downloadUrl}"
            download
            target="_blank"
        >
            Download Optimized Image
        </a>
    `;
}
