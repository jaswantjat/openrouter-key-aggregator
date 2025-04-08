/**
 * Controller for OpenAI-compatible models endpoint
 */
const axios = require('axios');
// No need to import getNextKey as we're using the first key from the environment variable

// Cache for models to avoid hitting OpenRouter API too frequently
let modelsCache = null;
let modelsCacheExpiry = 0;
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// List of free models we want to ensure are always available
const FREE_MODEL_IDS = [
  "meta-llama/llama-4-maverick:free",
  "meta-llama/llama-4-scout:free",
  "google/gemini-2.5-pro-exp-03-25:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemini-2.0-flash-exp:free"
];

// List of paid models we want to ensure are always available
const PAID_MODEL_IDS = [
  "anthropic/claude-3-opus",
  "openai/gpt-4o"
];

/**
 * Convert OpenRouter model format to OpenAI format
 */
const convertToOpenAIFormat = (openRouterModels) => {
  const openAIModels = [];

  // Process all models from OpenRouter
  if (openRouterModels && openRouterModels.data && Array.isArray(openRouterModels.data)) {
    openRouterModels.data.forEach(model => {
      // Only include models we're interested in
      if (FREE_MODEL_IDS.includes(model.id) || PAID_MODEL_IDS.includes(model.id)) {
        openAIModels.push({
          id: model.id,
          object: "model",
          created: model.created || Math.floor(Date.now() / 1000),
          owned_by: model.id.split('/')[0],
          permission: [{
            id: `modelperm-${model.id.replace(/\//g, '-').replace(/:/g, '-')}`,
            object: "model_permission",
            created: model.created || Math.floor(Date.now() / 1000),
            allow_create_engine: false,
            allow_sampling: true,
            allow_logprobs: true,
            allow_search_indices: false,
            allow_view: true,
            allow_fine_tuning: false,
            organization: "*",
            group: null,
            is_blocking: false
          }],
          root: model.id,
          parent: null
        });
      }
    });
  }

  return openAIModels;
};

/**
 * Fetch models from OpenRouter API
 */
const fetchModelsFromOpenRouter = async () => {
  try {
    // Get an OpenRouter API key
    const openRouterKey = process.env.OPENROUTER_API_KEYS.split(',')[0];

    // Fetch models from OpenRouter
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${openRouterKey}`
      }
    });

    // Convert to OpenAI format
    const openAIModels = convertToOpenAIFormat(response.data);

    // Update cache
    modelsCache = openAIModels;
    modelsCacheExpiry = Date.now() + CACHE_TTL;

    return openAIModels;
  } catch (error) {
    console.error('Error fetching models from OpenRouter:', error.message);
    return [];
  }
};

/**
 * Get models from cache or fetch from OpenRouter
 */
const getModelsData = async () => {
  // If cache is valid, return it
  if (modelsCache && modelsCacheExpiry > Date.now()) {
    return modelsCache;
  }

  // Otherwise, fetch from OpenRouter
  return await fetchModelsFromOpenRouter();
};

/**
 * Get list of models
 */
const getModels = async (req, res) => {
  try {
    console.log(`[DEBUG] getModels called with headers:`, JSON.stringify(req.headers));
    console.log(`[DEBUG] getModels called with query:`, JSON.stringify(req.query));

    const models = await getModelsData();

    // Log the models we're returning
    console.log(`[DEBUG] Returning ${models.length} models:`, models.map(m => m.id).join(', '));

    res.json({
      object: "list",
      data: models
    });
  } catch (error) {
    console.error('Error in getModels:', error.message);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve models',
        type: "server_error",
        param: null,
        code: "models_unavailable"
      }
    });
  }
};

/**
 * Get a specific model
 */
const getModel = async (req, res) => {
  try {
    const modelId = req.params.model;
    console.log(`[DEBUG] Requested model: '${modelId}'`);

    const models = await getModelsData();

    // Try exact match first
    let model = models.find(m => m.id === modelId);

    // If not found, try more flexible matching
    if (!model) {
      // Try without the :free suffix
      if (modelId.includes(':free')) {
        const baseModelId = modelId.split(':')[0];
        model = models.find(m => m.id.startsWith(baseModelId));
      }
      // Try with the :free suffix
      else {
        model = models.find(m => m.id.startsWith(modelId + ':'));
      }

      // Try case-insensitive match
      if (!model) {
        const lowerModelId = modelId.toLowerCase();
        model = models.find(m => m.id.toLowerCase().includes(lowerModelId));
      }

      // Try matching just the model name without provider
      if (!model && modelId.includes('/')) {
        const modelName = modelId.split('/')[1];
        model = models.find(m => m.id.includes(modelName));
      }
    }

    if (!model) {
      console.log(`[DEBUG] Model '${modelId}' not found. Available models: ${models.map(m => m.id).join(', ')}`);
      return res.status(404).json({
        error: {
          message: `Model '${modelId}' not found`,
          type: "invalid_request_error",
          param: null,
          code: "model_not_found"
        }
      });
    }

    console.log(`[DEBUG] Found model: '${model.id}'`);
    res.json(model);
  } catch (error) {
    console.error('Error in getModel:', error.message);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve model',
        type: "server_error",
        param: null,
        code: "model_unavailable"
      }
    });
  }
};

module.exports = {
  getModels,
  getModel,
  getModelsData
};
