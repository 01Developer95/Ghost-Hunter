const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../dist/index.js');
const shebang = '#!/usr/bin/env node\n';

try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.startsWith('#!')) {
        fs.writeFileSync(filePath, shebang + content);
        console.log('Shebang added to dist/index.js');
    } else {
        console.log('Shebang already present.');
    }
} catch (err) {
    console.error('Error adding shebang:', err);
    process.exit(1);
}
