const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const photoInput = document.getElementById("flagPhoto");
const previewArea = document.getElementById("previewArea");
const previewImage = document.getElementById("previewImage");
const submitButton = document.getElementById("submitButton");
const retakeButton = document.getElementById("retakeButton");
const statusMessage = document.getElementById("statusMessage");
const nameInput = document.getElementById("name");

let selectedFile = null;

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];

  if (!file) return;

  selectedFile = file;

  const previewURL = URL.createObjectURL(file);
  previewImage.src = previewURL;

  previewArea.hidden = false;
  retakeButton.hidden = false;
  submitButton.disabled = false;

  statusMessage.textContent = "";
});

retakeButton.addEventListener("click", () => {
  photoInput.value = "";
  selectedFile = null;

  previewArea.hidden = true;
  retakeButton.hidden = true;
  submitButton.disabled = true;

  statusMessage.textContent = "";

  photoInput.click();
});

submitButton.addEventListener("click", async () => {
  if (!selectedFile) return;

  submitButton.disabled = true;
  retakeButton.disabled = true;

  statusMessage.textContent = "Submitting your flag...";

  try {
    const processedImage = await prepareImage(selectedFile);

    // Simple Supabase-safe filename
    const fileName = `flag-${Date.now()}.jpg`;

    const { error: uploadError } = await supabaseClient.storage
      .from("flags")
      .upload(fileName, processedImage, {
        contentType: "image/jpeg",
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const firstName = nameInput.value.trim();

    const { error: databaseError } = await supabaseClient
      .from("submissions")
      .insert({
        name: firstName || null,
        image_path: fileName
      });

    if (databaseError) {
      throw databaseError;
    }

    statusMessage.textContent =
      "Your flag was submitted! Watch for it in the stadium.";

    submitButton.hidden = true;
    retakeButton.hidden = true;
    photoInput.disabled = true;
    nameInput.disabled = true;

  } catch (error) {
    console.error("Flag submission error:", error);

    statusMessage.textContent =
      "We couldn't submit your flag. Please try again.";

    submitButton.disabled = false;
    retakeButton.disabled = false;
  }
});

async function prepareImage(file) {
  const image = await loadImage(file);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const targetWidth = 1200;
  const targetHeight = 700;

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const sourceRatio = image.width / image.height;
  const targetRatio = targetWidth / targetHeight;

  let sourceWidth;
  let sourceHeight;
  let sourceX;
  let sourceY;

  if (sourceRatio > targetRatio) {
    sourceHeight = image.height;
    sourceWidth = sourceHeight * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
    sourceY = 0;
  } else {
    sourceWidth = image.width;
    sourceHeight = sourceWidth / targetRatio;
    sourceX = 0;
    sourceY = (image.height - sourceHeight) / 2;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not process image."));
        }
      },
      "image/jpeg",
      0.9
    );
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };

    image.src = url;
  });
}
