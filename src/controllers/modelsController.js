/**
 * Controller for OpenAI-compatible models endpoint
 */
const axios = require('axios');

let modelsCache = null;
let modelsCacheExpiry = 0;
const CACHE_TTL = 3600000; // 1 hour

// List of free models from OpenRouter
// Add models here to make them visible to clients like n8n
const FREE_MODEL_IDS = [
  "meta-llama/llama-4-maverick:free",
  "meta-llama/llama-4-scout:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemini-2.0-flash-exp:free" // Re-enabled Gemini Flash Experimental
  // "google/gemini-2.5-pro-exp-03-25:free", // Keep others commented if not needed/working
];

const PAID_MODEL_IDS = []; // No paid models for now

// Convert OpenRouter model format to OpenAI format
const convertToOpenAIFormat = (openRouterModels) => {
  const openAIModels = [];
  const addedModelIds = new Set();

  // Use the defined lists to build the response
  const targetModelIds = [...FREE_MODEL_IDS, ...PAID_MODEL_IDS];

  targetModelIds.forEach(modelId => {
    if (addedModelIds.has(modelId)) return; // Avoid duplicates

    const parts = modelId.split('/');
    const provider = parts[0];
    let modelName = parts[1] || modelId;
    const modelNameWithoutSuffix = modelName.split(':')[0];

    // Format 1: Full ID
    openAIModels.push({
      id: modelId, object: "model", created: Math.floor(Date.now() / 1000), owned_by: provider,
      permission: [{ id: `perm-${modelId}`, object: "model_permission", created: Date.now(), allow_create_engine: false, allow_sampling: true, allow_logprobs: true, allow_search_indices: false, allow_view: true, allow_fine_tuning: false, organization: "*", group: null, is_blocking: false }],
      root: modelId, parent: null
    });
    addedModelIds.add(modelId);

    // Format 2: Model Name with suffix (e.g., deepseek-chat-v3-0324:free)
    if (!addedModelIds.has(modelName)) {
        openAIModels.push({ id: modelName, object: "model", created: Math.floor(Date.now() / 1000), owned_by: provider, permission: [{ id: `perm-${modelName}`, object: "model_permission", /*...*/ }], root: modelId, parent: null });
        addedModelIds.add(modelName);
    }

    // Format 3: Model Name without suffix (e.g., deepseek-chat-v3-0324)
    if (modelNameWithoutSuffix !== modelName && !addedModelIds.has(modelNameWithoutSuffix)) {
        openAIModels.push({ id: modelNameWithoutSuffix, object: "model", created: Math.floor(Date.now() / 1000), owned_by: provider, permission: [{ id: `perm-${modelNameWithoutSuffix}`, object: "model_permission", /*...*/ }], root: modelId, parent: null });
        addedModelIds.add(modelNameWithoutSuffix);
    }
  });

  console.log(`[DEBUG] Converted ${openAIModels.length} models for client: ${openAIModels.map(m => m.id).join(', ')}`);
  return openAIModels;
};

const fetchModelsFromOpenRouter = async () => {
  try {
    // Fetching from OpenRouter might still be useful for validation or future features, but not strictly needed for the current response generation
    // const openRouterKey = process.env.OPENROUTER_API_KEYS.split(',')[0];
    // const response = await axios.get('https://openrouter.ai/api/v1/models', { headers: { 'Authorization': `Bearer ${openRouterKey}` } });
    // Currently, we rely solely on the hardcoded lists
    const modelsToReturn = convertToOpenAIFormat(null); // Pass null as we use hardcoded lists

    modelsCache = modelsToReturn;
    modelsCacheExpiry = Date.now() + CACHE_TTL;
    return modelsToReturn;
  } catch (error) {
    console.error('Error fetching/processing models:', error.message);
    return []; 
  }
};

const getModelsData = async () => {
  if (modelsCache && modelsCacheExpiry > Date.now()) {
    console.log('[DEBUG] Returning cached models list.');
    return modelsCache;
  }
  console.log('[DEBUG] Cache expired or empty, fetching/processing models.');
  return await fetchModelsFromOpenRouter();
};

const getModels = async (req, res) => {
  try {
    console.log(`[DEBUG] getModels called.`);
    const models = await getModelsData();
    console.log(`[DEBUG] Returning ${models.length} models.`);
    res.json({ object: "list", data: models });
  } catch (error) {
    console.error('Error in getModels:', error.message);
    res.status(500).json({ error: { message: 'Failed to retrieve models' } });
  }
};

const getModel = async (req, res) => {
  try {
    const modelId = req.params.model;
    console.log(`[DEBUG] getModel called for ID: '${modelId}'`);
    const models = await getModelsData();
    const model = models.find(m => m.id === modelId);
    if (!model) {
      console.log(`[DEBUG] Model '${modelId}' not found in available list.`);
      return res.status(404).json({ error: { message: `The model '${modelId}' does not exist`, code: "model_not_found" } });
    }
    console.log(`[DEBUG] Found model: '${model.id}'`);
    res.json(model);
  } catch (error) {
    console.error('Error in getModel:', error.message);
    res.status(500).json({ error: { message: 'Failed to retrieve model' } });
  }
};

module.exports = {
  getModels,
  getModel,
  getModelsData
};
