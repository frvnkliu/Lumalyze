# Lu.ma Event Rating Chrome Extension

An AI-powered event recommendation system that uses pgAI to create vector embeddings of Lu.ma event data and provide personalized event suggestions based on user interests.

## Features

- Overlays personalized rating circles on Lu.ma event avatars
- Uses pgAI and TimescaleDB to analyze and store event data
- Provides personalized ratings based on user interests
- Shows trending events based on community ratings
- Customizable user preferences

## Project Structure

```
pgai-timescale/
├── manifest.json         # Chrome extension manifest
├── background.js         # Extension background script
├── content.js            # Content script for Lu.ma overlay
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── api.py                # Backend API using pgAI and TimescaleDB
├── requirements.txt      # Python dependencies
├── timescale-db-credentials.env # Database credentials
└── icons/                # Extension icons
    ├── icon16.svg
    ├── icon48.svg
    └── icon128.svg
```

## Installation

### Backend API Setup

1. Install the Python dependencies:

```bash
pip install -r requirements.txt
```

2. Start the backend API server:

```bash
python api.py
```

The server will run at `http://localhost:8000`.

### Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top-right corner
3. Click "Load unpacked" and select the project directory
4. The extension should now be installed and active

## Development

### API Endpoints

- `GET /`: Health check endpoint
- `POST /api/event-rating`: Get a personalized rating for an event
- `POST /api/update-user-interests`: Update user interests
- `GET /api/trending-events`: Get trending events with highest ratings

### Configuration

- Edit the `API_ENDPOINT` in both `background.js` and `content.js` to point to your backend API server.
- Customize the rating calculation and embedding process in `api.py`.

## Technologies Used

- **Frontend**: JavaScript, HTML, CSS, Chrome Extension API
- **Backend**: FastAPI, SQLAlchemy, pgAI
- **Database**: TimescaleDB with pgvector for vector embeddings
- **AI**: pgAI for creating embeddings of event data

## License

This project is for demonstration purposes only.

## Note on SVG Icons

The extension uses SVG icons which need to be converted to PNG for use with Chrome extensions. You can use online converters or tools like ImageMagick to convert the SVG files to PNG.

```bash
# Example conversion command using ImageMagick
convert -background none icons/icon128.svg icons/icon128.png
convert -background none icons/icon48.svg icons/icon48.png
convert -background none icons/icon16.svg icons/icon16.png
```