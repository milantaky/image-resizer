# AsyncResizer — Cloud Computing HW3

Asynchronous image processing demo using **Azure Queue Storage** + **Azure Functions** + **Next.js on App Service**.

## Architecture

```
User Browser
    │
    ▼
Next.js (Azure App Service Free F1)
    │  POST /api/upload
    ├─► Azure Blob Storage [originals container]
    └─► Azure Queue Storage [resize-jobs queue]
                                │
                                ▼ (Queue trigger)
                    Azure Function (Consumption plan)
                                │
                                ▼
                    Azure Blob Storage [thumbnails container]
```

## Message Format

JSON enqueued (base64-encoded) to the `resize-jobs` queue:

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "blobName": "550e8400-e29b-41d4-a716-446655440001.jpg",
  "originalUrl": "https://<account>.blob.core.windows.net/originals/...",
  "uploadedAt": "2024-05-01T12:00:00.000Z",
  "targetWidths": [800, 400, 200]
}
```

---

## Azure Deployment

### 1. Prerequisites

```bash
# Install Azure CLI + Functions Core Tools
brew install azure-cli          # or https://aka.ms/installazurecliwindows
npm install -g azure-functions-core-tools@4 --unsafe-perm true
az login
```

### 2. Create Azure Resources

```bash
RESOURCE_GROUP="rg-async-resizer"
LOCATION="westeurope"
STORAGE_ACCOUNT="stasyncresizer$RANDOM"   # must be globally unique, lowercase, 3-24 chars
FUNCTION_APP="func-async-resizer-$RANDOM"
APP_SERVICE_PLAN="plan-async-resizer"
WEB_APP="web-async-resizer-$RANDOM"

# Resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Storage Account (used for Blob, Queue, and Function internals)
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --allow-blob-public-access true

# Get connection string
CONN_STR=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

echo "Connection string: $CONN_STR"

# Function App (Consumption plan = pay-per-use, free tier available)
az functionapp create \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --storage-account $STORAGE_ACCOUNT \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --os-type Linux

# Set Function App env vars
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "AZURE_STORAGE_CONNECTION_STRING=$CONN_STR" \
    "AZURE_BLOB_CONTAINER_ORIGINALS=originals" \
    "AZURE_BLOB_CONTAINER_THUMBNAILS=thumbnails" \
    "AZURE_QUEUE_NAME=resize-jobs"

# App Service Plan (Free F1 tier)
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --sku F1 \
  --is-linux

# Web App (Next.js)
az webapp create \
  --name $WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --runtime "NODE:20-lts"

# Set Web App env vars
az webapp config appsettings set \
  --name $WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "AZURE_STORAGE_CONNECTION_STRING=$CONN_STR" \
    "AZURE_BLOB_CONTAINER_ORIGINALS=originals" \
    "AZURE_BLOB_CONTAINER_THUMBNAILS=thumbnails" \
    "AZURE_QUEUE_NAME=resize-jobs" \
    "WEBSITE_RUN_FROM_PACKAGE=1"
```

### 3. Deploy Azure Function

```bash
cd function
npm install
npm run build
func azure functionapp publish $FUNCTION_APP --build remote
```

### 4. Deploy Next.js Web App

```bash
cd web
npm install
npm run build

# Zip and deploy
zip -r deploy.zip .next public package.json next.config.mjs node_modules

az webapp deploy \
  --name $WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --src-path deploy.zip \
  --type zip
```

### 5. Configure Web App Startup

```bash
az webapp config set \
  --name $WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --startup-file "node_modules/.bin/next start"
```

### 6. Share Resource Group with Instructor (IAM)

```bash
# Replace with instructor's email/object ID
az role assignment create \
  --assignee "instructor@email.com" \
  --role "Reader" \
  --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP"
```

---

## Local Development

```bash
# Terminal 1 – Next.js
cd web
cp .env.local.example .env.local   # fill in your connection string
npm install
npm run dev

# Terminal 2 – Azure Function (requires Azurite or real Storage)
cd function
npm install
npm run build
func start
```

---

## Cost Estimate

| Service | Tier | Estimated monthly cost |
|---|---|---|
| App Service | F1 Free | $0 |
| Azure Functions | Consumption | ~$0 (1M free executions/month) |
| Azure Storage | LRS | ~$0.02/GB |
| **Total** | | **~$0** |
