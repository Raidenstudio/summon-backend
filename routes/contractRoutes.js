const express = require("express");
const router = express.Router();
const contractController = require('../controllers/contractControllers');
const upload = require("../utils/fileUpload");

//create item

router.post("/contract", upload.single("icon"), contractController.createCoin);
// router.post("/bonding-curve", upload.single("icon"), bondingCurve);

module.exports = router;
