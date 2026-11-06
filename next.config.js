const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "three$": path.resolve(
        __dirname,
        "node_modules/three"
      ),
    };

    return config;
  },
};

module.exports = nextConfig;
