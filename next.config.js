/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/Feedback Tracker.html',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
