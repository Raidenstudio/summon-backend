const { TwitterApi } = require("twitter-api-v2");
const ProcessedToken = require("../models/Twitter");
const { createCoinLogic } = require("./createCoinLogic");
const { generatePoster } = require("../utils/generatePoster");
const fs = require('fs');
const path = require('path');
const uploadToAzure = require("../utils/uploadToAzure");
const Coin = require("../models/Coin");


const botClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
}).readWrite;

let lastProcessedTweetId = null;

function extractTickerAndName(text) {
    const regex = /\$([A-Z]{2,10})/;
    const match = text.match(regex);
    if (match) {
        const ticker = match[1].toUpperCase();
        const name = text
            .replace(regex, "")
            .replace(/https?:\/\/\S+/g, "")
            .replace(/@\w+/, "")
            .replace(/\s+/g, " ")
            .trim();
        return { name, ticker };
    }
    return null;
}


const storeCoin = async ({
    name,
    symbol,
    description,
    packageId,
    treasuryCap,
    bondingCurve,
    txDigest,
    iconUrl,
    twitter,
    telegram,
    website,
    preBuy,
    walletAddress
}) => {
    try {
        if (!name || !symbol || !packageId || !treasuryCap || !bondingCurve || !txDigest) {
            console.log("Missing required fields");
            return null;
        }

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

        const savedCoin = await Coin.create(coinData);
        console.log("savedCoin", savedCoin);
        return savedCoin;

    } catch (error) {
        console.error("storeCoin error:", error);
        return null;
    }
};



async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleMentions() {
    try {
        const query = '@SummonFun has:mentions';
        const options = {
            max_results: 10,
            expansions: 'attachments.media_keys',
            'media.fields': 'url,type',
            'tweet.fields': 'created_at',
        };

        if (lastProcessedTweetId) {
            options.since_id = lastProcessedTweetId;
        }

        const response = await botClient.v2.search(query, options);
        const tweets = response.data?.data || [];

        for (const tweet of tweets.reverse()) {
            const { id, text } = tweet;

            if (!text.includes("$")) continue;

            const info = extractTickerAndName(text);
            if (!info) continue;

            const { name, ticker } = info;

            // ✅ Only skip if this tweet was already replied to
            const existingTweet = await ProcessedToken.findOne({ tweetId: id });
            if (existingTweet) {
                console.log(`⛔ Already replied to tweet ID: ${id}`);
                continue;
            }

            console.log("name", name);
            console.log("ticker", ticker);


            try {
                const suffixes = [
                    "🚀 It's live now!",
                    "🔥 Deployed successfully!",
                    "✨ Token created just for you!",
                    "✅ Ready to roll!",
                    "🎉 Enjoy your token!",
                    `🕒 ${new Date().toLocaleTimeString()}`,
                ];

                const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];

                // Get image from tweet if any
                let iconUrl = null;
                if (tweet?.attachments?.media_keys?.length > 0 && response.includes?.media) {
                    const media = response.includes.media.find(
                        m => tweet.attachments.media_keys.includes(m.media_key) && m.type === "photo"
                    );
                    if (media?.url) {
                        iconUrl = media.url;
                    }
                }

                // ❌ If no image, skip
                if (!iconUrl) {
                    console.log(`⛔ Skipped tweet ID: ${id} - No image found`);
                    continue;
                }


                console.log("iconUrl", iconUrl);


                // ⛏️ Create the token
                const result = await createCoinLogic({
                    name,
                    symbol: ticker,
                    iconUrl,
                });

                await generatePoster({
                    name,
                    ticker,
                    iconUrl
                });

                await generatePoster({
                    title: name.toUpperCase(),
                    subtitle: `LETS ${ticker.toUpperCase()}`,
                    launchInfo: "Launched via @SummonFun",
                    buttonText: "BUY NOW",
                    imageUrl: iconUrl
                });

                // Load the generated image
                const imagePath = path.resolve(__dirname, '../poster_output.png');
                const mediaData = fs.readFileSync(imagePath);

                // Upload the image to Twitter
                const mediaId = await botClient.v1.uploadMedia(mediaData, { type: 'png' });


                const storeCoinRes = await storeCoin({
                    name,
                    symbol: ticker,
                    description: `Lanched via @SummonFun`,
                    iconUrl,
                    packageId: result?.packageId,
                    treasuryCap: result?.treasuryCapId,
                    bondingCurve: result?.bondingCurveId,
                    txDigest: result?.txDigest,
                })

                console.log("storeCoin-2", storeCoinRes);


                // Construct the tweet text
                const tweetText = `🚀 Your coin $${ticker} is live!
Buy it with the link below 👇

🔗 https://summon-ui.netlify.app/coin/${storeCoinRes?._id}

$SUI #SummonFun`;



                // Post reply with image
                await botClient.v2.reply(tweetText, id, {
                    media: { media_ids: [mediaId] }
                });

                await ProcessedToken.create({
                    name,
                    ticker,
                    tweetId: id,
                });

                console.log(`✅ Replied to tweet ID: ${id} with $${ticker}`);
                lastProcessedTweetId = id;
            } catch (err) {
                if (err.code === 429) {
                    const resetTime = parseInt(err.rateLimit?.reset || 60);
                    const now = Math.floor(Date.now() / 1000);
                    const waitTime = (resetTime - now + 5) * 1000;
                    console.warn(`🕒 Rate limit hit. Waiting ${waitTime / 1000}s...`);
                    await wait(waitTime);
                } else {
                    console.error("❌ Error replying to tweet:", err);
                }
            }
        }
    } catch (error) {
        if (error.code === 429) {
            const resetTime = parseInt(error.rateLimit?.reset || 60);
            const now = Math.floor(Date.now() / 1000);
            const waitTime = (resetTime - now + 5) * 1000;
            console.warn(`🕒 Global rate limit hit. Waiting ${waitTime / 1000}s...`);
            await wait(waitTime);
        } else {
            console.error("❌ Error handling mentions:", error);
        }
    }
}


module.exports = {
    handleMentions,
};
