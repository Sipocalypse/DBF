/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Define the structure for a bar object.
interface Bar {
  name: string;
  vibe_tags: string[];
  address: string;
  rating: number | null;
  opening_hours: string;
}

// Main function to run the application logic
async function main() {
  // Get references to DOM elements
  const findBarsBtn = document.getElementById('find-bars-btn') as HTMLButtonElement;
  const resultsContainer = document.getElementById('results-container') as HTMLElement;
  const loader = document.getElementById('loader') as HTMLElement;

  const displayResults = (bars: Bar[]) => {
    resultsContainer.innerHTML = ''; // Clear any existing content (like placeholder)
    
    if (bars.length === 0) {
      resultsContainer.innerHTML = `<p class="placeholder">No dark dives found in your vicinity. The void stares back.</p>`;
      return;
    }

    const list = document.createElement('ul');
    list.className = 'bar-list';

    bars.forEach(bar => {
      const listItem = document.createElement('li');
      listItem.className = 'bar-item';
      
      const ratingText = bar.rating !== null ? `${bar.rating} ★` : 'N/A';
      
      listItem.innerHTML = `
        <div class="bar-item-content">
          <h2>${bar.name}</h2>
          <ul class="vibe-tags">
            ${bar.vibe_tags.map(tag => `<li class="vibe-tag">${tag}</li>`).join('')}
          </ul>
          <div class="bar-details">
            <span class="rating">${ratingText}</span>
            <span>&bull;</span>
            <span>${bar.opening_hours}</span>
          </div>
          <p class="address">${bar.address}</p>
        </div>
        <a 
          href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bar.name + ', ' + bar.address)}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="map-link"
          aria-label="Open map for ${bar.name}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          <span>Map</span>
        </a>
      `;
      list.appendChild(listItem);
    });

    resultsContainer.appendChild(list);
  };

  const handleError = (error: Error) => {
    console.error('Error finding bars:', error);
    let message = 'An unknown error occurred. Please try again.';
    if (error.message.includes('User denied Geolocation')) {
        message = 'Location access is required to find nearby bars. Please enable it and try again.';
    } else if (error.message.includes('timeout')) {
        message = 'Could not get your location in time. Please check your connection and try again.';
    } else if (error.message.includes('Geolocation is not supported')) {
        message = 'Geolocation is not supported by your browser.';
    } else if (error.message.includes('Webhook') || error.message.includes('Failed to fetch')) {
        message = 'Could not fetch recommendations. The server might be down. Please try again later.';
    } else if (error.message.includes('Invalid data format')) {
        message = 'Received invalid data from the server. Please try again later.';
    }
    
    resultsContainer.innerHTML = `<p class="error-message">${message}</p>`;
  };

  // Add click event listener to the main button
  findBarsBtn.addEventListener('click', async () => {
    // 1. Show loader and clear previous results
    loader.style.display = 'block';
    resultsContainer.innerHTML = '';
    
    try {
      // 2. Get user's current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser.'));
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });

      const { latitude, longitude } = position.coords;

      // 3. Call the Make.com webhook to get bar recommendations
      const webhookUrl = 'https://hook.eu2.make.com/pen72d2cqfpjn1emeghr4rk9cheudezz';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitude, longitude }),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }
      
      let data = await response.json();

      // Make.com can sometimes wrap a JSON response in a string. This handles that case.
      if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (e) {
            throw new Error('Invalid data format: received a non-JSON string.');
        }
      }
      
      if (!data || !Array.isArray(data.bars)) {
          throw new Error('Invalid data format received from webhook.');
      }

      // 4. Display the results
      displayResults(data.bars);

    } catch (error) {
      // 5. Handle any errors that occur
      handleError(error as Error);
    } finally {
      // 6. Hide the loader
      loader.style.display = 'none';
    }
  });
}

// Run the main function when the script loads
main();
