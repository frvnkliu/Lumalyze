// Lu.ma Event Rating Chrome Extension - Background Script

// Configuration
const API_ENDPOINT = 'http://localhost:8000/api';
const AUTH_STATUS_KEY = 'lumaRatingAuthStatus';
const USER_PREFS_KEY = 'lumaRatingUserPreferences';

// Default user preferences
const DEFAULT_PREFERENCES = {
  showRatings: true,
  ratingColor: true,
  userInterests: ['technology', 'artificial intelligence', 'data science']
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Lu.ma Event Rating extension installed');
  
  // Set default user preferences if not already set
  const existingPrefs = await chrome.storage.local.get(USER_PREFS_KEY);
  if (!existingPrefs[USER_PREFS_KEY]) {
    await chrome.storage.local.set({ [USER_PREFS_KEY]: DEFAULT_PREFERENCES });
    console.log('Default preferences set');
  }
  
  // Initialize auth status
  await chrome.storage.local.set({ [AUTH_STATUS_KEY]: { isAuthenticated: false } });
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'UPDATE_PREFERENCES') {
    handleUpdatePreferences(request.preferences, sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  if (request.type === 'GET_PREFERENCES') {
    handleGetPreferences(sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  if (request.type === 'GET_TRENDING_EVENTS') {
    handleGetTrendingEvents(sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  if (request.type === 'UPDATE_USER_INTERESTS') {
    handleUpdateUserInterests(request.interests, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

// Handle preference updates
async function handleUpdatePreferences(newPreferences, sendResponse) {
  try {
    // Get current preferences
    const data = await chrome.storage.local.get(USER_PREFS_KEY);
    const currentPrefs = data[USER_PREFS_KEY] || DEFAULT_PREFERENCES;
    
    // Merge with new preferences
    const updatedPrefs = { ...currentPrefs, ...newPreferences };
    
    // Save updated preferences
    await chrome.storage.local.set({ [USER_PREFS_KEY]: updatedPrefs });
    
    // If user interests changed, update them on the server
    if (newPreferences.userInterests && 
        JSON.stringify(newPreferences.userInterests) !== JSON.stringify(currentPrefs.userInterests)) {
      await updateUserInterestsOnServer(newPreferences.userInterests);
    }
    
    sendResponse({ success: true, preferences: updatedPrefs });
  } catch (error) {
    console.error('Error updating preferences:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle getting preferences
async function handleGetPreferences(sendResponse) {
  try {
    const data = await chrome.storage.local.get(USER_PREFS_KEY);
    const preferences = data[USER_PREFS_KEY] || DEFAULT_PREFERENCES;
    sendResponse({ success: true, preferences });
  } catch (error) {
    console.error('Error getting preferences:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get trending events from API
async function handleGetTrendingEvents(sendResponse) {
  try {
    const response = await fetch(`${API_ENDPOINT}/trending-events`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch trending events');
    }
    
    const data = await response.json();
    sendResponse({ success: true, events: data.trendingEvents });
  } catch (error) {
    console.error('Error fetching trending events:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Update user interests on server
async function handleUpdateUserInterests(interests, sendResponse) {
  try {
    const result = await updateUserInterestsOnServer(interests);
    sendResponse({ success: true, result });
  } catch (error) {
    console.error('Error updating user interests:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Helper function to update user interests on server
async function updateUserInterestsOnServer(interests) {
  const response = await fetch(`${API_ENDPOINT}/update-user-interests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ interests })
  });
  
  if (!response.ok) {
    throw new Error('Failed to update user interests on server');
  }
  
  return await response.json();
}