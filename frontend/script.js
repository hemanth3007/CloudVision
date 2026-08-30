const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("preview");
const fileInfo = document.getElementById("fileInfo");

imageInput.addEventListener("change", function () {

    const file = imageInput.files[0];

    if (!file) {
        return;
    }

    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

    fileInfo.innerHTML = `
        <strong>${file.name}</strong><br>
        Size: ${sizeMB} MB
    `;

    const imageURL = URL.createObjectURL(file);

    preview.src = imageURL;
    preview.style.display = "block";
});