#!/bin/bash

# Miss-Woo Static Deployment Script

echo "🚀 Deploying Miss-Woo Static Files..."

# Check if required files exist
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found"
    exit 1
fi

if [ ! -f "app.js" ]; then
    echo "❌ Error: app.js not found"
    exit 1
fi

if [ ! -f "styles.css" ]; then
    echo "❌ Error: styles.css not found"
    exit 1
fi

echo "✅ All required files found"

# Create deployment directory
mkdir -p dist

# Copy static files
cp index.html dist/
cp app.js dist/
cp styles.css dist/
cp netlify.toml dist/

echo "✅ Files copied to dist/ directory"
echo ""
echo "📁 Static files ready for deployment:"
echo "   - index.html"
echo "   - app.js" 
echo "   - styles.css"
echo "   - netlify.toml"
echo ""
echo "🌐 Deploy to:"
echo "   - Netlify: Drag dist/ folder to Netlify"
echo "   - Vercel: Push to GitHub and connect"
echo "   - GitHub Pages: Push dist/ contents to gh-pages branch"
echo ""
echo "⚠️  Remember to update apiBaseUrl in app.js with your backend URL" 