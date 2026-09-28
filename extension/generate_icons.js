const fs = require('fs');
const path = require('path');

// 1x1 transparent PNG or simple colored PNG base64
// Standard valid 16x16 / 48x48 / 128x128 blue circle icon encoded as PNG
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAEZJREFUWIXt1rENACAIBEAv5ui2bkwvhnAJ1xBCwT84c8kBAHiH65HkLtm9+wEAALxP438e/b4AAABwM8wCAACAXgYBAAAA//8ZogL9i5V4iAAAAABJRU5ErkJggg==";
const buffer = Buffer.from(pngBase64, 'base64');

const iconsDir = path.join(__dirname, 'extension', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon16.png'), buffer);
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), buffer);
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), buffer);

console.log('Icons created successfully!');
