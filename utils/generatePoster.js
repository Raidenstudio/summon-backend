const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const https = require('https');
const path = require('path');

const WIDTH = 800;
const HEIGHT = 450;

/**
 * Loads an image from a given URL and returns a Promise that resolves with the image object.
 * @param {string} url - The URL of the image to load.
 * @returns {Promise<Image>} - A Promise that resolves with the loaded image.
 */
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

/**
 * Generates a poster image based on a provided configuration.
 * @param {object} config - The configuration object for the poster.
 * @param {string} config.title - The main title text for the poster (e.g., "HITMAN").
 * @param {string} config.subtitle - The subtitle text (e.g., "LETS HIT").
 * @param {string} config.launchInfo - The launch information text (e.g., "Launched via @SummonFun").
 * @param {string} config.buttonText - The text for the call-to-action button (e.g., "BUY NOW →").
 * @param {string} config.imageUrl - The URL for the main image on the poster.
 */
async function generatePoster({ title, subtitle, launchInfo, buttonText, imageUrl }) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // --- Background and Layout ---
    ctx.fillStyle = '#121314'; // Dark background color
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Draw the small, semi-transparent ghost icons from the screenshot
    const ghostImage = await loadImage('https://raidenimage.blob.core.windows.net/raidenimg/logo color (horizontally) 1 3 1.png');
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * WIDTH;
        const y = Math.random() * HEIGHT;
        const size = 30 + Math.random() * 20;
        ctx.globalAlpha = 0.2; // Make them semi-transparent
        ctx.drawImage(ghostImage, x, y, size, size);
    }
    ctx.globalAlpha = 1.0; // Reset alpha for main content

    const padding = 40;

    // --- Logo in top-left corner ---
    // This section has been updated to load the local 'logo.png' file.
    try {
        const logoPath = path.resolve(__dirname, './logo.png');
        const logo = await loadImage(logoPath);
        const logoWidth = 170;
        const logoHeight = 55;
        ctx.drawImage(logo, padding, padding, logoWidth, logoHeight);
    } catch (e) {
        // If the logo file doesn't exist, it will fall back to text.
        console.log("⚠️ Local logo.png not found, falling back to text.");
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('summon.fun', padding, padding + 20);
    }

    // --- Main text on the left ---
    const textStartX = padding;
    const textStartY = HEIGHT / 2 - 50;

    ctx.fillStyle = '#ccc';
    ctx.font = '16px Arial';
    ctx.fillText(subtitle.toUpperCase(), textStartX, textStartY);

    ctx.fillStyle = '#C20B0B'; // Red for the title, matching Hitman logo color
    ctx.font = 'bold 50px Arial';
    ctx.fillText(title.toUpperCase(), textStartX, textStartY + 50);

    ctx.fillStyle = '#ccc';
    ctx.font = '14px Arial';
    ctx.fillText(launchInfo, textStartX, textStartY + 80);

    // --- BUY NOW button ---
    const btnX = textStartX;
    const btnY = textStartY + 120;
    const btnWidth = 150;
    const btnHeight = 45;
    const btnRadius = 22;

    ctx.fillStyle = '#02BBFF';
    roundRect(ctx, btnX, btnY, btnWidth, btnHeight, btnRadius);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    const textWidth = ctx.measureText(buttonText).width;
    ctx.fillText(buttonText, btnX + (btnWidth - textWidth) / 2, btnY + 28);

    // --- Main image container ---
    const imgContainerSize = 350;
    const imgX = WIDTH - imgContainerSize - padding;
    const imgY = HEIGHT / 2 - imgContainerSize / 2;
    const imgRadius = 30;

    try {
        const mainImage = await loadImageFromUrl(imageUrl);

        // This is the new logic for 'object-fit: cover'
        const imageRatio = mainImage.width / mainImage.height;
        const containerRatio = imgContainerSize / imgContainerSize;
        let sx, sy, sWidth, sHeight;

        if (imageRatio > containerRatio) {
            // Image is wider than container, crop left and right
            sHeight = mainImage.height;
            sWidth = mainImage.height * containerRatio;
            sx = (mainImage.width - sWidth) / 2;
            sy = 0;
        } else {
            // Image is taller than container, crop top and bottom
            sWidth = mainImage.width;
            sHeight = mainImage.width / containerRatio;
            sx = 0;
            sy = (mainImage.height - sHeight) / 2;
        }

        // Clip a rounded rectangle for the main image
        ctx.save();
        roundRect(ctx, imgX, imgY, imgContainerSize, imgContainerSize, imgRadius);
        ctx.clip();

        // Draw the cropped image to the container
        ctx.drawImage(mainImage, sx, sy, sWidth, sHeight, imgX, imgY, imgContainerSize, imgContainerSize);
        ctx.restore();
    } catch (err) {
        console.error('❌ Failed to load main image:', err.message);
        // Draw a placeholder if the image fails to load
        ctx.fillStyle = '#333';
        roundRect(ctx, imgX, imgY, imgContainerSize, imgContainerSize, imgRadius);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Image not found', imgX + imgContainerSize / 2, imgY + imgContainerSize / 2);
        ctx.textAlign = 'left'; // Reset alignment
    }

    // Save the output
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync('./poster_output.png', buffer);
    console.log('✅ Poster saved as poster_output.png');
}

/**
 * Helper function to draw a rounded rectangle.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} x - The x-coordinate of the top-left corner.
 * @param {number} y - The y-coordinate of the top-left corner.
 * @param {number} width - The width of the rectangle.
 * @param {number} height - The height of the rectangle.
 * @param {number} radius - The corner radius.
 */
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