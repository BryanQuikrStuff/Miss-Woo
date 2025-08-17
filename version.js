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
  
  // Update all version references
  html = html.replace(/v[0-9a-f]{7}/g, `v${version}`);
  html = html.replace(/src\/styles\.css\?v=[0-9a-f]{7}/g, `src/styles.css?v=${version}`);
  html = html.replace(/src\/config\.js\?v=[0-9a-f]{7}/g, `src/config.js?v=${version}`);
  html = html.replace(/src\/app\.js\?v=[0-9a-f]{7}/g, `src/app.js?v=${version}`);
  
  fs.writeFileSync(htmlPath, html);
  console.log(`✅ Updated index.html to version ${version}`);
};

// Main execution
const version = getGitCommit();
updateHTML(version);
console.log(`Current version: ${version}`);
