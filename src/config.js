// Configuration with actual API keys
const config = {
    woocommerce: {
        apiBaseUrl: "https://quikrstuff.com/wp-json/wc/v3",
        consumerKey: "ck_285852a66ac9cf16db7723e1d6deda54937a8a03",
        consumerSecret: "cs_3211f905108b717426e6b6a63613147b66993333",
        siteUrl: "https://quikrstuff.com"
    },
    katana: {
        apiBaseUrl: "https://api.katanamrp.com/v1",
        apiKey: "8292a174-0f66-4ac1-a0e9-cb3c9db7ecc4"
    }
};

// Make config available globally
window.config = config;