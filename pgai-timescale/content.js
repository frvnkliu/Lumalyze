// Lu.ma Event Rating Chrome Extension - Content Script

// Configuration
const API_ENDPOINT = 'http://localhost:8000/api/event-rating';
const RATING_CIRCLE_CLASS = 'luma-event-rating-circle';
const RATING_TEXT_CLASS = 'luma-event-rating-text';
const UPDATE_INTERVAL = 2000; // Check for new elements every 2 seconds

// Store already processed elements to avoid duplicate ratings
let processedElements = new Set();

// Main function to add rating circles to avatar elements
function addRatingCircles() {
  // Check if we're on lu.ma/ai page
  const isAiPage = window.location.pathname.includes('/ai');
  
  if (isAiPage) {
    // Target event cards on the AI page - using the specific class names from the HTML you provided
    const eventCards = document.querySelectorAll('.jsx-2926199791.card-wrapper');
    
    eventCards.forEach(card => {
      // Check if we've already processed this card
      if (processedElements.has(card)) return;
      
      // Get event data from the card
      const eventLink = card.querySelector('a.event-link');
      if (eventLink) {
        const eventUrl = eventLink.href;
        const eventId = eventUrl.split('/').pop();
        const eventTitle = card.querySelector('h3')?.textContent || 'Unnamed Event';
        
        const eventData = {
          eventId,
          eventTitle,
          url: eventUrl
        };
        
        // Mark as processed
        processedElements.add(card);
        
        // Find the time element specifically
        const timeElement = card.querySelector('.jsx-749509546.event-time');
        
        // Create and insert rating element directly to the time element
        if (timeElement) {
          createRatingElement(timeElement, eventData, true);
        } else {
          createRatingElement(card, eventData, false);
        }
      }
    });
  } else {
    // Target the specific Lu.ma avatar component for other pages
    const avatarContainers = document.querySelectorAll('div.jsx-4140547974.heads.flex-center');
    
    avatarContainers.forEach(container => {
      // Check if we've already processed this container
      if (processedElements.has(container)) return;
      
      // Get event data from the container or its parent elements
      const eventData = extractEventDataFromDOM(container);
      
      if (eventData && eventData.eventId) {
        // Mark as processed
        processedElements.add(container);
        
        // Create and insert rating element
        createRatingElement(container, eventData);
      }
    });
  }
}

// Extract event data from DOM elements
function extractEventDataFromDOM(element) {
  // Try to find the event ID from the URL or nearby elements
  let eventId = null;
  let eventTitle = null;
  
  // First check the URL for event ID
  const urlMatch = window.location.pathname.match(/\/events\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) {
    eventId = urlMatch[1];
  }
  
  // If not in URL, try to find it in nearby elements
  if (!eventId) {
    // Look for event links nearby
    const eventLinks = document.querySelectorAll('a[href*="/events/"]');
    for (const link of eventLinks) {
      const linkMatch = link.href.match(/\/events\/([a-zA-Z0-9_-]+)/);
      if (linkMatch) {
        eventId = linkMatch[1];
        
        // Try to find event title from link text or nearby headings
        const heading = link.querySelector('h1, h2, h3, h4, h5') || 
                         link.closest('div').querySelector('h1, h2, h3, h4, h5');
        if (heading) {
          eventTitle = heading.textContent.trim();
        }
        break;
      }
    }
  }
  
  // Look for event title in heading elements if not found yet
  if (!eventTitle) {
    const headings = document.querySelectorAll('h1, h2');
    if (headings.length > 0) {
      eventTitle = headings[0].textContent.trim();
    }
  }
  
  // If we have at least an event ID, return the data
  if (eventId) {
    return {
      eventId,
      eventTitle,
      url: window.location.href
    };
  }
  
  return null;
}

// Create and add the rating element to the DOM
function createRatingElement(container, eventData, isTimeElement = false) {
  // Create rating circle container
  const ratingElement = document.createElement('div');
  ratingElement.className = RATING_CIRCLE_CLASS;
  ratingElement.style.cssText = `
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: var(--purple, #6c5ce7);
    color: white;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 12px;
    font-size: 13px;
    position: relative;
    cursor: pointer;
    z-index: 10;
  `;
  
  // Add loading state
  ratingElement.textContent = '...';
  
  if (isTimeElement) {
    // Direct insertion into time element
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between'; // This helps position correctly
    
    // Check if there's a text child node we need to wrap
    const textDiv = container.querySelector('.jsx-749509546.min-with-0.text-ellipses.text-tertiary-alpha');
    
    if (textDiv) {
      // Create a wrapper to hold both the time and rating
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      
      // Move the time element into the wrapper and add our rating
      container.insertBefore(wrapper, textDiv);
      wrapper.appendChild(textDiv);
      wrapper.appendChild(ratingElement);
    } else {
      // If we can't find the exact time text element, just append
      container.appendChild(ratingElement);
    }
  } else {
    // Default behavior for other pages
    container.appendChild(ratingElement);
  }
  
  // Fetch rating from API
  fetchEventRating(eventData, ratingElement);
  
  // Add tooltip with more details on hover
  addRatingTooltip(ratingElement, eventData);
}

