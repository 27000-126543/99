const fs = require('fs');
const path = require('path');

function checkSyntax(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    new Function(content);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function walkDir(dir) {
  const results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (item.endsWith('.js')) {
      const check = checkSyntax(fullPath);
      results.push({ file: fullPath.replace(process.cwd() + '/', ''), ok: check.ok, error: check.error });
    }
  }
  return results;
}

const checks = walkDir('./src');
let hasError = false;
for (const c of checks) {
  if (!c.ok) {
    console.log('ERROR:', c.file, ':', c.error);
    hasError = true;
  } else {
    console.log('OK:', c.file);
  }
}
if (!hasError) {
  console.log('\nAll files passed syntax check!');
} else {
  process.exit(1);
}
