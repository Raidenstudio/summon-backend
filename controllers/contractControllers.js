const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { SuiClient, getFullnodeUrl } = require("@mysten/sui.js/client");
const { TransactionBlock } = require("@mysten/sui.js/transactions");
const uploadToAzure = require("../utils/uploadToAzure");
const Coin = require("../models/Coin");
const Transaction = require("../models/Transaction");
const Profile = require("../models/Profile");
const { AccessToken } = require("livekit-server-sdk");
const Watchlist = require('../models/Watchlist');

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
    const contractPath = path.join(
      __dirname,
      "../meme_launchpad/sources/fungible_token.move"
    );
    let code = fs.readFileSync(contractPath, "utf8");

    code = code.replace(/DECIMALS: u8 = \d+;/, `DECIMALS: u8 = ${decimals};`);
    code = code.replace(
      /ICON_URL: vector<u8> = b\".*\";/,
      `ICON_URL: vector<u8> = b\"${iconUrl}\";`
    );
    code = code.replace(
      /NAME: vector<u8> = b\".*\";/,
      `NAME: vector<u8> = b\"${name}\";`
    );
    code = code.replace(
      /SYMBOL: vector<u8> = b\".*\";/,
      `SYMBOL: vector<u8> = b\"${symbol}\";`
    );
    code = code.replace(
      /DESCRIPTION: vector<u8> = b\".*\";/,
      `DESCRIPTION: vector<u8> = b\"${description}\";`
    );
    code = code.replace(
      /MAX_SUPPLY: u64 = \d+;/,
      `MAX_SUPPLY: u64 = ${maxSupply};`
    );

    fs.writeFileSync(contractPath, code);

    // Build the Move contract
    execSync("sui move build --skip-fetch-latest-git-deps", {
      cwd: path.join(__dirname, "../meme_launchpad"),
      stdio: "inherit",
    });

    const buildDir = path.join(
      __dirname,
      "../meme_launchpad/build/meme_launchpad/bytecode_modules"
    );
    const moduleFiles = [
      "safe_math.mv",
      "safe_math_u256.mv",
      "meme_token.mv",
      "bonding_curve.mv",
    ];

    const bytecode = moduleFiles.map((filename) => {
      const filePath = path.join(buildDir, filename);
      if (!fs.existsSync(filePath))
        throw new Error(`Bytecode not found: ${filename}`);
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
};

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

    if (
      !name ||
      !symbol ||
      !description ||
      !walletAddress ||
      !packageId ||
      !treasuryCap ||
      !bondingCurve ||
      !txDigest
    ) {
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
    global.io.emit("coin-updated", {
      coins,
    });
    res.json({ success: true, coins });
  } catch (error) {
    console.error("getAllCoins error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.getCoinById = async (req, res) => {
  try {
    const { id } = req.params;
    const coin = await Coin.findById(id);

    if (!coin) {
      return res.status(404).json({ success: false, error: "Coin not found" });
    }

    res.json({ success: true, coin });
  } catch (error) {
    console.error("getCoinById error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.createTransaction = async (req, res) => {
  try {
    const {
      type,
      packageId,
      address,
      coinName,
      coinSymbol,
      bondingCurveId,
      transactionDigest,
      sellQuantity,
      minReceived,
      pathId,
      coinImage,
    } = req.body;

    console.log("req", req.body);

    if (
      !coinName ||
      !coinSymbol ||
      !bondingCurveId ||
      !transactionDigest ||
      !minReceived ||
      !pathId ||
      !address ||
      !packageId ||
      !coinImage
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Save to database or mock save
    const transactionData = {
      type,
      packageId,
      address,
      coinName,
      coinSymbol,
      bondingCurveId,
      transactionDigest,
      sellQuantity,
      minReceived,
      pathId,
      coinImage,
    };

    // Example DB save
    const storeTransaction = await Transaction.create(transactionData);

    // For now, just return the received data
    res.json({
      success: true,
      data: storeTransaction,
    });
  } catch (error) {
    console.error("transactionData error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.getAllTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.find()
      .sort({ createdAt: -1 }) // newest first
      .limit(20);              // only latest 20

    global.io.emit("transaction-updated", {
      transaction,
    });

    res.json({ success: true, transaction });
  } catch (error) {
    console.error("transactionData error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};


exports.updateSingleCoin = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      mcap,
      volume24USD,
      totalVolume,
      mcapPercentage,
      volumePercentage,
      totalVolumePercentage,
    } = req.body;

    const coin = await Coin.findById(id);
    if (!coin) {
      return res.status(404).json({ success: false, error: "Coin not found" });
    }

    // Update fields if they are present
    if (mcap !== undefined) coin.mcap = mcap;
    if (volume24USD !== undefined) coin.volume24USD = volume24USD;
    if (totalVolume !== undefined) coin.totalVolume = totalVolume;
    if (mcapPercentage !== undefined) coin.mcapPercentage = mcapPercentage;
    if (volumePercentage !== undefined)
      coin.volumePercentage = volumePercentage;
    if (totalVolumePercentage !== undefined)
      coin.totalVolumePercentage = totalVolumePercentage;

    await coin.save();

    res.json({ success: true, updated: coin });
  } catch (error) {
    console.error("updateSingleCoin error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { walletAddress, profileName } = req.body;
  console.log("Received data:", { walletAddress, profileName});
    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    let profileImageUrl = null;

    if (req.file) {
      profileImageUrl = await uploadToAzure(req.file);
    }

    const updatedProfile = await Profile.findOneAndUpdate(
      { walletAddress },
      {
        $set: {
          ...(profileName && { profileName }),
          ...(profileImageUrl && { profileImageUrl }),
        },
      },
      { upsert: true, new: true }
    );
  console.log("Updated profile:", updatedProfile);
    res.json({ 
      success: true, 
      data: {
        profileName: updatedProfile.profileName,
        profileImageUrl: updatedProfile.profileImageUrl,
        walletAddress: updatedProfile.walletAddress
      }
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};


exports.createProfile = async (req, res) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    const profile = await Profile.findOne({ walletAddress });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error("getProfile error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

exports.checkProfileName = async (req, res) => {
  try {
    const { profileName, walletAddress } = req.query;

    if (!profileName || !walletAddress) {
      return res.status(400).json({ error: "profileName and walletAddress are required" });
    }

const profileWithSameName = await Profile.findOne({
  profileName: { $regex: new RegExp(`^${profileName}$`, "i") },
});

    if (profileWithSameName && profileWithSameName.walletAddress !== walletAddress) {
      return res.json({ exists: true });
    }

    return res.json({ exists: false });
  } catch (error) {
    console.error("checkProfileName error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

exports.addToWatchlist = async (req, res) => {
  try {
    const { userId, coinId } = req.body;

    const watchlist = await Watchlist.findOneAndUpdate(
      { user: userId },
      { $addToSet: { coins: coinId } }, 
      { upsert: true, new: true }
    ).populate('coins');

    res.json({ success: true, watchlist });
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.removeFromWatchlist = async (req, res) => {
  try {
    const { userId, coinId } = req.body;

    const watchlist = await Watchlist.findOneAndUpdate(
      { user: userId },
      { $pull: { coins: coinId } },
      { new: true }
    ).populate('coins');

    res.json({ success: true, watchlist });
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getWatchlist = async (req, res) => {
  try {
    const { userId } = req.query;

    const watchlist = await Watchlist.findOne({ user: userId })
      .populate('coins')
      .lean();

    if (!watchlist) {
      return res.json({ success: true, coins: [] });
    }

    res.json({ success: true, coins: watchlist.coins });
  } catch (error) {
    console.error("Error getting watchlist:", error);
    res.status(500).json({ error: "Server error" });
  }
};