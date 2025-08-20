const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadImage, uploadMultipleImages, deleteImage } = require('../controllers/upload.controller');
const { auth } = require('../middlewares/auth.middleware');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files for multiple upload
  }
});

const uploadMedia = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for media (images/videos)
    files: 10
  }
});

// @route   POST /api/upload/image
// @desc    Upload single image
// @access  Private
router.post('/image', auth, upload.single('image'), uploadImage);

// @route   POST /api/upload/images
// @desc    Upload multiple images
// @access  Private
router.post('/images', auth, upload.array('images', 10), uploadMultipleImages);

// @route   POST /api/upload/media
// @desc    Upload single image or video
// @access  Private
router.post('/media', auth, uploadMedia.single('media'), uploadImage);

// @route   DELETE /api/upload/image/:publicId
// @desc    Delete image from Cloudinary
// @access  Private
router.delete('/image/:publicId', auth, deleteImage);

module.exports = router; 