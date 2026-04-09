const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** Upload a Buffer to Cloudinary. Returns the result object (secure_url, public_id, …). */
function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ resource_type: 'image', ...options }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      })
      .end(buffer);
  });
}

/**
 * Delete an image from Cloudinary given its URL.
 * Silently ignores non-Cloudinary URLs (local /uploads/ paths, external URLs, null).
 */
async function deleteByUrl(url) {
  if (!url || !url.includes('cloudinary.com')) return;
  try {
    // URL: https://res.cloudinary.com/{cloud}/image/upload/v123456/{public_id}.ext
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (match) await cloudinary.uploader.destroy(match[1]);
  } catch (err) {
    console.warn('[Cloudinary] Error al eliminar imagen:', err.message);
  }
}

module.exports = { uploadBuffer, deleteByUrl };
