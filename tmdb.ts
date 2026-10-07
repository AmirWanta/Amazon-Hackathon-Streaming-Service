// Shared TMDB types, constants and request helpers.

export const TMDB_API_KEY = 'f44bac236f7a36aaece6a68d35fbb532';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'; // base URL for building image links

export type TMDBShow = {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
};

// Movies use `title` where TV uses `name`; movies are normalized to TMDBShow on fetch.
export type TMDBMovie = Omit<TMDBShow, 'name'> & {title: string};

export type TMDBErrorResponse = {
  status_code?: number;
  status_message?: string;
};

export type TMDBResponse = TMDBErrorResponse & {
  results?: TMDBShow[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readTMDBResponse(response: Response): Promise<TMDBResponse> {
  // Read the raw body first. This avoids response.json() failures seen in
  // some React Native TV runtimes after a successful HTTP response.
  const rawBody =
    typeof response.text === 'function'
      ? await response.text()
      : await response.json();

  const payload =
    typeof rawBody === 'string'
      ? JSON.parse(rawBody.replace(/^﻿/, '').trim())
      : rawBody;

  if (!isObject(payload)) {
    throw new Error(`TMDB returned an unreadable response (HTTP ${response.status}).`);
  }

  return payload as TMDBResponse;
}

export function getTMDBErrorMessage(
  responseStatus: number,
  errorData: TMDBErrorResponse,
) {
  const apiMessage = errorData.status_message
    ? ` TMDB says: ${errorData.status_message}.`
    : '';

  if (responseStatus === 401 || responseStatus === 403 || errorData.status_code === 7 || errorData.status_code === 3) {
    return `TMDB rejected the API key or authorization (HTTP ${responseStatus}). The API key appears invalid or unauthorized.${apiMessage}`;
  }

  return `TMDB was reached, but returned HTTP ${responseStatus}.${apiMessage}`;
}

export async function fetchTMDBList<T>(path: string): Promise<T[]> {
  const response = await fetch(
    `https://api.themoviedb.org/3${path}?api_key=${TMDB_API_KEY}`,
  );
  const data = await readTMDBResponse(response);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(getTMDBErrorMessage(response.status, data));
  }
  return Array.isArray(data.results) ? (data.results as unknown as T[]) : [];
}
