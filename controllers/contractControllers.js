const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { mnemonicToSeedSync } = require("bip39");
const { derivePath } = require("ed25519-hd-key");
const { Ed25519Keypair } = require("@mysten/sui.js/keypairs/ed25519");
const { readFileSync } = require("fs");
const { SuiClient, getFullnodeUrl } = require("@mysten/sui.js/client");
const { TransactionBlock } = require("@mysten/sui.js/transactions");

function getSuiKeypairFromMnemonic(mnemonic, accountIndex = 0) {
  const derivationPath = `m/44'/784'/${accountIndex}'/0'/0'`;
  const seed = mnemonicToSeedSync(mnemonic);
  const { key } = derivePath(derivationPath, seed.toString("hex"));
  return Ed25519Keypair.fromSecretKey(key);
}

async function resolveDependencies() {
  return [
    "0x0000000000000000000000000000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000000000000000000000000000002",
  ];
}

exports.createContract = async (req, res) => {
  try {
    const { name, symbol, description, twitter, telegram, website, preBuy } =
      req.body;

    const decimals = 9;
    const maxSupply = 1000000000;

    // ✅ Get uploaded icon URL from multer file
    const iconUrl = req.file
      ? `http://localhost:3001/uploads/${req.file.filename}`
      : null;

    // Check required fields
    if (!name || !symbol || !description || !iconUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Validate required fields
    if (!name || !symbol || !description || !decimals || !maxSupply) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const contractPath = path.join(
      __dirname,
      "../meme_launchpad/sources/fungible_token.move"
    );
    let code = fs.readFileSync(contractPath, "utf8");

    code = code.replace(/DECIMALS: u8 = \d+;/, `DECIMALS: u8 = ${decimals};`);
    code = code.replace(
      /ICON_URL: vector<u8> = b".*";/,
      `ICON_URL: vector<u8> = b"${iconUrl}";`
    );
    code = code.replace(
      /NAME: vector<u8> = b".*";/,
      `NAME: vector<u8> = b"${name}";`
    );
    code = code.replace(
      /SYMBOL: vector<u8> = b".*";/,
      `SYMBOL: vector<u8> = b"${symbol}";`
    );
    code = code.replace(
      /DESCRIPTION: vector<u8> = b".*";/,
      `DESCRIPTION: vector<u8> = b"${description}";`
    );
    code = code.replace(
      /MAX_SUPPLY: u64 = \d+;/,
      `MAX_SUPPLY: u64 = ${maxSupply};`
    );

    fs.writeFileSync(contractPath, code);

    console.log("📦 Move contract updated.");

    // ✅ Build
    try {
      execSync("echo Hello World", { stdio: "inherit", shell: true });
      console.log("✅ Spawn test successful.");
    } catch (err) {
      console.error("❌ Test Failed:", err);
    }

    // ✅ Deploy
    const mnemonic =
      "gain sock symptom list dynamic enforce very peasant attend advance history people";
    const keypair = getSuiKeypairFromMnemonic(mnemonic);
    const client = new SuiClient({ url: getFullnodeUrl("testnet") });

    const txb = new TransactionBlock();
    txb.setGasBudget(50_000_000);

    const bytecode = readFileSync(
      path.join(
        __dirname,
        "../meme_launchpad/build/bytecode_modules/meme_token.mv"
      ),
      "base64"
    );

    const dependencies = await resolveDependencies();

    const [upgradeCap] = txb.publish({
      modules: [bytecode],
      dependencies,
    });

    txb.setSender(keypair.getPublicKey().toSuiAddress());
    txb.transferObjects(
      [upgradeCap],
      txb.pure(keypair.getPublicKey().toSuiAddress())
    );

    const result = await client.signAndExecuteTransactionBlock({
      transactionBlock: await txb.build({ client }),
      signer: keypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const packageId = result.objectChanges?.find(
      (change) => change.type === "published"
    )?.packageId;

    res.json({
      success: true,
      message: "Token deployed successfully!",
      packageId,
    });
  } catch (error) {
    console.error("❌ Deployment Error:", error);
    res
      .status(500)
      .json({ error: "Deployment failed", details: error.message });
  }
};
