/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

// Define the structure for a bar object, now with an array for vibe_tags.
interface Bar {
  name: string;
  vibe_tags: string[];
  address: string;
  rating: number;
  opening_hours: string;
}

// Main function to run the application logic
async function main() {
  // Ensure API key is available
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  // Initialize the GoogleGenAI client with the API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Get references to DOM elements
  const findBarsBtn = document.getElementById('find-bars-btn') as HTMLButtonElement;
  const resultsContainer = document.getElementById('results-container') as HTMLElement;
  const loader = document.getElementById('loader') as HTMLElement;

  // Define the expected JSON schema, asking for vibe_tags as an array.
  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Name of the bar.' },
        vibe_tags: {
          type: Type.ARRAY,
          description: 'A list of 1 to 3 tags describing the bar\'s atmosphere or music style (e.g., "Goth", "Metal", "Dive Bar", "Punk", "Live Music").',
          items: { type: Type.STRING }
        },
        address: { type: Type.STRING, description: 'The full street address of the bar.' },
        rating: { type: Type.NUMBER, description: 'The user rating of the bar, out of 5. For example, 4.5.' },
        opening_hours: { type: Type.STRING, description: 'The typical opening hours for the bar (e.g., "5PM - 2AM", "Closed Mondays"). Return "Hours not available" if unknown.' }
      },
      required: ['name', 'vibe_tags', 'address', 'rating', 'opening_hours'],
    },
  };
  
  // Add click event listener to the main button
  findBarsBtn.addEventListener('click', async () => {
    // 1. Show loader and clear previous results
    loader.style.display = 'block';
    resultsContainer.innerHTML = '';
    let responseText = '';

    try {
      // 2. Get user's current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser.'));
        }
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;

      // 3. Construct the prompt for the Gemini API, asking for vibe tags.
      const prompt = `Find the top 10 nearest alternative bars (punk, goth, metal, dive bars) to latitude ${latitude} and longitude ${longitude}. I am looking for places with a dark, alternative, or grungy aesthetic. For each bar, provide its name, a list of 1 to 3 vibe tags, its full address, its user rating out of 5, and its opening hours.`;

      // 4. Call the Gemini API to get bar recommendations
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      // 5. Parse the JSON response robustly
      responseText = response.text;
      let jsonString = responseText.trim();
      if (jsonString.startsWith('```json')) {
          jsonString = jsonString.substring(7, jsonString.length - 3).trim();
      }
      const bars: Bar[] = JSON.parse(jsonString);

      // 6. Render the results
      renderResults(bars);

    } catch (error) {
      // Handle any errors that occur during the process
      console.error(error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error instanceof GeolocationPositionError) {
        switch(error.code) {
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
        errorMessage = 'Failed to read the list of bars from the AI. The format was unexpected. Please try again.';
        console.error("Raw response text:", responseText);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      renderError(errorMessage);
    } finally {
      // 7. Hide the loader regardless of success or failure
      loader.style.display = 'none';
    }
  });

  /**
   * Safely converts a value to a string for display. Prevents [object Object].
   * @param value - The value to convert.
   * @returns A string representation of the value.
   */
  function safeDisplay(value: any): string {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    // If the API returns an object instead of a string, this prevents the error.
    if (typeof value === 'object') {
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
      
      // Defensively handle address for the map link
      const addressString = typeof bar.address === 'string' ? bar.address : '';
      const encodedAddress = encodeURIComponent(`${bar.name}, ${addressString}`);
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      
      const vibeTagsHtml = bar.vibe_tags && Array.isArray(bar.vibe_tags)
        ? bar.vibe_tags.map(tag => `<li class="vibe-tag">${tag}</li>`).join('')
        : '';
        
      const displayHours = safeDisplay(bar.opening_hours);
      const displayAddress = safeDisplay(bar.address);

      li.innerHTML = `
        <div class="bar-item-content">
            <h2>${bar.name}</h2>
            <ul class="vibe-tags">${vibeTagsHtml}</ul>
            <div class="bar-details">
                <span class="rating" title="Rating">★ ${bar.rating ? bar.rating.toFixed(1) : 'N/A'}</span>
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