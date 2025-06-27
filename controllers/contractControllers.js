const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { SuiClient, getFullnodeUrl } = require("@mysten/sui.js/client");
const { TransactionBlock } = require("@mysten/sui.js/transactions");
const uploadToAzure = require("../utils/uploadToAzure");
const Coin = require("../models/Coin");

async function resolveDependencies() {
  return [
    "0x0000000000000000000000000000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000000000000000000000000000002",
  ];
}

exports.createCoin = async (req, res) => {
  try {
    const {
      name,
      symbol,
      description,
      twitter,
      telegram,
      website,
      preBuy,
      walletAddress,
    } = req.body;

    const decimals = 9;
    const maxSupply = 1000000000;
    let iconUrl = null;

    if (req.file) {
      iconUrl = await uploadToAzure(req.file);
    }

    if (!name || !symbol || !description || !iconUrl || !walletAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Update Move source
    const contractPath = path.join(__dirname, "../meme_launchpad/sources/fungible_token.move");
    let code = fs.readFileSync(contractPath, "utf8");

    code = code.replace(/DECIMALS: u8 = \d+;/, `DECIMALS: u8 = ${decimals};`);
    code = code.replace(/ICON_URL: vector<u8> = b\".*\";/, `ICON_URL: vector<u8> = b\"${iconUrl}\";`);
    code = code.replace(/NAME: vector<u8> = b\".*\";/, `NAME: vector<u8> = b\"${name}\";`);
    code = code.replace(/SYMBOL: vector<u8> = b\".*\";/, `SYMBOL: vector<u8> = b\"${symbol}\";`);
    code = code.replace(/DESCRIPTION: vector<u8> = b\".*\";/, `DESCRIPTION: vector<u8> = b\"${description}\";`);
    code = code.replace(/MAX_SUPPLY: u64 = \d+;/, `MAX_SUPPLY: u64 = ${maxSupply};`);

    fs.writeFileSync(contractPath, code);

    // Build the Move contract
    execSync("sui move build --skip-fetch-latest-git-deps", {
      cwd: path.join(__dirname, "../meme_launchpad"),
      stdio: "inherit",
    });

    const buildDir = path.join(__dirname, "../meme_launchpad/build/meme_launchpad/bytecode_modules");
    const moduleFiles = ["safe_math.mv", "safe_math_u256.mv", "meme_token.mv", "bonding_curve.mv"];

    const bytecode = moduleFiles.map((filename) => {
      const filePath = path.join(buildDir, filename);
      if (!fs.existsSync(filePath)) throw new Error(`Bytecode not found: ${filename}`);
      return fs.readFileSync(filePath, "base64");
    });

    const dependencies = await resolveDependencies();

    res.json({
      success: true,
      bytecode,
      dependencies,
      walletAddress,
      iconUrl,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
}


exports.storeCoin = async (req, res) => {
  try {
    const {
      name,
      symbol,
      description,
      twitter,
      telegram,
      website,
      preBuy,
      walletAddress,
      packageId,
      treasuryCap,
      bondingCurve,
      txDigest,
    } = req.body;



    let iconUrl = null;

    if (req.file) {
      iconUrl = await uploadToAzure(req.file);
    }

    if (!name || !symbol || !description || !walletAddress || !packageId || !treasuryCap || !bondingCurve || !txDigest) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Save to database or mock save
    const coinData = {
      name,
      symbol,
      description,
      twitter,
      telegram,
      website,
      preBuy,
      walletAddress,
      packageId,
      treasuryCap,
      bondingCurve,
      txDigest,
      iconUrl,
    };

    // Example DB save
    const savedCoin = await Coin.create(coinData);

    // For now, just return the received data
    res.json({
      success: true,
      data: savedCoin,
    });
  } catch (error) {
    console.error("storeCoin error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};


exports.getAllCoins = async (req, res) => {
  try {
    const coins = await Coin.find().sort({ createdAt: -1 }); // latest first
    res.json({ success: true, coins });
  } catch (error) {
    console.error("getAllCoins error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};


exports.getCoinById = async (req, res) => {
  try {
    const { id } = req.params;
    const coin = await Coin.findById({ _id: id });

    if (!coin) {
      return res.status(404).json({ success: false, error: "Coin not found" });
    }

    res.json({ success: true, coin });
  } catch (error) {
    console.error("getCoinById error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};