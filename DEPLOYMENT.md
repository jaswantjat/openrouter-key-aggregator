# Deployment Guide

This guide explains how to deploy the OpenRouter API Key Aggregator to Render.com for free.

## Prerequisites

1. A [Render.com](https://render.com) account
2. Multiple OpenRouter API keys
3. A GitHub account (optional, for easier deployment)

## Deployment Steps

### Option 1: Deploy from GitHub

1. **Push your code to GitHub**
   - Create a new GitHub repository
   - Push your code to the repository

2. **Create a new Web Service on Render**
   - Go to the Render dashboard
   - Click "New" and select "Web Service"
   - Connect your GitHub repository
   - Select the repository with your OpenRouter API Key Aggregator

3. **Configure the Web Service**
   - Name: `openrouter-key-aggregator` (or any name you prefer)
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Select the free plan

4. **Set Environment Variables**
   - Scroll down to the "Environment" section
   - Add the following environment variables:
     - `OPENROUTER_API_KEYS`: Your comma-separated OpenRouter API keys
     - `PORT`: `3000`
     - `AUTH_ENABLED`: `true` (recommended for production)
     - `AUTH_USERNAME`: Your chosen username
     - `AUTH_PASSWORD`: Your chosen password
     - `OPENROUTER_API_URL`: `https://openrouter.ai/api/v1`

5. **Deploy**
   - Click "Create Web Service"
   - Wait for the deployment to complete

### Option 2: Deploy with Render Blueprint

1. **Fork this repository**

2. **Deploy to Render**
   - Click the "Deploy to Render" button in the README
   - Or go to the Render dashboard, click "New" and select "Blueprint"
   - Connect your GitHub account and select the forked repository
   - Render will automatically detect the `render.yaml` file and create the services

3. **Set Secret Environment Variables**
   - After the services are created, go to the Web Service
   - Add your OpenRouter API keys and authentication credentials

## Verifying Deployment

1. **Check the deployment status**
   - Go to the Web Service in the Render dashboard
   - Check the logs to make sure the service is running

2. **Test the API**
   - Use the status endpoint to check if the service is working:
     ```
     curl https://your-service.onrender.com/api/status
     ```
   - If authentication is enabled, include the Authorization header:
     ```
     curl https://your-service.onrender.com/api/status -H "Authorization: Basic $(echo -n username:password | base64)"
     ```

## Using the Deployed Service

Update your applications to use your new API endpoint:

```
POST https://your-service.onrender.com/api/proxy/chat/completions
```

Include the Authorization header if authentication is enabled:

```
Authorization: Basic base64(username:password)
```

The request body format is identical to OpenRouter's API.
