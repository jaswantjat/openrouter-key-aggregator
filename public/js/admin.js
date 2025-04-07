// Admin Dashboard JavaScript

// Global variables
let authToken = '';
const apiBaseUrl = '/api';

// DOM Elements
const loginForm = document.getElementById('login-form');
const adminPanel = document.getElementById('admin-panel');
const alertContainer = document.getElementById('alert-container');
const apiKeysTableBody = document.getElementById('api-keys-table-body');
const newKeyForm = document.getElementById('new-key-form');
const newKeyModal = document.getElementById('new-key-modal');
const closeModalBtn = document.querySelector('.close');
const openModalBtn = document.getElementById('open-modal-btn');
const logoutBtn = document.getElementById('logout-btn');
const statusContainer = document.getElementById('status-container');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in
  const savedToken = localStorage.getItem('authToken');
  if (savedToken) {
    authToken = savedToken;
    showAdminPanel();
    loadApiKeys();
    loadStatus();
  } else {
    showLoginForm();
  }

  // Login form submission
  loginForm.addEventListener('submit', handleLogin);

  // New key form submission
  newKeyForm.addEventListener('submit', handleNewKey);

  // Modal controls
  openModalBtn.addEventListener('click', () => {
    newKeyModal.style.display = 'block';
  });

  closeModalBtn.addEventListener('click', () => {
    newKeyModal.style.display = 'none';
  });

  window.addEventListener('click', (event) => {
    if (event.target === newKeyModal) {
      newKeyModal.style.display = 'none';
    }
  });

  // Logout button
  logoutBtn.addEventListener('click', handleLogout);

  // Refresh buttons
  document.getElementById('refresh-keys-btn').addEventListener('click', loadApiKeys);
  document.getElementById('refresh-status-btn').addEventListener('click', loadStatus);
});

// Functions
async function handleLogin(event) {
  event.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  if (!username || !password) {
    showAlert('Please enter both username and password', 'danger');
    return;
  }
  
  try {
    // Create Basic Auth token
    authToken = btoa(`${username}:${password}`);
    
    // Test the credentials by making a request
    const response = await fetch(`${apiBaseUrl}/keys`, {
      headers: {
        'Authorization': `Basic ${authToken}`
      }
    });
    
    if (response.ok) {
      // Save token to localStorage
      localStorage.setItem('authToken', authToken);
      
      // Show admin panel
      showAdminPanel();
      loadApiKeys();
      loadStatus();
      
      showAlert('Login successful', 'success');
    } else {
      showAlert('Invalid credentials', 'danger');
      authToken = '';
    }
  } catch (error) {
    console.error('Login error:', error);
    showAlert('Login failed: ' + error.message, 'danger');
    authToken = '';
  }
}

function handleLogout() {
  authToken = '';
  localStorage.removeItem('authToken');
  showLoginForm();
  showAlert('Logged out successfully', 'info');
}

async function loadApiKeys() {
  if (!authToken) return;
  
  try {
    const spinner = document.getElementById('keys-spinner');
    spinner.classList.remove('hidden');
    
    const response = await fetch(`${apiBaseUrl}/keys`, {
      headers: {
        'Authorization': `Basic ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      renderApiKeys(data.data);
    } else {
      showAlert('Failed to load API keys', 'danger');
    }
    
    spinner.classList.add('hidden');
  } catch (error) {
    console.error('Error loading API keys:', error);
    showAlert('Error loading API keys: ' + error.message, 'danger');
    document.getElementById('keys-spinner').classList.add('hidden');
  }
}

async function loadStatus() {
  if (!authToken) return;
  
  try {
    const spinner = document.getElementById('status-spinner');
    spinner.classList.remove('hidden');
    
    const response = await fetch(`${apiBaseUrl}/status`, {
      headers: {
        'Authorization': `Basic ${authToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      renderStatus(data);
    } else {
      showAlert('Failed to load status', 'danger');
    }
    
    spinner.classList.add('hidden');
  } catch (error) {
    console.error('Error loading status:', error);
    showAlert('Error loading status: ' + error.message, 'danger');
    document.getElementById('status-spinner').classList.add('hidden');
  }
}

async function handleNewKey(event) {
  event.preventDefault();
  
  const name = document.getElementById('key-name').value;
  const rateLimit = document.getElementById('rate-limit').value;
  
  if (!name) {
    showAlert('Please enter a name for the API key', 'danger');
    return;
  }
  
  try {
    const response = await fetch(`${apiBaseUrl}/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authToken}`
      },
      body: JSON.stringify({
        name,
        rateLimit: parseInt(rateLimit) || 0
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Show the new key in a success message
      showAlert(`
        <strong>API Key generated successfully!</strong><br>
        Name: ${data.data.name}<br>
        Key: <span class="key-value">${data.data.key}</span> 
        <i class="fas fa-copy copy-btn" onclick="copyToClipboard('${data.data.key}')"></i><br>
        <strong>Make sure to copy this key now. You won't be able to see it again!</strong>
      `, 'success', 0); // 0 means don't auto-hide
      
      // Reset form and close modal
      document.getElementById('key-name').value = '';
      document.getElementById('rate-limit').value = '';
      newKeyModal.style.display = 'none';
      
      // Reload API keys
      loadApiKeys();
    } else {
      const errorData = await response.json();
      showAlert('Failed to generate API key: ' + (errorData.message || 'Unknown error'), 'danger');
    }
  } catch (error) {
    console.error('Error generating API key:', error);
    showAlert('Error generating API key: ' + error.message, 'danger');
  }
}

async function revokeApiKey(key) {
  if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch(`${apiBaseUrl}/keys/${key}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${authToken}`
      }
    });
    
    if (response.ok) {
      showAlert('API key revoked successfully', 'success');
      loadApiKeys();
    } else {
      const errorData = await response.json();
      showAlert('Failed to revoke API key: ' + (errorData.message || 'Unknown error'), 'danger');
    }
  } catch (error) {
    console.error('Error revoking API key:', error);
    showAlert('Error revoking API key: ' + error.message, 'danger');
  }
}

function renderApiKeys(keys) {
  apiKeysTableBody.innerHTML = '';
  
  if (!keys || keys.length === 0) {
    apiKeysTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">No API keys found. Create your first API key!</td>
      </tr>
    `;
    return;
  }
  
  keys.forEach(key => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${key.name}</td>
      <td><span class="key-value">${key.key}</span> <i class="fas fa-copy copy-btn" onclick="copyToClipboard('${key.key}')"></i></td>
      <td>${key.rateLimit > 0 ? key.rateLimit + ' req/min' : 'Unlimited'}</td>
      <td>${key.lastUsed ? new Date(key.lastUsed).toLocaleString() : 'Never'}</td>
      <td class="actions">
        <button class="btn btn-danger btn-sm" onclick="revokeApiKey('${key.key.replace(/\.\.\./g, '')}')">Revoke</button>
      </td>
    `;
    
    apiKeysTableBody.appendChild(row);
  });
}

