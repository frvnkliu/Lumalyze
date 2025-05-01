// Lu.ma Event Rating Chrome Extension - Popup Script

// DOM elements
const tabButtons = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const apiStatus = document.querySelector('.api-status .status-badge');
const trendingEventsList = document.getElementById('trending-events');
const interestsContainer = document.getElementById('interests-container');
const newInterestInput = document.getElementById('new-interest');
const addInterestButton = document.getElementById('add-interest');
const saveInterestsButton = document.getElementById('save-interests');
const showRatingsToggle = document.getElementById('show-ratings');
const ratingColorToggle = document.getElementById('rating-color');
const saveSettingsButton = document.getElementById('save-settings');

// Configuration
const API_ENDPOINT = 'http://localhost:8000/api';
const USER_PREFS_KEY = 'lumaRatingUserPreferences';

// State
let userInterests = [];
let appSettings = {
  showRatings: true,
  ratingColor: true
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Set up tab navigation
  setupTabs();
  
  // Load user preferences
  await loadUserPreferences();
  
  // Check API connection
  checkApiConnection();
  
  // Load trending events
  loadTrendingEvents();
  
  // Set up event listeners
  setupEventListeners();
});

// Set up tab navigation
function setupTabs() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab
      button.classList.add('active');
      
      // Show corresponding tab content
      const tabId = button.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

// Load user preferences from storage
async function loadUserPreferences() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_PREFERENCES' }, response => {
      if (response && response.success && response.preferences) {
        // Update app state with preferences
        userInterests = response.preferences.userInterests || [];
        appSettings.showRatings = response.preferences.showRatings !== undefined 
          ? response.preferences.showRatings 
          : true;
        appSettings.ratingColor = response.preferences.ratingColor !== undefined 
          ? response.preferences.ratingColor 
          : true;
        
        // Update UI with preferences
        updateInterestsUI();
        updateSettingsUI();
      }
      resolve();
    });
  });
}

// Update interests UI
function updateInterestsUI() {
  // Clear existing interests
  interestsContainer.innerHTML = '';
  
  // Add each interest as a tag
  userInterests.forEach((interest, index) => {
    const tag = document.createElement('span');
    tag.className = 'interest-tag';
    tag.innerHTML = `
      ${interest}
      <span class="remove-tag" data-index="${index}">×</span>
    `;
    interestsContainer.appendChild(tag);
  });
  
  // Add click listeners to remove buttons
  document.querySelectorAll('.remove-tag').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.getAttribute('data-index'));
      userInterests.splice(index, 1);
      updateInterestsUI();
    });
  });
}

// Update settings UI
function updateSettingsUI() {
  showRatingsToggle.checked = appSettings.showRatings;
  ratingColorToggle.checked = appSettings.ratingColor;
}

// Check API connection
function checkApiConnection() {
  fetch(`${API_ENDPOINT}/trending-events`)
    .then(response => {
      if (response.ok) {
        apiStatus.textContent = 'API Connected';
        apiStatus.classList.remove('disconnected');
        apiStatus.classList.add('connected');
      } else {
        throw new Error('API connection failed');
      }
    })
    .catch(error => {
      console.error('API connection error:', error);
      apiStatus.textContent = 'API Disconnected';
      apiStatus.classList.remove('connected');
      apiStatus.classList.add('disconnected');
    });
}

// Load trending events
function loadTrendingEvents() {
  chrome.runtime.sendMessage({ type: 'GET_TRENDING_EVENTS' }, response => {
    if (response && response.success && response.events) {
      displayTrendingEvents(response.events);
    } else {
      displayTrendingEventsError();
    }
  });
}

// Display trending events
function displayTrendingEvents(events) {
  if (!events || events.length === 0) {
    trendingEventsList.innerHTML = `
      <div class="empty-state">
        <i>📅</i>
        <p>No trending events found</p>
      </div>
    `;
    return;
  }
  
  // Clear loading state
  trendingEventsList.innerHTML = '';
  
  // Add each event to the list
  events.forEach(event => {
    // Determine rating class
    let ratingClass = 'high';
    if (event.avgRating < 5) {
      ratingClass = 'low';
    } else if (event.avgRating < 8) {
      ratingClass = 'medium';
    }
    
    // Create event item element
    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    eventItem.innerHTML = `
      <div class="event-title">${event.title || 'Unnamed Event'}</div>
      <div class="event-meta">
        <div class="event-rating ${ratingClass}">${Math.round(event.avgRating)}</div>
        <span>${event.ratingCount} ratings</span>
      </div>
    `;
    
    // Add click listener to open event page
    eventItem.addEventListener('click', () => {
      if (event.url) {
        chrome.tabs.create({ url: event.url });
      }
    });
    
    trendingEventsList.appendChild(eventItem);
  });
}

// Display error message for trending events
function displayTrendingEventsError() {
  trendingEventsList.innerHTML = `
    <div class="empty-state">
      <i>❌</i>
      <p>Could not load trending events</p>
    </div>
  `;
}

// Set up event listeners
function setupEventListeners() {
  // Add new interest
  addInterestButton.addEventListener('click', () => {
    addNewInterest();
  });
  
  // Add interest on Enter key
  newInterestInput.addEventListener('keypress', event => {
    if (event.key === 'Enter') {
      addNewInterest();
    }
  });
  
  // Save interests
  saveInterestsButton.addEventListener('click', () => {
    saveUserInterests();
  });
  
  // Save settings
  saveSettingsButton.addEventListener('click', () => {
    saveUserSettings();
  });
}

// Add new interest
function addNewInterest() {
  const interest = newInterestInput.value.trim();
  
  if (!interest) return;
  
  // Check if interest already exists
  if (userInterests.includes(interest)) {
    newInterestInput.value = '';
    return;
  }
  
  // Add interest and update UI
  userInterests.push(interest);
  newInterestInput.value = '';
  updateInterestsUI();
}

// Save user interests
function saveUserInterests() {
  const preferences = {
    userInterests: userInterests
  };
  
  chrome.runtime.sendMessage(
    { type: 'UPDATE_PREFERENCES', preferences },
    response => {
      if (response && response.success) {
        // Show success message
        const button = saveInterestsButton;
        const originalText = button.textContent;
        
        button.textContent = 'Saved!';
        button.disabled = true;
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 2000);
      } else {
        console.error('Failed to save interests');
      }
    }
  );
}

// Save user settings
function saveUserSettings() {
  appSettings.showRatings = showRatingsToggle.checked;
  appSettings.ratingColor = ratingColorToggle.checked;
  
  const preferences = {
    showRatings: appSettings.showRatings,
    ratingColor: appSettings.ratingColor
  };
  
  chrome.runtime.sendMessage(
    { type: 'UPDATE_PREFERENCES', preferences },
    response => {
      if (response && response.success) {
        // Show success message
        const button = saveSettingsButton;
        const originalText = button.textContent;
        
        button.textContent = 'Saved!';
        button.disabled = true;
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 2000);
      } else {
        console.error('Failed to save settings');
      }
    }
  );
}