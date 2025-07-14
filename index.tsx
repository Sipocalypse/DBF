/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

// Define the structure for a bar object.
interface Bar {
  name: string;
  vibe_tags: string[];
  address: string;
  rating: number | null;
  opening_hours: string;
}

// Define the structure for a grounding source.
interface Source {
    uri: string;
    title: string;
}

// Main function to run the application logic
async function main() {
  // Get references to DOM elements
  const findBarsBtn = document.getElementById('find-bars-btn') as HTMLButtonElement;
  const resultsContainer = document.getElementById('results-container') as HTMLElement;
  const sourcesContainer = document.getElementById('sources-container') as HTMLElement;
  const loader = document.getElementById('loader') as HTMLElement;
  
  // This should be set in your environment variables for security.
  const API_KEY = process.env.API_KEY;

  if (!API_KEY) {
      renderError("API key is not configured. Please ensure it's set up correctly.");
      return;
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // Add click event listener to the main button
  findBarsBtn.addEventListener('click', async () => {
    // 1. Show loader and clear previous results
    loader.style.display = 'block';
    resultsContainer.innerHTML = '';
    sourcesContainer.innerHTML = '';

    try {
      // 2. Get user's current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser.'));
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });

      const { latitude, longitude } = position.coords;

      // 3. Define the prompt for the Gemini API with search grounding
      const prompt = `You are an expert local guide API. Your primary function is to find REAL, CURRENTLY OPERATING alternative bars (punk, goth, metal, dive bars) near latitude ${latitude} and longitude ${longitude}.

You MUST use your search tool to verify that each bar exists and is not permanently closed. Prioritize accuracy and real-world data.

Based on your search results, return a raw JSON code block containing a single object with a "bars" key, which is an array of up to 8 bar objects. The JSON object must strictly follow this structure:
{
  "bars": [
    {
      "name": "string",
      "vibe_tags": ["string", "string"],
      "address": "string",
      "rating": "number or null",
      "opening_hours": "string"
    }
  ]
}
Do NOT include any introductory or concluding text outside of the JSON block.`;

      // 4. Call the Gemini API with Google Search enabled
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        },
      });
      
      const textResponse = response.text;
      const jsonMatch = textResponse.match(/```json\n([\s\S]*?)\n```/);
      
      if (!jsonMatch || !jsonMatch[1]) {
        throw new Error("Could not find a valid JSON block in the AI response. The model may have failed to find results.");
      }
      
      const parsedResponse = JSON.parse(jsonMatch[1]);
      
      // 5. Render the results and sources
      renderResults(parsedResponse.bars || []);
      
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(chunk => chunk.web).filter(Boolean) as Source[] || [];
      renderSources(sources);

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
        errorMessage = `Could not fetch data from the AI. ${error.message}`;
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
      
      const displayName = safeDisplay(bar.name);
      const displayAddress = safeDisplay(bar.address);
      const displayHours = safeDisplay(bar.opening_hours);
      const displayRating = bar.rating ? Number(bar.rating).toFixed(1) : 'N/A';
      
      const vibeTagsHtml = Array.isArray(bar.vibe_tags)
        ? bar.vibe_tags.map(tag => `<li class="vibe-tag">${safeDisplay(tag)}</li>`).join('')
        : '';
      
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
   * Renders the list of sources in the sources container.
   * @param sources - An array of Source objects.
   */
  function renderSources(sources: Source[]): void {
      sourcesContainer.innerHTML = ''; // Clear previous content
      if (!sources || sources.length === 0) {
          return;
      }

      const title = document.createElement('h3');
      title.textContent = 'Data Sources';
      sourcesContainer.appendChild(title);

      const ul = document.createElement('ul');
      ul.className = 'sources-list';

      sources.forEach(source => {
          if (source.uri && source.title) {
              const li = document.createElement('li');
              li.className = 'source-item';
              li.innerHTML = `<a href="${source.uri}" target="_blank" rel="noopener noreferrer">${source.title}</a>`;
              ul.appendChild(li);
          }
      });
      sourcesContainer.appendChild(ul);
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
