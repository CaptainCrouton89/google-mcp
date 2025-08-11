import { Client } from "@googlemaps/google-maps-services-js";
import { z } from "zod";

const googleMapsClient = new Client({});

// Markdown formatting helpers
function formatLocationToMarkdown(title: string, address: string, lat: number, lng: number, placeId?: string): string {
  let markdown = `# ${title}\n\n`;
  markdown += `Address: ${address}  \n`;
  markdown += `Coordinates: ${lat}, ${lng}  \n`;
  if (placeId) markdown += `Place ID: \`${placeId}\`  \n`;
  markdown += `Google Maps: [View on Maps](https://maps.google.com/?q=${lat},${lng})`;
  return markdown;
}

function formatPlacesToMarkdown(places: any[]): string {
  if (!places.length) return "No places found.";
  
  let markdown = `# Places Search Results (${places.length})\n\n`;
  
  places.forEach((place, index) => {
    markdown += `## ${index + 1}. ${place.name}\n`;
    markdown += `Address: ${place.formatted_address}  \n`;
    if (place.rating) {
      markdown += `Rating: ${place.rating}⭐  \n`;
    }
    if (place.latitude && place.longitude) {
      markdown += `Location: ${place.latitude}, ${place.longitude}  \n`;
      markdown += `Maps: [View](https://maps.google.com/?q=${place.latitude},${place.longitude})  \n`;
    }
    if (place.place_id) {
      markdown += `Place ID: \`${place.place_id}\`  \n`;
    }
    markdown += `\n`;
  });
  
  return markdown;
}

function formatDirectionsToMarkdown(route: any): string {
  let markdown = `# Directions: ${route.start_address} → ${route.end_address}\n\n`;
  markdown += `Distance: ${route.distance}  \n`;
  markdown += `Duration: ${route.duration}  \n\n`;
  
  if (route.steps && route.steps.length) {
    markdown += `## Step-by-Step Directions\n\n`;
    route.steps.forEach((step: any, index: number) => {
      markdown += `${index + 1}. ${step.instruction} *(${step.distance}, ${step.duration})*\n`;
    });
  }
  
  return markdown;
}

function formatDistanceMatrixToMarkdown(results: any[]): string {
  let markdown = `# Distance Matrix Results\n\n`;
  
  results.forEach((result, index) => {
    markdown += `## ${index + 1}. ${result.origin} → ${result.destination}\n`;
    markdown += `Distance: ${result.distance}  \n`;
    markdown += `Duration: ${result.duration}  \n`;
    markdown += `Status: ${result.status}  \n\n`;
  });
  
  return markdown;
}

function formatPlaceDetailsToMarkdown(place: any): string {
  let markdown = `# ${place.name}\n\n`;
  
  if (place.formatted_address) markdown += `Address: ${place.formatted_address}  \n`;
  if (place.phone_number) markdown += `Phone: ${place.phone_number}  \n`;
  if (place.website) markdown += `Website: [Visit](${place.website})  \n`;
  
  if (place.rating) {
    markdown += `Rating: ${place.rating}⭐`;
    if (place.user_ratings_total) markdown += ` (${place.user_ratings_total} reviews)`;
    markdown += `  \n`;
  }
  
  if (place.price_level !== undefined) {
    const priceSymbols = '$'.repeat(place.price_level + 1);
    markdown += `Price Level: ${priceSymbols}  \n`;
  }
  
  if (place.latitude && place.longitude) {
    markdown += `Location: ${place.latitude}, ${place.longitude}  \n`;
    markdown += `Maps: [View](https://maps.google.com/?q=${place.latitude},${place.longitude})  \n`;
  }
  
  if (place.opening_hours && place.opening_hours.length) {
    markdown += `\n## Hours\n`;
    place.opening_hours.forEach((hours: string) => {
      markdown += `- ${hours}\n`;
    });
  }
  
  if (place.types && place.types.length) {
    markdown += `\nCategories: ${place.types.join(', ')}`;
  }
  
  return markdown;
}

export const geocodeSchema = z.object({
  address: z.string().describe("The address to geocode"),
});

export const reverseGeocodeSchema = z.object({
  latitude: z.number().describe("The latitude"),
  longitude: z.number().describe("The longitude"),
});

export const placesSearchSchema = z.object({
  query: z.string().describe("The search query"),
  location: z
    .string()
    .optional()
    .describe("Bias results around this location (e.g., 'lat,lng')"),
  radius: z.number().optional().describe("Search radius in meters"),
});

export const directionsSchema = z.object({
  origin: z.string().describe("Starting location (address or lat,lng)"),
  destination: z.string().describe("Ending location (address or lat,lng)"),
  mode: z
    .enum(["driving", "walking", "bicycling", "transit"])
    .optional()
    .describe("Travel mode"),
});

