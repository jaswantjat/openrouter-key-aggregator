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
// These are the models that are confirmed to be working
const FREE_MODEL_IDS = [
  "meta-llama/llama-4-maverick:free",
  "meta-llama/llama-4-scout:free",
  "google/gemini-2.5-pro-exp-03-25:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemini-2.0-flash-exp:free"
];

// List of paid models we want to ensure are always available
// Only include models that are confirmed to be working
const PAID_MODEL_IDS = [
  // Uncomment models as needed
  // "anthropic/claude-3-opus",
  // "openai/gpt-4o"
];

/**
 * Convert OpenRouter model format to OpenAI format
 */
const convertToOpenAIFormat = (openRouterModels) => {
  const openAIModels = [];

  // Add our known free models even if they're not returned by OpenRouter
  // This ensures n8n always has access to these models
  const addedModelIds = new Set();

  // Add all free models first
  FREE_MODEL_IDS.forEach(modelId => {
    // Extract provider and model name
    const parts = modelId.split('/');
    const provider = parts[0];
    let modelName = parts[1] || modelId;

    // Remove :free suffix if present
    const modelNameWithoutSuffix = modelName.split(':')[0];

    // Add the full model ID
    openAIModels.push({
      id: modelId,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: provider,
      permission: [{
        id: `modelperm-${modelId.replace(/\//g, '-').replace(/:/g, '-')}`,
        object: "model_permission",
        created: Math.floor(Date.now() / 1000),
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
      root: modelId,
      parent: null
    });

    // Add simplified aliases
    openAIModels.push({
      id: modelNameWithoutSuffix,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: provider,
      permission: [{
        id: `modelperm-${modelNameWithoutSuffix.replace(/\//g, '-').replace(/:/g, '-')}`,
        object: "model_permission",
        created: Math.floor(Date.now() / 1000),
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
      root: modelId,
      parent: null
    });

    // Add even more simplified aliases for n8n compatibility
    // For example, "llama-4-maverick" -> "maverick"
    let simpleName = modelNameWithoutSuffix.split('-').pop();
    if (simpleName && simpleName !== modelNameWithoutSuffix) {
      openAIModels.push({
        id: simpleName,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: provider,
        permission: [{
          id: `modelperm-${simpleName.replace(/\//g, '-').replace(/:/g, '-')}`,
          object: "model_permission",
          created: Math.floor(Date.now() / 1000),
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
        root: modelId,
        parent: null
      });
    }

    // Special handling for gemini models
    if (modelNameWithoutSuffix.includes('gemini')) {
      // Add 'gemini-flash' alias for gemini-2.0-flash-exp
      if (modelNameWithoutSuffix.includes('flash')) {
        openAIModels.push({
          id: "gemini-flash",
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: provider,
          permission: [{
            id: `modelperm-gemini-flash`,
            object: "model_permission",
            created: Math.floor(Date.now() / 1000),
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
          root: modelId,
          parent: null
        });
      }

      // Add 'gemini-pro' alias for gemini-2.5-pro-exp
      if (modelNameWithoutSuffix.includes('pro')) {
        openAIModels.push({
          id: "gemini-pro",
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: provider,
          permission: [{
            id: `modelperm-gemini-pro`,
            object: "model_permission",
            created: Math.floor(Date.now() / 1000),
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
          root: modelId,
          parent: null
        });
      }
    }

    // Track that we've added this model
    addedModelIds.add(modelId);
  });

  // Process all models from OpenRouter
  if (openRouterModels && openRouterModels.data && Array.isArray(openRouterModels.data)) {
    openRouterModels.data.forEach(model => {
      // Only include models we're interested in and haven't already added
      if ((FREE_MODEL_IDS.includes(model.id) || PAID_MODEL_IDS.includes(model.id)) && !addedModelIds.has(model.id)) {
        // Extract provider and model name
        const parts = model.id.split('/');
        const provider = parts[0];
        let modelName = parts[1] || model.id;

        // Remove :free suffix if present
        const modelNameWithoutSuffix = modelName.split(':')[0];

        // Create the main model entry with the full ID
        openAIModels.push({
          id: model.id,
          object: "model",
          created: model.created || Math.floor(Date.now() / 1000),
          owned_by: provider,
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

        // Add multiple aliases to help n8n find the model with different name formats
        if (modelNameWithoutSuffix !== model.id) {
          // Alias 1: Just the model name without provider or :free suffix
          openAIModels.push({
            id: modelNameWithoutSuffix,
            object: "model",
            created: model.created || Math.floor(Date.now() / 1000),
            owned_by: provider,
            permission: [{
              id: `modelperm-${modelNameWithoutSuffix.replace(/\//g, '-').replace(/:/g, '-')}`,
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
            root: model.id, // Point to the full model ID
            parent: null
          });

          // Alias 2: Provider/model without :free suffix
          const providerModelWithoutSuffix = `${provider}/${modelNameWithoutSuffix}`;
          if (providerModelWithoutSuffix !== model.id) {
            openAIModels.push({
              id: providerModelWithoutSuffix,
              object: "model",
              created: model.created || Math.floor(Date.now() / 1000),
              owned_by: provider,
              permission: [{
                id: `modelperm-${providerModelWithoutSuffix.replace(/\//g, '-').replace(/:/g, '-')}`,
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
              root: model.id, // Point to the full model ID
              parent: null
            });
          }

          // Alias 3: For models like gemini-2.0-flash-exp, add gemini-flash as an alias
          if (modelNameWithoutSuffix.includes('-')) {
            const simplifiedName = modelNameWithoutSuffix.split('-').filter(part =>
              !part.match(/^\d/) && part !== 'exp' && part.length > 2
            ).join('-');

            if (simplifiedName && simplifiedName !== modelNameWithoutSuffix) {
              openAIModels.push({
                id: simplifiedName,
                object: "model",
                created: model.created || Math.floor(Date.now() / 1000),
                owned_by: provider,
                permission: [{
                  id: `modelperm-${simplifiedName.replace(/\//g, '-').replace(/:/g, '-')}`,
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
                root: model.id, // Point to the full model ID
                parent: null
              });
            }
          }
        }
      }
    });
  }

  console.log(`[DEBUG] Converted ${openAIModels.length} models: ${openAIModels.map(m => m.id).join(', ')}`);
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
          message: `The model '${modelId}' does not exist or you don't have access to it`,
          type: "invalid_request_error",
          param: "model",
          code: "model_not_found"
        },
        object: "error",
        status: 404,
        lc_error_code: "MODEL_NOT_FOUND"
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
