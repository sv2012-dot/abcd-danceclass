const express    = require('express');
const router     = express.Router();
const { auth }   = require('../middleware/auth');
const cloudinary = require('../../config/cloudinary');

// POST /api/upload/image
// Accepts a base64 data URL, uploads to Cloudinary, returns the public https:// URL.
// Credentials are read from CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET env vars.
router.post('/image', auth(), async (req, res) => {
  const { data } = req.body;
  if (!data || !data.startsWith('data:image/')) {
    return res.status(400).json({ error: 'data must be a base64 image data URL' });
  }
  try {
    const result = await cloudinary.uploader.upload(data, {
      folder:        'recital-posters',
      resource_type: 'image',
      transformation: [
        { width: 1200, height: 630, crop: 'fill', quality: 'auto:good', fetch_format: 'auto' },
      ],
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
