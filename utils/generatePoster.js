const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const https = require('https');
const path = require('path');

const WIDTH = 500;
const HEIGHT = 300;

function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const contentType = res.headers['content-type'];
            if (!contentType || !contentType.startsWith('image/')) {
                return reject(new Error(`Invalid content-type: ${contentType}`));
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                loadImage(buffer).then(resolve).catch(reject);
            });
        }).on('error', reject);
    });
}

async function generatePoster({ name, ticker, iconUrl }) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Outer Rounded Card
    ctx.save();
    roundRect(ctx, 0, 0, WIDTH, HEIGHT, 30);
    ctx.clip();

    // Background
    ctx.fillStyle = '#121314';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const padding = 20;

    // Load local logo
    try {
        const logoPath = path.resolve(__dirname, './logo.png'); // Ensure logo.png exists in the same folder
        const logoWidth = 100;
        const logoHeight = 30;
        const logo = await loadImage(logoPath);
        ctx.drawImage(logo, padding, padding, logoWidth, logoHeight);
    } catch (e) {
        console.log("⚠️ Logo not loaded, skipped.");
    }


    // Ticker text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial';
    ctx.fillText(ticker, padding, 100);

    // Name text
    ctx.font = '20px Arial';
    ctx.fillText(name, padding, 135);

    // Launched via
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Launched via @SummonFun', padding, 160);

    // BUY Button
    const btnX = padding;
    const btnY = 200;
    const btnWidth = 100;
    const btnHeight = 40;

    ctx.fillStyle = '#02BBFF';
    roundRect(ctx, btnX, btnY, btnWidth, btnHeight, 20);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('BUY', btnX + 30, btnY + 26);

    // Right-side token icon
    try {
        const rightImg = await loadImageFromUrl(iconUrl);
        const imgWidth = 200;
        const imgHeight = 200;
        const imgX = WIDTH - imgWidth - 20;
        const imgY = HEIGHT / 2 - imgHeight / 2;

        ctx.save();
        roundRect(ctx, imgX, imgY, imgWidth, imgHeight, 30);
        ctx.clip();
        ctx.drawImage(rightImg, imgX, imgY, imgWidth, imgHeight);
        ctx.restore();
    } catch (err) {
        console.error('❌ Failed to load right image:', err.message);
    }

    // Save the output
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync('./poster_output.png', buffer);
    console.log('✅ Poster saved as poster_output.png');
}

// Helper: Rounded rectangle path
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

module.exports = { generatePoster };
