const multer = require('multer');
const fs = require('fs');
const path = require('path');
// used for unique file names
const crypto = require('crypto');

// Making sure that the 'uploads' directory exists for the uploaded images
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage engine
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
        cb(null, file.fieldname + '-' + uniqueName + path.extname(file.originalname));
    }
});

// File type checker
function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error, images only');
    }
}

// Upload for single image
const uploadSingle = multer({
    storage: storage,
    limits: { fileSize: 1000000 },
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).single('userImage');

// Upload for multiple (up to 3) images
const uploadMultiple = multer({
    storage: storage,
    limits: { fileSize: 1000000, files: 3 },
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).array('petImages', 3);

module.exports = { uploadSingle, uploadMultiple };