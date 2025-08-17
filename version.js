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

// Update HTML file with current version
const updateHTML = (version) => {
  const htmlPath = './index.html';
  
  if (!fs.existsSync(htmlPath)) {
    console.error('index.html not found');
    return;
  }

  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // More aggressive version replacement to catch all variations
  html = html.replace(/v[0-9a-f]{4,7}/g, `v${version}`);
  html = html.replace(/src\/styles\.css\?v=[0-9a-f]{4,7}/g, `src/styles.css?v=${version}`);
  html = html.replace(/src\/config\.js\?v=[0-9a-f]{4,7}/g, `src/config.js?v=${version}`);
  html = html.replace(/src\/app\.js\?v=[0-9a-f]{4,7}/g, `src/app.js?v=${version}`);
  
  // Also update any other version patterns
  html = html.replace(/version-badge">v[0-9a-f]{4,7}/g, `version-badge">v${version}`);
  
  fs.writeFileSync(htmlPath, html);
  console.log(`✅ Updated index.html to version ${version}`);
};

// Update index-dev.html as well
const updateDevHTML = (version) => {
  const htmlPath = './index-dev.html';
  
  if (!fs.existsSync(htmlPath)) {
    console.log('index-dev.html not found, skipping...');
    return;
  }

  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // Update all version references (index-dev.html doesn't have version badge)
  html = html.replace(/src\/styles\.css\?v=[0-9a-f]{4,7}/g, `src/styles.css?v=${version}`);
  html = html.replace(/src\/config\.js\?v=[0-9a-f]{4,7}/g, `src/config.js?v=${version}`);
  html = html.replace(/src\/app\.js\?v=[0-9a-f]{4,7}/g, `src/app.js?v=${version}`);
  
  fs.writeFileSync(htmlPath, html);
  console.log(`✅ Updated index-dev.html to version ${version}`);
};

// Main execution
const version = getGitCommit();
console.log(`🔄 Updating to version: ${version}`);

updateHTML(version);
updateDevHTML(version);

console.log(`✅ All files updated to version ${version}`);
console.log(`💡 To clear browser cache: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)`);
