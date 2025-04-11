# Enhanced OpenRouter Key Aggregator Implementation

This directory contains enhanced implementations for the OpenRouter Key Aggregator, focusing on improved key management, error handling, and n8n compatibility.

## Key Enhancements

### 1. Enhanced Key Manager (`enhanced-keyManager.js`)

The enhanced Key Manager provides:

- **Detailed Key Metadata Tracking**
  - Credit information (available, total, last checked)
  - Rate limit information (remaining, reset time)
  - Performance metrics (success rate, response time)
  - Model-specific usage tracking

- **Sophisticated Key Selection Algorithm**
  - Scoring system based on multiple factors
  - Weighted selection to prevent any single key from hitting limits
  - Automatic failover to backup keys

- **Thread-Safe Operations**
  - Mutex-based locking for concurrent request handling
  - Prevents race conditions when multiple requests access the key pool

- **Automatic Credit Checking**
  - Regular checks of available credits for each key
  - Automatic disabling of keys with insufficient credits

- **Key Pool Health Monitoring**
  - Regular checks of key pool health
  - Alerts for low capacity or unusual usage patterns

### 2. Enhanced ChatInput Controller (`enhanced-chatInputController.js`)

The enhanced ChatInput Controller provides:

- **Improved Error Handling**
  - Detailed error classification (rate limit, authentication, server)
  - Automatic retries with exponential backoff
  - Intelligent key rotation on errors

- **Support for n8n's Specific Format**
  - Handles array input format with sessionId and action fields
  - Returns responses in the same format as the request

- **Performance Metrics Tracking**
  - Response time measurement
  - Token usage tracking
  - Success/failure rate monitoring

- **Detailed Logging**
  - Request and response logging
  - Error tracking
  - Performance metrics

### 3. Enhanced n8n Response Formatter (`enhanced-n8nResponseFormatter.js`)

The enhanced n8n Response Formatter provides:

- **Support for Multiple Response Formats**
  - OpenRouter standard format
  - OpenRouter generations format
  - Nested response structures

- **Content Handling**
  - Array content handling
  - JSON string content validation
  - Default values for missing fields

- **Error Response Formatting**
  - Ensures error responses have the required structure
  - Includes detailed error information

### 4. Monitoring System (`monitoring.js`)

The new Monitoring System provides:

- **Key Pool Health Monitoring**
  - Regular checks of key pool health
  - Capacity percentage calculation
  - Status tracking for all keys

- **Usage Pattern Detection**
  - Detection of unusual usage patterns
  - Identification of keys approaching limits

- **Alerting System**
  - Alerts for low capacity
  - Alerts for unusual usage
  - Alerts for keys approaching limits

## How to Use

1. Replace the existing files in your OpenRouter Key Aggregator with these enhanced versions:
   - Replace `src/utils/keyManager.js` with `enhanced-keyManager.js`
   - Replace `src/controllers/chatInputController.js` with `enhanced-chatInputController.js`
   - Replace `src/utils/n8nResponseFormatter.js` with `enhanced-n8nResponseFormatter.js`
   - Add `monitoring.js` to your project

2. Update your `index.js` or main application file to initialize the monitoring system:

```javascript
const monitoring = require('./monitoring');

// Initialize monitoring
monitoring.initializeMonitoring();
```

3. Install the required dependencies:

```bash
npm install async-mutex
```

4. Restart your OpenRouter Key Aggregator service.

## Benefits

These enhancements provide several key benefits:

1. **Increased Reliability**
   - Automatic failover when keys hit rate limits
   - Intelligent key selection to maximize available capacity
   - Robust error handling with automatic retries

2. **Improved Performance**
   - Optimized key selection algorithm
   - Performance metrics tracking
   - Response time monitoring

3. **Better n8n Compatibility**
   - Support for n8n's specific format
   - Proper response formatting for AI Agent node
   - Fixes for "Cannot read properties of undefined (reading 'content')" error

4. **Enhanced Monitoring**
   - Key pool health monitoring
   - Usage pattern detection
   - Alerting system for potential issues

5. **Scalability**
   - Thread-safe operations for concurrent requests
   - Efficient key usage distribution
   - Automatic credit checking and key management
