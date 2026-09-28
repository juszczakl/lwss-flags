// -----------------------------------------
// LWSS FLAG ACTIVITY
// Participant Upload Page
// -----------------------------------------

// Connect to Supabase using the values in config.js
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// Page elements
const photoInput = document.getElementById("flagPhoto");
const previewArea = document.getElementById("previewArea");
const previewImage = document.getElementById("previewImage");
const submitButton = document.getElementById("submitButton");
const retakeButton = document.getElementById("retakeButton");
const statusMessage = document.getElementById("statusMessage");
const nameInput = document.getElementById("name");

let selectedFile = null;
let previewURL = null;


// -----------------------------------------
// PHOTO SELECTED
// -----------------------------------------

photoInput.addEventListener("change", function () {

  const file = photoInput.files?.[0];

  if (!file) {
    return;
  }

  // Make sure an image was selected
  if (!file.type.startsWith("image/")) {
    showStatus("Please choose a photo of your flag.", true);
    resetPhoto();
    return;
  }

  selectedFile = file;

  // Remove the previous preview URL if there was one
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
  }

  previewURL = URL.createObjectURL(file);

  previewImage.src = previewURL;

  previewArea.hidden = false;
  retakeButton.hidden = false;
  submitButton.hidden = false;
  submitButton.disabled = false;

  showStatus("");
});


// -----------------------------------------
// RETAKE / CHOOSE ANOTHER PHOTO
// -----------------------------------------

retakeButton.addEventListener("click", function () {

  resetPhoto();

  photoInput.click();

});


// -----------------------------------------
// SUBMIT FLAG
// -----------------------------------------

submitButton.addEventListener("click", async function () {

  if (!selectedFile) {
    showStatus("Please choose a photo first.", true);
    return;
  }

  submitButton.disabled = true;
  retakeButton.disabled = true;
  photoInput.disabled = true;

  showStatus("Preparing your flag...");

  try {

    // Resize and convert the photo before uploading
    const processedImage = await prepareImage(selectedFile);

    showStatus("Uploading your flag...");

    // Simple storage-safe filename
    const fileName = `flag-${Date.now()}.jpg`;

    // Upload image to the public "flags" bucket
    const { error: uploadError } = await supabaseClient.storage
      .from("flags")
      .upload(fileName, processedImage, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    showStatus("Finishing your submission...");

    // Optional participant name
    const firstName = nameInput.value.trim();

    // Save submission information to the database
    const { error: databaseError } = await supabaseClient
      .from("submissions")
      .insert([
        {
          name: firstName || null,
          image_path: fileName
        }
      ]);

    if (databaseError) {
      throw databaseError;
    }

    // Success
    showStatus(
      "Your flag was submitted! Watch for it in the stadium."
    );

    submitButton.hidden = true;
    retakeButton.hidden = true;
    photoInput.disabled = true;
    nameInput.disabled = true;

  } catch (error) {

    console.error("LWSS flag submission error:", error);

    showStatus(
      "We couldn't submit your flag. Please try again.",
      true
    );

    submitButton.disabled = false;
    retakeButton.disabled = false;
    photoInput.disabled = false;
  }

});


// -----------------------------------------
// IMAGE PREPARATION
// -----------------------------------------

async function prepareImage(file) {

  const image = await loadImage(file);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  // Temporary standard flag image size.
  // Later we will replace this with the automatic
  // worksheet-marker crop/straightening system.
  const outputWidth = 1200;
  const outputHeight = 700;

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const imageRatio = image.width / image.height;
  const outputRatio = outputWidth / outputHeight;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  // Center-crop while maintaining proportions
  if (imageRatio > outputRatio) {

    sourceWidth = image.height * outputRatio;
    sourceX = (image.width - sourceWidth) / 2;

  } else {

    sourceHeight = image.width / outputRatio;
    sourceY = (image.height - sourceHeight) / 2;

  }

  // White background
  context.fillStyle = "#ffffff";
  context.fillRect(
    0,
    0,
    outputWidth,
    outputHeight
  );

  // Draw resized image
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  // Convert canvas to JPEG
  const blob = await canvasToBlob(canvas);

  return blob;
}


// -----------------------------------------
// LOAD IMAGE
// -----------------------------------------

function loadImage(file) {

  return new Promise(function (resolve, reject) {

    const image = new Image();
    const imageURL = URL.createObjectURL(file);

    image.onload = function () {

      URL.revokeObjectURL(imageURL);

      resolve(image);
    };

    image.onerror = function () {

      URL.revokeObjectURL(imageURL);

      reject(
        new Error("The selected photo could not be read.")
      );
    };

    image.src = imageURL;

  });

}


// -----------------------------------------
// CANVAS TO JPEG
// -----------------------------------------

function canvasToBlob(canvas) {

  return new Promise(function (resolve, reject) {

    canvas.toBlob(
      function (blob) {

        if (blob) {
          resolve(blob);
        } else {
          reject(
            new Error("The photo could not be processed.")
          );
        }

      },
      "image/jpeg",
      0.9
    );

  });

}


// -----------------------------------------
// RESET PHOTO
// -----------------------------------------

function resetPhoto() {

  selectedFile = null;

  photoInput.value = "";

  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = null;
  }

  previewImage.removeAttribute("src");

  previewArea.hidden = true;
  retakeButton.hidden = true;

  submitButton.hidden = false;
  submitButton.disabled = true;

  showStatus("");
}


// -----------------------------------------
// STATUS MESSAGE
// -----------------------------------------

function showStatus(message, isError = false) {

  statusMessage.textContent = message;

  if (isError) {
    statusMessage.setAttribute("data-error", "true");
  } else {
    statusMessage.removeAttribute("data-error");
  }

}
