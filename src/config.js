// Configuration - API keys are injected by GitHub Actions during build
// 
// IMPORTANT: This file is overwritten during GitHub Actions build with keys from GitHub Secrets.
// For production: Keys come from GitHub Secrets (${{ secrets.WOOCOMMERCE_CONSUMER_KEY }})
// For local development: Replace placeholders below with your actual keys (not committed to git)
//
const config = {
    woocommerce: {
        apiBaseUrl: "https://quikrstuff.com/wp-json/wc/v3",
        consumerKey: "YOUR_WOOCOMMERCE_CONSUMER_KEY_HERE", // Replaced by GitHub Actions: ${{ secrets.WOOCOMMERCE_CONSUMER_KEY }}
        consumerSecret: "YOUR_WOOCOMMERCE_CONSUMER_SECRET_HERE", // Replaced by GitHub Actions: ${{ secrets.WOOCOMMERCE_CONSUMER_SECRET }}
        siteUrl: "https://quikrstuff.com" // Replaced by GitHub Actions: ${{ secrets.WOOCOMMERCE_SITE_URL }}
    },
    katana: {
        apiBaseUrl: "https://api.katanamrp.com/v1",
        apiKey: "YOUR_KATANA_API_KEY_HERE" // Replaced by GitHub Actions: ${{ secrets.KATANA_API_KEY }}
    }
};

// Make config available globally
window.config = config;