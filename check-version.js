#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// Get current Git commit hash
const getGitCommit = () => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('Error getting Git commit:', error.message);
    return 'unknown';
  }
};

// Check version in HTML file
const checkHTMLVersion = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return 'FILE_NOT_FOUND';
  }
  
  const html = fs.readFileSync(filePath, 'utf8');
  
  // Check for version badge first (for index.html)
  const versionMatch = html.match(/version-badge">v[0-9a-f]{4,7}/);
  if (versionMatch) {
    return versionMatch[0].replace('version-badge">', '');
  }
  
  // Check for script version (for index-dev.html)
  const scriptMatch = html.match(/src\/app\.js\?v=[0-9a-f]{4,7}/);
  if (scriptMatch) {
    return scriptMatch[0].replace('src/app.js?v=', 'v');
  }
  
  return 'NO_VERSION_FOUND';
};

// Main execution
const gitVersion = getGitCommit();
const indexVersion = checkHTMLVersion('./index.html');
const devVersion = checkHTMLVersion('./index-dev.html');

console.log('📊 Version Status:');
console.log(`Git Commit:     ${gitVersion}`);
console.log(`index.html:     ${indexVersion}`);
console.log(`index-dev.html: ${devVersion}`);

if (indexVersion === `v${gitVersion}` && devVersion === `v${gitVersion}`) {
  console.log('✅ All versions are consistent!');
} else {
  console.log('❌ Version mismatch detected!');
  console.log('💡 Run: node version.js to fix');
}
