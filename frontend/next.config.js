/** @type {import('next').NextConfig} */

// Static export, because production hosting is S3 and CloudFront. That rules out server
// actions, route handlers and image optimisation, and it is the right trade here: the
// only server this product needs is the FastAPI backend, and a static bundle on a CDN is
// the cheapest way to put the first paint in front of a technician on a bad connection.
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Trailing slashes keep the exported directory structure addressable by S3 without a
  // CloudFront function rewriting /diagnose to /diagnose/index.html.
  trailingSlash: true,
};

module.exports = nextConfig;
