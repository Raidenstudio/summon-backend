const express = require("express");
const router = express.Router();
const contractController = require('../controllers/contractControllers');
const upload = require("../utils/fileUpload");

//create item

router.post("/contract", upload.single("icon"), contractController.createCoin);
router.post("/store-coin", upload.single("icon"), contractController.storeCoin);
router.get("/get-all-coin", contractController.getAllCoins);
router.get("/get-single-coin/:id", contractController.getCoinById);
router.get("/get-all-transactions", contractController.getAllTransaction);
router.post("/create-transaction", contractController.createTransaction);
router.put("/update-coin/:id", contractController.updateSingleCoin);
router.post("/update-profile", upload.single("profileImage"), contractController.updateProfile);
router.get("/create-profile", contractController.createProfile);
router.get("/check-profile-name", contractController.checkProfileName);

module.exports = router;
