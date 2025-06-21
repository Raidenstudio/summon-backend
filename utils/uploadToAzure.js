const { BlobServiceClient } = require("@azure/storage-blob");
const fs = require("fs");
const path = require("path"); 
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient("raidenimg");
 
const uploadToAzure = async (file) => {
    try {
        let filePath;
 
        if (Buffer.isBuffer(file)) {
            filePath = path.join(__dirname, "temp_" + Date.now() + ".jpg");
            fs.writeFileSync(filePath, file);
        } else {
            filePath = file.path;
        }
 
        const fileContent = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        await blockBlobClient.uploadData(fileContent);
 
        if (Buffer.isBuffer(file)) {
            fs.unlinkSync(filePath);
        }
 
        return blockBlobClient.url;
    } catch (error) {
        console.error("Azure Upload Error:", error);
        throw error;
    }
};
 
module.exports = uploadToAzure;