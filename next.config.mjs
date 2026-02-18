

const nextConfig = {
  reactStrictMode: true,
  // PixiJS needs client-side only
  webpack: (config) => {
    config.externals = config.externals || [];
    return config;
  },
};

export default nextConfig;
