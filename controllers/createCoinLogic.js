const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
const { SuiClient, getFullnodeUrl } = require('@mysten/sui.js/client');
const { fromB64 } = require('@mysten/bcs');

const cache = new Map();

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTRACT_PATH = path.join(PROJECT_ROOT, 'meme_launchpad/sources/fungible_token.move');
const BUILD_DIR = path.join(PROJECT_ROOT, 'meme_launchpad/build/meme_launchpad');
const KEY_PATH = path.join(PROJECT_ROOT, 'key.json');

// Helper: Get largest gas coin
async function getLargestGasCoin(suiClient, owner) {
    const coins = await suiClient.getCoins({
        owner,
        coinType: '0x2::sui::SUI'
    });
    if (!coins.data.length) {
        throw new Error('No SUI coins found for gas payment.');
    }
    return coins.data.reduce((max, coin) =>
        BigInt(coin.balance) > BigInt(max.balance) ? coin : max
    );
}

const createCoinLogic = async ({ name, symbol, iconUrl }) => {
    const description = `${symbol} was launched by the X account.`;
    const decimals = 9;
    const maxSupply = 1000000000;

    const key = `${symbol}:${name}`;
    if (cache.has(key)) return cache.get(key);

    const originalCode = fs.readFileSync(CONTRACT_PATH, 'utf8');
    try {
        const escape = (str) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

        const newCode = originalCode
            .replace(/DECIMALS: u8 = \d+;/, `DECIMALS: u8 = ${decimals};`)
            .replace(/ICON_URL: vector<u8> = b\".*?\";/, `ICON_URL: vector<u8> = b"${escape(iconUrl)}";`)
            .replace(/NAME: vector<u8> = b\".*?\";/, `NAME: vector<u8> = b"${escape(name)}";`)
            .replace(/SYMBOL: vector<u8> = b\".*?\";/, `SYMBOL: vector<u8> = b"${escape(symbol)}";`)
            .replace(/DESCRIPTION: vector<u8> = b\".*?\";/, `DESCRIPTION: vector<u8> = b"${escape(description)}";`)
            .replace(/MAX_SUPPLY: u64 = \d+;/, `MAX_SUPPLY: u64 = ${maxSupply};`);

        fs.writeFileSync(CONTRACT_PATH, newCode);

        // Build Move package
        const buildOutput = execSync(
            'sui move build --skip-fetch-latest-git-deps --dump-bytecode-as-base64',
            {
                cwd: path.join(PROJECT_ROOT, 'meme_launchpad'),
                encoding: 'utf-8',
            }
        );

        let buildInfo;
        try {
            buildInfo = JSON.parse(buildOutput);
        } catch (parseError) {
            throw new Error(`Failed to parse build output: ${parseError.message}`);
        }

        if (!buildInfo.modules || !Array.isArray(buildInfo.modules)) {
            throw new Error('Invalid build output: Missing modules array');
        }
        if (!buildInfo.dependencies || !Array.isArray(buildInfo.dependencies)) {
            throw new Error('Invalid build output: Missing dependencies array');
        }

        const modules = buildInfo.modules.map(base64Str =>
            Array.from(Buffer.from(base64Str, 'base64'))
        );

        const dependencies = buildInfo.dependencies.map(dep => {
            const cleanDep = dep.replace(/^0x/, '');
            if (!/^[0-9a-fA-F]+$/.test(cleanDep)) {
                throw new Error(`Invalid dependency format: ${dep}`);
            }
            return cleanDep.padStart(64, '0');
        });

        const keyData = JSON.parse(fs.readFileSync(KEY_PATH, 'utf-8'));
        const keypair = Ed25519Keypair.fromSecretKey(fromB64(keyData.privateKey).slice(0, 32));
        const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
        const sender = keypair.getPublicKey().toSuiAddress();

        // Pick the largest gas coin
        const largestGasCoin = await getLargestGasCoin(suiClient, sender);

        console.log("sender", sender);


        // --- Publish package ---
        const publishTx = new TransactionBlock();
        publishTx.setSender(sender);
        publishTx.setGasBudget(100_000_000);
        publishTx.setGasPayment([{
            objectId: largestGasCoin.coinObjectId,
            digest: largestGasCoin.digest,
            version: largestGasCoin.version
        }]);

        const [upgradeCap] = publishTx.publish({ modules, dependencies });
        publishTx.transferObjects([upgradeCap], publishTx.pure(sender));

        const publishResult = await suiClient.signAndExecuteTransactionBlock({
            signer: keypair,
            transactionBlock: publishTx,
            options: {
                showObjectChanges: true,
                showEffects: true,
                waitForTransactionBlock: true
            },
        });

        if (publishResult.effects?.status?.status !== 'success') {
            throw new Error(publishResult.effects.status.error || 'Publish transaction failed');
        }

        const pkgId = publishResult.objectChanges?.find((o) => o.type === 'published')?.packageId;
        const treasuryCap = publishResult.objectChanges?.find(
            (o) => o.type === 'created' && o.objectType?.includes('::coin::TreasuryCap')
        );

        console.log("pkgId", pkgId);
        console.log("treasuryCap", treasuryCap);


        if (!pkgId || !treasuryCap) {
            throw new Error('Missing package ID or TreasuryCap');
        }

        // Small delay to allow indexing
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Pick largest gas coin again (balances might have changed)
        const largestGasCoin2 = await getLargestGasCoin(suiClient, sender);

        // --- Create bonding curve ---
        const bondingTx = new TransactionBlock();
        bondingTx.setSender(sender);
        bondingTx.setGasBudget(100_000_000);
        bondingTx.setGasPayment([{
            objectId: largestGasCoin2.coinObjectId,
            digest: largestGasCoin2.digest,
            version: largestGasCoin2.version
        }]);

        bondingTx.moveCall({
            target: `${pkgId}::bonding_curve::create_bonding_curve`,
            arguments: [
                bondingTx.object(treasuryCap.objectId),  // TreasuryCap<MEME_TOKEN>
                bondingTx.pure.u64(100)                  // fee_bps = 500 → 5% fee (example)
            ]
        });


        const bondingResult = await suiClient.signAndExecuteTransactionBlock({
            signer: keypair,
            transactionBlock: bondingTx,
            options: {
                showObjectChanges: true,
                showEffects: true,
                waitForTransactionBlock: true
            },
        });

        if (bondingResult.effects?.status?.status !== 'success') {
            throw new Error(bondingResult.effects.status.error || 'Bonding curve creation failed');
        }

        const bondingCurve = bondingResult.objectChanges?.find(
            (change) => change.type === 'created' && change.objectType.includes('::BondingCurve')
        );

        const response = {
            success: true,
            packageId: pkgId,
            treasuryCapId: treasuryCap.objectId,
            bondingCurveId: bondingCurve?.objectId || null,
            txDigest: publishResult.digest,
            iconUrl,
        };

        cache.set(key, response);
        return response;

    } catch (err) {
        throw new Error(`Token creation failed: ${err.message}`);
    } finally {
        fs.writeFileSync(CONTRACT_PATH, originalCode); // Restore original
    }
};

module.exports = { createCoinLogic };