function renderStatus(data) {
  statusContainer.innerHTML = '';
  
  // Create summary card
  const summaryCard = document.createElement('div');
  summaryCard.className = 'card mb-4';
  summaryCard.innerHTML = `
    <div class="card-header">
      <h2>OpenRouter API Keys Summary</h2>
    </div>
    <div class="card-body">
      <div class="flex justify-between items-center">
        <div>
          <p><strong>Total Keys:</strong> ${data.summary.totalKeys}</p>
          <p><strong>Active Keys:</strong> ${data.summary.activeKeys}</p>
        </div>
        <div>
          <p><strong>Total Requests:</strong> ${data.summary.totalRequests}</p>
          <p><strong>Remaining Requests:</strong> ${data.summary.totalRemaining}</p>
        </div>
      </div>
    </div>
  `;
  statusContainer.appendChild(summaryCard);
  
  // Create keys table
  const keysCard = document.createElement('div');
  keysCard.className = 'card';
  
  let keysHtml = `
    <div class="card-header">
      <h2>OpenRouter API Keys Status</h2>
    </div>
    <div class="card-body">
      <table class="table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Daily Count</th>
            <th>Minute Count</th>
            <th>Remaining</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  if (data.keys && data.keys.length > 0) {
    data.keys.forEach(key => {
      const status = key.disabled ? 
        '<span class="badge badge-danger">Disabled</span>' : 
        '<span class="badge badge-success">Active</span>';
      
      keysHtml += `
        <tr>
          <td>${key.key}</td>
          <td>${key.dailyCount} / 200</td>
          <td>${key.minuteCount} / 20</td>
          <td>${key.dailyRemaining}</td>
          <td>${status}</td>
        </tr>
      `;
    });
  } else {
    keysHtml += `
      <tr>
        <td colspan="5" class="text-center">No OpenRouter API keys found</td>
      </tr>
    `;
  }
  
  keysHtml += `
        </tbody>
      </table>
    </div>
  `;
  
  keysCard.innerHTML = keysHtml;
  statusContainer.appendChild(keysCard);
}

function showLoginForm() {
  loginForm.classList.remove('hidden');
  adminPanel.classList.add('hidden');
}

function showAdminPanel() {
  loginForm.classList.add('hidden');
  adminPanel.classList.remove('hidden');
}

function showAlert(message, type, timeout = 5000) {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = message;
  
  alertContainer.appendChild(alert);
  
  if (timeout > 0) {
    setTimeout(() => {
      alert.remove();
    }, timeout);
  }
}

// Utility function to copy text to clipboard
function copyToClipboard(text) {
  // Create a temporary input element
  const input = document.createElement('input');
  input.value = text;
  document.body.appendChild(input);
  
  // Select and copy the text
  input.select();
  document.execCommand('copy');
  
  // Remove the temporary element
  document.body.removeChild(input);
  
  // Show a success message
  showAlert('Copied to clipboard!', 'info', 2000);
}

// Make copyToClipboard available globally
window.copyToClipboard = copyToClipboard;
window.revokeApiKey = revokeApiKey;
