/**
 * Apply OpenAI Compatibility for OpenRouter Key Aggregator
 * 
 * This script applies the OpenAI compatibility changes to the main application.
 * It should be run from the root directory of the OpenRouter Key Aggregator.
 */
const fs = require('fs');
const path = require('path');

// Files to update
const filesToUpdate = [
  {
    path: 'src/middleware/authenticate.js',
    newPath: 'src/middleware/authenticate.js.bak',
    replacementPath: 'openai-compatible-middleware.js'
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
        replace: 'app.use(\'/api\', require(\'./middleware/openai-path\'));\napp.use(\'/api\', authenticate);'
      },
      {
        search: '// Add routes',
        replace: '// Add diagnostic endpoints\napp.get(\'/api/diagnostic\', require(\'./controllers/diagnosticController\').handleDiagnostic);\napp.post(\'/api/auth-test\', authenticate, require(\'./controllers/diagnosticController\').handleAuthTest);\n\n// Add OpenAI-compatible models endpoint\napp.get(\'/api/models\', (req, res) => {\n  res.json({\n    object: \'list\',\n    data: [\n      {\n        id: \'deepseek/deepseek-chat-v3-0324:free\',\n        object: \'model\',\n        created: 1677610602,\n        owned_by: \'openrouter\'\n      },\n      {\n        id: \'meta-llama/llama-4-maverick:free\',\n        object: \'model\',\n        created: 1677610602,\n        owned_by: \'openrouter\'\n      },\n      {\n        id: \'meta-llama/llama-4-scout:free\',\n        object: \'model\',\n        created: 1677610602,\n        owned_by: \'openrouter\'\n      },\n      {\n        id: \'deepseek\',\n        object: \'model\',\n        created: 1677610602,\n        owned_by: \'openrouter\'\n      },\n      {\n        id: \'llama-4-maverick\',\n        object: \'model\',\n        created: 1677610602,\n        owned_by: \'openrouter\'\n      },\n      {\n        id: \'llama-4-scout\',\n        object: \'model\',\n        created: 1677610602,\n        owned_by: \'openrouter\'\n      }\n    ]\n  });\n});\n\n// Add routes'
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
    source: 'openai-compatible-middleware.js',
    destination: 'src/middleware/authenticate.js'
  },
  {
    source: 'openai-path-middleware.js',
    destination: 'src/middleware/openai-path.js'
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
 * Apply the OpenAI compatibility changes
 */
function applyOpenAICompatibility() {
  console.log('Applying OpenAI compatibility changes...');
  
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
  
  console.log('OpenAI compatibility changes applied successfully');
}

// Run the function
applyOpenAICompatibility();
