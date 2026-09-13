// Vercel serverless entry point.
//
// An Express app is itself an (req, res) handler, so exporting it is all Vercel
// needs. vercel.json rewrites /api/* here; Express then does its own routing on
// the original path, which is why the routers still mount under /api/...
module.exports = require('../server/app.js');
