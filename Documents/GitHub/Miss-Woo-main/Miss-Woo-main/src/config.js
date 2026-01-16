// Configuration - API keys are injected by GitHub Actions during build
// For local development, replace placeholders with your actual keys
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