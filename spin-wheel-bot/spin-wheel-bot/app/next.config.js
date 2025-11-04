/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_CAMPAIGN_NAME: 'Festive Fare Spin',
  },
};

module.exports = nextConfig;
