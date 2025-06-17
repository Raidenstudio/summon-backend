const express = require("express");

const router = express.Router();

const upload = require("../utils/fileUpload");
const { createContract } = require("../controllers/contractControllers");
 
//create item

router.post("/contract", upload.single("icon"), createContract);
 
module.exports = router;
 