// Fetch event rating from backend API
async function fetchEventRating(eventData, ratingElement) {
  // Generate mock data for now
  const useMockData = true;
  
  if (useMockData) {
    // Generate random rating between 1-10, with one decimal place
    const rating = parseFloat((Math.random() * 9 + 1).toFixed(1));
    
    // Create mock data
    const mockData = {
      rating: rating,
      explanation: `This is a mock rating for "${eventData.eventTitle}". In the future, this will be real AI-generated data.`,
      eventId: eventData.eventId,
      confidence: "high"
    };
    
    // Wait a short time to simulate API call
    setTimeout(() => {
      updateRatingUI(ratingElement, rating, mockData);
    }, 300);
    
    return;
  }
  
  // Real API call (kept for when mock data is turned off)
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventId: eventData.eventId,
        eventTitle: eventData.eventTitle,
        url: eventData.url
      })
    });
    
    if (!response.ok) throw new Error('API request failed');
    
    const data = await response.json();
    
    // Update UI with rating
    if (data && data.rating !== undefined) {
      updateRatingUI(ratingElement, data.rating, data);
    } else {
      ratingElement.textContent = '?';
      ratingElement.style.backgroundColor = '#999';
    }
  } catch (error) {
    console.error('Error fetching event rating:', error);
    ratingElement.textContent = '?';
    ratingElement.style.backgroundColor = '#999';
  }
}

// Update the UI with the rating data
function updateRatingUI(element, rating, data) {
  // Calculate color based on rating (green for high, yellow for mid, red for low)
  let color;
  if (rating >= 8) {
    color = '#2ecc71'; // Green
  } else if (rating >= 5) {
    color = '#f39c12'; // Yellow
  } else {
    color = '#e74c3c'; // Red
  }
  
  // Update element with whole number display for cleaner look
  // Round to nearest whole number for display
  const displayRating = Math.round(rating);
  element.textContent = displayRating;
  element.style.backgroundColor = color;
  
  // Add a subtle shadow for better visibility
  element.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
  
  // Store the original precise rating and additional data for tooltip
  element.dataset.ratingFull = JSON.stringify({
    ...data,
    displayRating: displayRating,
    preciseRating: rating
  });
}

// Add tooltip functionality to rating element
function addRatingTooltip(element, eventData) {
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'luma-rating-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background-color: #333;
    color: #fff;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    width: 200px;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease-in-out;
    z-index: 1000;
    pointer-events: none;
    margin-bottom: 8px;
  `;
  
  // Add tooltip content
  tooltip.innerHTML = `
    <div style="margin-bottom: 6px;">Loading more details...</div>
  `;
  
  // Append tooltip to rating element
  element.appendChild(tooltip);
  
  // Show tooltip on hover
  element.addEventListener('mouseenter', () => {
    // Check if we have detailed data
    const storedData = element.dataset.ratingFull;
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        const preciseRating = data.preciseRating || data.rating;
        
        tooltip.innerHTML = `
          <div style="margin-bottom: 6px; display: flex; justify-content: space-between;">
            <strong>Rating: ${preciseRating.toFixed(1)}/10</strong>
            <span style="opacity: 0.8; font-size: 11px;">AI-Powered</span>
          </div>
          <div style="margin-bottom: 4px; font-size: 11px; line-height: 1.4;">${data.explanation || 'No explanation available'}</div>
        `;
      } catch (e) {
        tooltip.innerHTML = '<div>Error loading details</div>';
      }
    }
    
    tooltip.style.opacity = '1';
    tooltip.style.visibility = 'visible';
  });
  
  // Hide tooltip on mouse leave
  element.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
  });
}

// Initialize and setup MutationObserver to handle dynamic content
function initialize() {
  // Add initial rating circles
  addRatingCircles();
  
  // Set up periodic checks (fallback for non-mutation cases)
  setInterval(addRatingCircles, UPDATE_INTERVAL);
  
  // Use MutationObserver to detect new content
  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldProcess = true;
        break;
      }
    }
    
    if (shouldProcess) {
      // Process after a short delay to allow DOM to settle
      setTimeout(addRatingCircles, 100);
    }
  });
  
  // Start observing the document body for DOM changes
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}

// Start the extension
initialize();