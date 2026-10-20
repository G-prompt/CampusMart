
const backendOrigin = (
  process.env.CAMPUSMART_BACKEND_ORIGIN ||
  "http://127.0.0.1:5000"
).replace(/\/+$/, "");

module.exports = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
};
