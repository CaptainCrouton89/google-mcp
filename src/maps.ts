import { Client } from "@googlemaps/google-maps-services-js";
import { z } from "zod";

const googleMapsClient = new Client({});

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
          text: JSON.stringify(
            {
              formatted_address: location.formatted_address,
              latitude: location.geometry.location.lat,
              longitude: location.geometry.location.lng,
              place_id: location.place_id,
              types: location.types,
            },
            null,
            2
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
          text: JSON.stringify(
            {
              formatted_address: location.formatted_address,
              place_id: location.place_id,
              types: location.types,
            },
            null,
            2
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
          text: JSON.stringify(places, null, 2),
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

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              distance: leg.distance.text,
              duration: leg.duration.text,
              start_address: leg.start_address,
              end_address: leg.end_address,
              steps: leg.steps.map((step) => ({
                instruction: step.html_instructions.replace(/<[^>]*>/g, ""),
                distance: step.distance.text,
                duration: step.duration.text,
              })),
            },
            null,
            2
          ),
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
          text: JSON.stringify(results, null, 2),
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

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
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
            },
            null,
            2
          ),
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
