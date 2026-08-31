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

  // Show image information and preview
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
    // Get file extension
    const extension = file.name.split(".").pop().toLowerCase();

    // Convert extension to MIME type
    const contentTypeMap = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

    const contentType = contentTypeMap[extension];

    // Check whether the file format is supported
    if (!contentType) {
      throw new Error("Unsupported image format");
    }

    // Step 1: Request presigned URL from API Gateway
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

    // Check API response
    if (!response.ok) {
      const errorText = await response.text();

      console.error("API Error:", errorText);

      throw new Error(errorText);
    }

    // Convert API response to JSON
    const data = await response.json();

    console.log("API Response:", data);

    fileInfo.innerHTML = `
            <strong>${file.name}</strong><br>
            Size: ${sizeMB} MB<br>
            <br>
            Upload URL received!<br>
            Uploading image...
        `;

    // Step 2: Upload image directly to S3
    const uploadResponse = await fetch(data.uploadUrl, {
      method: "PUT",

      headers: {
        "Content-Type": contentType,
      },

      body: file,
    });

    // Check S3 upload response
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
  } catch (error) {
    console.error("Error:", error);

    fileInfo.innerHTML = `
            <strong>${file.name}</strong><br>
            <br>
            Upload failed.
        `;
  }
});
