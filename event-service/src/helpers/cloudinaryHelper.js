const cloudinary = require("../config/cloudinary");

const uploadToCloudinary = async (filePath) => {
  console.log(' go upload');
  
  try {
    const result = await cloudinary.uploader.upload(filePath);

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error("Error while uploading to cloudinary", error);
    throw new Error("Error while uploading to cloudinary");
  }
};

module.exports = {
  uploadToCloudinary,
};
