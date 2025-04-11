/**
 * Apply Authentication Fix for OpenRouter Key Aggregator
 * 
 * This script applies the authentication fix to the main application.
 * It should be run from the root directory of the OpenRouter Key Aggregator.
 */
const fs = require('fs');
const path = require('path');

// Files to update
const filesToUpdate = [
  {
    path: 'src/middleware/authenticate.js',
    newPath: 'src/middleware/authenticate.js.bak',
    replacementPath: 'enhanced-authMiddleware.js'
  },
  {
    path: 'src/app.js',
    newPath: 'src/app.js.bak',
    patches: [
      {
        search: 'app.use(cors());',
        replace: 'app.use(require(\'./middleware/cors\'));'
      },
      {
        search: 'app.use(\'/api\', authenticate);',
        replace: 'app.use(\'/api\', authenticate);\n\n// Add diagnostic endpoints\napp.get(\'/api/diagnostic\', require(\'./controllers/diagnosticController\').handleDiagnostic);\napp.post(\'/api/auth-test\', authenticate, require(\'./controllers/diagnosticController\').handleAuthTest);'
      }
    ]
  }
];

// Directories to create
const directoriesToCreate = [
  'src/middleware',
  'src/controllers'
];

// Files to copy
const filesToCopy = [
  {
    source: 'enhanced-authMiddleware.js',
    destination: 'src/middleware/authenticate.js'
  },
  {
    source: 'enhanced-corsMiddleware.js',
    destination: 'src/middleware/cors.js'
  },
  {
    source: 'diagnosticController.js',
    destination: 'src/controllers/diagnosticController.js'
  }
];

/**
 * Apply the authentication fix
 */
function applyAuthFix() {
  console.log('Applying authentication fix...');
  
  // Create directories
  directoriesToCreate.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Copy files
  filesToCopy.forEach(file => {
    console.log(`Copying ${file.source} to ${file.destination}`);
    fs.copyFileSync(file.source, file.destination);
  });
  
  // Update files
  filesToUpdate.forEach(file => {
    if (file.replacementPath) {
      // Backup original file
      if (fs.existsSync(file.path)) {
        console.log(`Backing up ${file.path} to ${file.newPath}`);
        fs.copyFileSync(file.path, file.newPath);
      }
      
      // Replace with new file
      console.log(`Replacing ${file.path} with ${file.replacementPath}`);
      fs.copyFileSync(file.replacementPath, file.path);
    } else if (file.patches) {
      // Backup original file
      if (fs.existsSync(file.path)) {
        console.log(`Backing up ${file.path} to ${file.newPath}`);
        fs.copyFileSync(file.path, file.newPath);
        
        // Apply patches
        let content = fs.readFileSync(file.path, 'utf8');
        
        file.patches.forEach(patch => {
          console.log(`Applying patch to ${file.path}: ${patch.search} -> ${patch.replace}`);
          content = content.replace(patch.search, patch.replace);
        });
        
        // Write updated content
        fs.writeFileSync(file.path, content);
      } else {
        console.log(`File ${file.path} does not exist, skipping patches`);
      }
    }
  });
  
  console.log('Authentication fix applied successfully');
}

// Run the fix
applyAuthFix();
