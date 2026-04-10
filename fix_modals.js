const fs = require('fs');
const path = 'src/components/Settings/SettingsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { createPortal }')) {
    content = content.replace(
        "import React, { useRef, useState } from 'react';",
        "import React, { useRef, useState, useEffect } from 'react';\nimport { createPortal } from 'react-dom';"
    );
}

const modals = [
    'showResetConfirmModal',
    'showResetAuthModal',
    'croppingImage',
    'showPasswordResetModal',
    'showDeleteModal'
];

for (const modalVar of modals) {
    const rx = new RegExp('<AnimatePresence>[\\\\s\\\\S]*?{' + modalVar + ' && \\\\([\\\\s\\\\S]*?<\\\\/AnimatePresence>', 'g');
    let matches = [...content.matchAll(rx)];
    for (let m of matches) {
        if (!m[0].includes('createPortal(')) {
            let replaced = '{createPortal(\\n    ' + m[0].split('\\n').join('\\n    ') + ',\\n    document.body\\n)}';
            content = content.replace(m[0], replaced);
        }
    }
}

fs.writeFileSync(path, content, 'utf8');
console.log('Modals wrapped successfully.');
