const { BlobServiceClient } = require("@azure/storage-blob");
const fs = require("fs");
const path = require("path");

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient("raidenimg");

const uploadToAzure = async (file) => {
    try {
        let fileBuffer, fileName;

        if (Buffer.isBuffer(file)) {
            // Direct buffer upload (not typical)
            fileBuffer = file;
            fileName = `file-${Date.now()}.jpg`;

        } else if (file.buffer && file.originalname) {
            // Case: { buffer, originalname, mimetype }
            fileBuffer = file.buffer;
            fileName = `${Date.now()}-${file.originalname}`;

        } else if (file.path) {
            // Case: { path } (e.g., multer)
            fileBuffer = fs.readFileSync(file.path);
            fileName = path.basename(file.path);

        } else {
            throw new Error("Unsupported file format for upload.");
        }

        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        await blockBlobClient.uploadData(fileBuffer, {
            blobHTTPHeaders: {
                blobContentType: file.mimetype || "application/octet-stream",
            },
        });

        return blockBlobClient.url;
    } catch (error) {
        console.error("Azure Upload Error:", error);
        throw error;
    }
};



module.exports = uploadToAzure;