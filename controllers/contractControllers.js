const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { mnemonicToSeedSync } = require("bip39");
const { derivePath } = require("ed25519-hd-key");
const { Ed25519Keypair } = require("@mysten/sui.js/keypairs/ed25519");
const { readFileSync } = require("fs");
const { SuiClient, getFullnodeUrl } = require("@mysten/sui.js/client");
const { TransactionBlock } = require("@mysten/sui.js/transactions");
const uploadToAzure = require("../utils/uploadToAzure")


async function resolveDependencies() {
  return [
    "0x0000000000000000000000000000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000000000000000000000000000002",
  ];
}

exports.createContract = async (req, res) => {
  try {
    const {
      name,
      symbol,
      description,
      twitter,
      telegram,
      website,
      preBuy,
      walletAddress, // This should be the user's wallet address
    } = req.body;

    const decimals = 9;
    const maxSupply = 1000000000;

   let iconUrl = null;
 
    if (req.file) {
      iconUrl = await uploadToAzure(req.file);
    }

    if (!name || !symbol || !description || !iconUrl || !walletAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Update the Move contract template
    const contractPath = path.join(__dirname, '../meme_launchpad/sources/fungible_token.move');
    let code = fs.readFileSync(contractPath, 'utf8');

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

    // 2. Build the Move contract
    try {
      execSync('sui move build --skip-fetch-latest-git-deps', {
        cwd: path.join(__dirname, '../meme_launchpad'),
        stdio: 'inherit',
        shell: true,
      });
    } catch (err) {
      console.error('Build failed:', err);
      return res.status(500).json({ error: 'Build failed', details: err.message });
    }

    // 3. Prepare the transaction
    const txb = new TransactionBlock();
    txb.setGasBudget(100_000_000);
    
    // FIX: Set the sender address before building
    txb.setSender(walletAddress);

    const bytecode = fs.readFileSync(
      path.join(__dirname, '../meme_launchpad/build/meme_launchpad/bytecode_modules/meme_token.mv'),
      'base64'
    );

    const dependencies = await resolveDependencies();
    const [upgradeCap] = txb.publish({
      modules: [bytecode],
      dependencies,
    });

    // Transfer ownership to the user
    txb.transferObjects([upgradeCap], txb.pure(walletAddress));

    // 4. Serialize the transaction for the frontend to sign
    const client = new SuiClient({ url: getFullnodeUrl('testnet') });

res.json({
  success: true,
  bytecode,
  dependencies,
  walletAddress,
  iconUrl,
});


  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Server error',
      details: error.message,
    });
  }
};