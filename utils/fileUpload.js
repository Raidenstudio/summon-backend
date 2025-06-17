const multer = require("multer");
 
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads");
    },
    filename: function (req, file, cb) {
        cb(
            null,
            new Date().toISOString().replace(/:/g, "-") + "-" + file.originalname
        );
    },
});
 
// Accept all file types
function fileFilter(req, file, cb) {
    cb(null, true);
}
 
const upload = multer({ storage, fileFilter });
 
module.exports = upload;