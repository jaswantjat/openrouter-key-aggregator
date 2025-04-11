console.log('>>>> INDEX.JS LOADED - COMMIT d3286ee (Canary Check) <<<<');
require('dotenv').config();
const express = require('express');
// ... (rest of index.js remains the same) ...

const app = express();
const PORT = process.env.PORT || 3000;

// ... (rest of the code) ...

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
