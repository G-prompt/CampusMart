import multer from "multer";

const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

const storage = multer.memoryStorage();

export const productImageUpload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },

  fileFilter: (_req, file, callback) => {
    if (!allowedImageTypes.includes(file.mimetype)) {
      callback(
        new Error(
          "Only JPG, PNG, WebP and AVIF images are allowed."
        )
      );
      return;
    }

    callback(null, true);
  },
});