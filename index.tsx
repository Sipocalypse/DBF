/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Define the structure for a bar object, which matches the webhook's expected output.
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
  const webhookUrl = 'https://hook.eu2.make.com/pen72d2cqfpjn1emeghr4rk9cheudezz';

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

      // 3. Call the Make.com webhook with the user's location
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitude, longitude }),
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed with status ${response.status}.`);
      }

      // 4. Parse the JSON response from the webhook
      const bars: Bar[] = await response.json();

      // 5. Render the results
      renderResults(bars);

    } catch (error) {
      // Handle any errors that occur during the process
      console.error(error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable it in your browser settings to find nearby bars.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'The request to get user location timed out.';
            break;
        }
      } else if (error instanceof SyntaxError) {
        errorMessage = 'Failed to read the list of bars. The format from the server was unexpected.';
      } else if (error instanceof Error) {
        // Use a more generic message for webhook failures
        if (error.message.includes('Webhook request failed')) {
             errorMessage = 'Could not fetch data from the server. Please try again later.';
        } else {
             errorMessage = error.message;
        }
      }
      renderError(errorMessage);
    } finally {
      // 6. Hide the loader regardless of success or failure
      loader.style.display = 'none';
    }
  });

  /**
   * Safely converts a value to a string for display. Prevents [object Object].
   * @param value - The value to convert.
   * @returns A string representation of the value or a fallback.
   */
  function safeDisplay(value: any): string {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      return 'Info unavailable';
    }
    return String(value);
  }

  /**
   * Renders the list of bars in the results container.
   * @param bars - An array of Bar objects.
   */
  function renderResults(bars: Bar[]): void {
    resultsContainer.innerHTML = ''; // Clear previous content

    if (!bars || bars.length === 0) {
      resultsContainer.innerHTML = `<p class="placeholder">No alternative bars found nearby. The darkness eludes you... for now.</p>`;
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'bar-list';

    bars.forEach(bar => {
      const li = document.createElement('li');
      li.className = 'bar-item';
      
      // Prepare values for display, preventing errors
      const displayName = safeDisplay(bar.name);
      const displayAddress = safeDisplay(bar.address);
      const displayHours = safeDisplay(bar.opening_hours);
      const displayRating = bar.rating ? Number(bar.rating).toFixed(1) : 'N/A';
      
      const vibeTagsHtml = Array.isArray(bar.vibe_tags)
        ? bar.vibe_tags.map(tag => `<li class="vibe-tag">${safeDisplay(tag)}</li>`).join('')
        : '';
      
      // Prepare values for the map link, ensuring they are strings
      const mapsName = typeof bar.name === 'string' ? bar.name : '';
      const mapsAddress = typeof bar.address === 'string' ? bar.address : '';
      const encodedAddress = encodeURIComponent(`${mapsName} ${mapsAddress}`);
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

      li.innerHTML = `
        <div class="bar-item-content">
            <h2>${displayName}</h2>
            <ul class="vibe-tags">${vibeTagsHtml}</ul>
            <div class="bar-details">
                <span class="rating" title="Rating">★ ${displayRating}</span>
                <span class="hours" title="Opening Hours">🕒 ${displayHours}</span>
            </div>
            <p class="address">${displayAddress}</p>
        </div>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="map-link" title="Open in Google Maps">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
          <span>Directions</span>
        </a>
      `;
      ul.appendChild(li);
    });

    resultsContainer.appendChild(ul);
  }

  /**
   * Renders an error message in the results container.
   * @param message - The error message to display.
   */
  function renderError(message: string): void {
    resultsContainer.innerHTML = `<div class="error-message">${message}</div>`;
  }
}

// Run the main function when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', main);