export const distanceMatrixSchema = z.object({
  origins: z.array(z.string()).describe("Array of origin locations"),
  destinations: z.array(z.string()).describe("Array of destination locations"),
  mode: z
    .enum(["driving", "walking", "bicycling", "transit"])
    .optional()
    .describe("Travel mode"),
});

export const placeDetailsSchema = z.object({
  place_id: z.string().describe("The Google Place ID"),
});

export async function geocode(
  params: z.infer<typeof geocodeSchema>,
  extra?: any
) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required");
  }

  try {
    const response = await googleMapsClient.geocode({
      params: {
        address: params.address,
        key: apiKey,
      },
    });

    const results = response.data.results;
    if (results.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No results found for the given address.",
          },
        ],
      };
    }

    const location = results[0];
    return {
      content: [
        {
          type: "text" as const,
          text: formatLocationToMarkdown(
            "Geocoded Location", 
            location.formatted_address, 
            location.geometry.location.lat, 
            location.geometry.location.lng,
            location.place_id
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error geocoding address: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

export async function reverseGeocode(
  params: z.infer<typeof reverseGeocodeSchema>,
  extra?: any
) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required");
  }

  try {
    const response = await googleMapsClient.reverseGeocode({
      params: {
        latlng: [params.latitude, params.longitude],
        key: apiKey,
      },
    });

    const results = response.data.results;
    if (results.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No results found for the given coordinates.",
          },
        ],
      };
    }

    const location = results[0];
    return {
      content: [
        {
          type: "text" as const,
          text: formatLocationToMarkdown(
            "Reverse Geocoded Location",
            location.formatted_address,
            params.latitude,
            params.longitude,
            location.place_id
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error reverse geocoding coordinates: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

export async function placesSearch(
  params: z.infer<typeof placesSearchSchema>,
  extra?: any
) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required");
  }

  try {
    const requestParams: any = {
      query: params.query,
      key: apiKey,
    };

    if (params.location) {
      requestParams.location = params.location;
    }
    if (params.radius) {
      requestParams.radius = params.radius;
    }

    const response = await googleMapsClient.textSearch({
      params: requestParams,
    });

    const results = response.data.results;
    if (results.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No places found for the given query.",
          },
        ],
      };
    }

    const places = results.slice(0, 5).map((place) => ({
      name: place.name,
      formatted_address: place.formatted_address,
      latitude: place.geometry?.location.lat,
      longitude: place.geometry?.location.lng,
      place_id: place.place_id,
      rating: place.rating,
      types: place.types,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: formatPlacesToMarkdown(places),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error searching places: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

export async function getDirections(
  params: z.infer<typeof directionsSchema>,
  extra?: any
) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required");
  }

  try {
    const response = await googleMapsClient.directions({
      params: {
        origin: params.origin,
        destination: params.destination,
        mode: (params.mode || "driving") as any,
        key: apiKey,
      },
    });

    const routes = response.data.routes;
    if (routes.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No routes found between the given locations.",
          },
        ],
      };
    }

    const route = routes[0];
    const leg = route.legs[0];

    const routeData = {
      distance: leg.distance.text,
      duration: leg.duration.text,
      start_address: leg.start_address,
      end_address: leg.end_address,
      steps: leg.steps.map((step) => ({
        instruction: step.html_instructions.replace(/<[^>]*>/g, ""),
        distance: step.distance.text,
        duration: step.duration.text,
      })),
    };

    return {
      content: [
        {
          type: "text" as const,
          text: formatDirectionsToMarkdown(routeData),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error getting directions: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

export async function distanceMatrix(
  params: z.infer<typeof distanceMatrixSchema>,
  extra?: any
) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required");
  }

  try {
    const response = await googleMapsClient.distancematrix({
      params: {
        origins: params.origins,
        destinations: params.destinations,
        mode: (params.mode || "driving") as any,
        key: apiKey,
      },
    });

    const rows = response.data.rows;
    const results = [];

    for (let i = 0; i < params.origins.length; i++) {
      for (let j = 0; j < params.destinations.length; j++) {
        const element = rows[i].elements[j];
        results.push({
          origin: params.origins[i],
          destination: params.destinations[j],
          distance: element.distance?.text || "N/A",
          duration: element.duration?.text || "N/A",
          status: element.status,
        });
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: formatDistanceMatrixToMarkdown(results),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error calculating distance matrix: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

export async function placeDetails(
  params: z.infer<typeof placeDetailsSchema>,
  extra?: any
) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required");
  }

  try {
    const response = await googleMapsClient.placeDetails({
      params: {
        place_id: params.place_id,
        key: apiKey,
      },
    });

    const place = response.data.result;

    const placeData = {
      name: place.name,
      formatted_address: place.formatted_address,
      phone_number: place.formatted_phone_number,
      website: place.website,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      price_level: place.price_level,
      opening_hours: place.opening_hours?.weekday_text,
      types: place.types,
      latitude: place.geometry?.location.lat,
      longitude: place.geometry?.location.lng,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: formatPlaceDetailsToMarkdown(placeData),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error getting place details: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}
