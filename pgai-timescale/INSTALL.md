# Lu.ma Event Rating Extension Installation Guide

This guide will walk you through setting up the Lu.ma Event Rating Chrome extension.

## Prerequisites

- Chrome browser
- Node.js and npm (for running the API server)
- OpenAI API key
- Running TimescaleDB instance (credentials in timescale-db-99171-credentials.env)

## Step 1: Set up the API Server

1. Navigate to the project directory:
```bash
cd /Users/vee/Desktop/Github/Solo_Scripts/pgai-timescale
```

2. Install the Python dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file with your OpenAI API key:
```bash
echo "OPENAI_API_KEY=your-openai-api-key" > .env
```

4. Start the API server:
```bash
python api.py
```

The server will run at `http://localhost:8000`.

## Step 2: Load the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`

2. Enable "Developer mode" by toggling the switch in the top-right corner

3. Click "Load unpacked" and select the extension directory:
```
/Users/vee/Desktop/Github/Solo_Scripts/pgai-timescale
```

4. The extension should now be visible in your extensions list and active in the toolbar

## Step 3: Test the Extension

1. Make sure the API server is running (`python api.py`)

2. Open Lu.ma in your browser (https://lu.ma)

3. Navigate to an event page or any page showing event avatars

4. You should see rating circles appearing next to the avatar components

5. Hover over a rating circle to see more details

## Step 4: Customize Your Interests

1. Click on the extension icon in the Chrome toolbar

2. Navigate to the "My Interests" tab

3. Add your interests to get more personalized event ratings

4. Click "Save Interests" to update your preferences

## Troubleshooting

- If the rating circles don't appear, check the console for any errors
- Ensure the API server is running and accessible at http://localhost:8000
- Check that the TimescaleDB connection is working properly
- Verify that your OpenAI API key is valid and has sufficient credits

## Development Notes

- The extension uses:
  - content.js - for injecting rating circles into Lu.ma pages
  - background.js - for handling API requests and managing state
  - popup.html/js - for the extension UI
  
- The API server uses:
  - FastAPI for creating endpoints
  - pgvector for vector operations in TimescaleDB
  - OpenAI for generating embeddings

## Converting SVG Icons to PNG

The extension uses SVG icons that need to be converted to PNG for Chrome:

```bash
# Install ImageMagick if needed
brew install imagemagick

# Convert SVG icons to PNG
mkdir -p icons
convert -background none icons/icon128.svg icons/icon128.png
convert -background none icons/icon48.svg icons/icon48.png
convert -background none icons/icon16.svg icons/icon16.png
```