/**
 * Controller for OpenAI-compatible models endpoint
 */

// List of free models we support
const FREE_MODELS = [
  {
    id: "meta-llama/llama-4-maverick:free",
    object: "model",
    created: 1714348800, // April 2025
    owned_by: "meta-llama",
    permission: [{
      id: "modelperm-meta-llama-llama-4-maverick-free",
      object: "model_permission",
      created: 1714348800,
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
    root: "meta-llama/llama-4-maverick:free",
    parent: null
  },
  {
    id: "meta-llama/llama-4-scout:free",
    object: "model",
    created: 1714348800, // April 2025
    owned_by: "meta-llama",
    permission: [{
      id: "modelperm-meta-llama-llama-4-scout-free",
      object: "model_permission",
      created: 1714348800,
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
    root: "meta-llama/llama-4-scout:free",
    parent: null
  },
  {
    id: "google/gemini-2.5-pro-exp-03-25:free",
    object: "model",
    created: 1714348800, // April 2025
    owned_by: "google",
    permission: [{
      id: "modelperm-google-gemini-2.5-pro-exp-03-25-free",
      object: "model_permission",
      created: 1714348800,
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
    root: "google/gemini-2.5-pro-exp-03-25:free",
    parent: null
  },
  {
    id: "deepseek/deepseek-chat-v3-0324:free",
    object: "model",
    created: 1714348800, // April 2025
    owned_by: "deepseek",
    permission: [{
      id: "modelperm-deepseek-deepseek-chat-v3-0324-free",
      object: "model_permission",
      created: 1714348800,
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
    root: "deepseek/deepseek-chat-v3-0324:free",
    parent: null
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    object: "model",
    created: 1714348800, // April 2025
    owned_by: "google",
    permission: [{
      id: "modelperm-google-gemini-2.0-flash-exp-free",
      object: "model_permission",
      created: 1714348800,
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
    root: "google/gemini-2.0-flash-exp:free",
    parent: null
  }
];

// Add some popular paid models
const PAID_MODELS = [
  {
    id: "anthropic/claude-3-opus",
    object: "model",
    created: 1709596800, // March 2024
    owned_by: "anthropic",
    permission: [{
      id: "modelperm-anthropic-claude-3-opus",
      object: "model_permission",
      created: 1709596800,
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
    root: "anthropic/claude-3-opus",
    parent: null
  },
  {
    id: "openai/gpt-4o",
    object: "model",
    created: 1714348800, // April 2025
    owned_by: "openai",
    permission: [{
      id: "modelperm-openai-gpt-4o",
      object: "model_permission",
      created: 1714348800,
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
    root: "openai/gpt-4o",
    parent: null
  }
];

// Combine all models
const ALL_MODELS = [...FREE_MODELS, ...PAID_MODELS];

/**
 * Get list of models
 */
const getModels = (req, res) => {
  res.json({
    object: "list",
    data: ALL_MODELS
  });
};

/**
 * Get a specific model
 */
const getModel = (req, res) => {
  const modelId = req.params.model;
  const model = ALL_MODELS.find(m => m.id === modelId);
  
  if (!model) {
    return res.status(404).json({
      error: {
        message: `Model '${modelId}' not found`,
        type: "invalid_request_error",
        param: null,
        code: "model_not_found"
      }
    });
  }
  
  res.json(model);
};

module.exports = {
  getModels,
  getModel
};
