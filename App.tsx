import React, {useEffect, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  ImageBackground,
  Image,
} from 'react-native';
import PlayerScreen from './components/PlayerScreen';

// Reads the public proxy address that the Expo bundle uses to request catalog
// metadata. This is configuration only: it identifies the gateway, never the
// upstream credential, and is the first step in the client-to-proxy workflow.
function getProxyBaseUrl() {
  return process.env.EXPO_PUBLIC_PROXY_BASE_URL?.replace(/\/$/, '');
  
}

// Builds the proxy URL used for poster and backdrop images. Keeping this behind
// the same gateway means the client does not need to know which upstream image
// service supplies the catalog artwork.
function getProxyImageBase() {
  const proxyBaseUrl = getProxyBaseUrl();
  return proxyBaseUrl ? `${proxyBaseUrl}/v1/images` : '';
}

// Catalog image paths are already full proxy routes (/v1/images/{id}/poster),
// so they only need the proxy base URL in front of them.
function getCatalogImageUrl(path: string) {
  const proxyBaseUrl = getProxyBaseUrl();
  return path && proxyBaseUrl ? `${proxyBaseUrl}${path}` : undefined;
}

// Limits how long the client waits for KrakenD. A proxy or upstream service
// can be reachable but stalled, so this guard moves the app into its readable
// fallback/error workflow instead of leaving the loading message forever.
async function fetchProxyResponse(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    return await fetch(url, {signal: controller.signal});
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'The catalog proxy did not respond within 10 seconds. Check that KrakenD is running and reachable from this device.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

type CatalogItem = {
  id: string;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  media_type: 'show' | 'movie';
  genres: string[];
  provider_ids: Record<string, string>;
  premiere_date?: string;
  date_created?: string;
};

type MyListSort = 'recentlyAdded' | 'new' | 'rating';

const MY_LIST_STORAGE_KEY = '@firelight/my-list';
const MY_LIST_SORT_STORAGE_KEY = '@firelight/my-list-sort';

type ProxyErrorResponse = {
  status_code?: number;
  status_message?: string;
};

type JellyfinItem = {
  Id?: string;
  Name?: string;
  Overview?: string;
  ImageTags?: {
    Primary?: string;
  };
  BackdropImageTags?: string[];
  CommunityRating?: number;
  Genres?: string[];
  ProviderIds?: Record<string, string>;
  Type?: string;
  PremiereDate?: string;
  DateCreated?: string;
};

type CatalogResponse = ProxyErrorResponse & {
  Items?: JellyfinItem[];
};

type ShowsCache = {
  shows: CatalogItem[];
  refreshedAt: string;
};

type MoviesCache = {
  movies: CatalogItem[];
  refreshedAt: string;
};

let inMemoryShowsCache: string | null = null;
let inMemoryMoviesCache: string | null = null;

function normalizeJellyfinItems(
  items: JellyfinItem[],
  mediaType: CatalogItem['media_type'],
): CatalogItem[] {
  return items
    .filter(item => typeof item.Id === 'string' && typeof item.Name === 'string')
    .map(item => ({
      id: item.Id as string,
      name: item.Name as string,
      overview: item.Overview ?? 'No description available.',
      poster_path: item.ImageTags?.Primary
        ? `/v1/images/${encodeURIComponent(item.Id as string)}/poster`
        : '',
      backdrop_path: item.BackdropImageTags?.length
        ? `/v1/images/${encodeURIComponent(item.Id as string)}/backdrop`
        : item.ImageTags?.Primary
          ? `/v1/images/${encodeURIComponent(item.Id as string)}/poster`
          : '',
      vote_average:
        typeof item.CommunityRating === 'number' ? item.CommunityRating : 0,
      media_type: mediaType,
      genres: Array.isArray(item.Genres) ? item.Genres : [],
      provider_ids: item.ProviderIds ?? {},
      premiere_date: item.PremiereDate,
      date_created: item.DateCreated,
    }));
}

function sortMyList(items: CatalogItem[], sort: MyListSort): CatalogItem[] {
  return [...items].sort((left, right) => {
    if (sort === 'rating') {
      return right.vote_average - left.vote_average || left.name.localeCompare(right.name);
    }

    if (sort === 'new') {
      const rightDate = Date.parse(right.premiere_date ?? right.date_created ?? '') || 0;
      const leftDate = Date.parse(left.premiere_date ?? left.date_created ?? '') || 0;
      return rightDate - leftDate || left.name.localeCompare(right.name);
    }

    // `addedAt` is attached when an item enters the list. Stored items use
    // this non-catalog field; the cast keeps the catalog model reusable.
    const rightAdded = (right as CatalogItem & {addedAt?: number}).addedAt ?? 0;
    const leftAdded = (left as CatalogItem & {addedAt?: number}).addedAt ?? 0;
    return rightAdded - leftAdded || left.name.localeCompare(right.name);
  });
}

async function readMyList(): Promise<(CatalogItem & {addedAt: number})[]> {
  try {
    const raw = await AsyncStorage.getItem(MY_LIST_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(item => item && typeof item.id === 'string' && typeof item.addedAt === 'number')
      : [];
  } catch (error) {
    console.warn('My List could not be read:', error);
    return [];
  }
}

async function writeMyList(items: (CatalogItem & {addedAt: number})[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MY_LIST_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('My List could not be saved:', error);
  }
}

async function readMyListSort(): Promise<MyListSort> {
  const raw = await AsyncStorage.getItem(MY_LIST_SORT_STORAGE_KEY);
  return raw === 'new' || raw === 'rating' || raw === 'recentlyAdded'
    ? raw
    : 'recentlyAdded';
}

async function writeMyListSort(sort: MyListSort): Promise<void> {
  await AsyncStorage.setItem(MY_LIST_SORT_STORAGE_KEY, sort);
}

function readCache<T extends ShowsCache | MoviesCache>(raw: string | null): T | null {
  try {
    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw) as T;
    const items = 'shows' in cached ? cached.shows : cached.movies;
    return Array.isArray(items) && typeof cached.refreshedAt === 'string'
      ? cached
      : null;
  } catch (error) {
    console.warn('Catalog cache could not be read:', error);
    return null;
  }
}

// Reads the most recent catalog response from the in-memory fallback cache so
// the UI can still show previously loaded shows when the proxy is unavailable.
async function readShowsCache(): Promise<ShowsCache | null> {
  return readCache<ShowsCache>(inMemoryShowsCache);
}

// Stores the latest successful catalog response and its timestamp for the
// fallback path used when a later proxy request cannot be completed.
async function writeShowsCache(shows: CatalogItem[]): Promise<void> {
  const cache: ShowsCache = {
    shows,
    refreshedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(cache);
  inMemoryShowsCache = raw;
}

async function readMoviesCache(): Promise<MoviesCache | null> {
  return readCache<MoviesCache>(inMemoryMoviesCache);
}

async function writeMoviesCache(movies: CatalogItem[]): Promise<void> {
  const cache: MoviesCache = {
    movies,
    refreshedAt: new Date().toISOString(),
  };
  inMemoryMoviesCache = JSON.stringify(cache);
}

// Compares two catalog result lists to decide whether the successful proxy
// response contains new metadata worth replacing in the fallback cache.
function catalogItemsAreEqual(left: CatalogItem[], right: CatalogItem[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

// Confirms that parsed network data is a JSON object before the client reads
// fields from it. This keeps malformed proxy responses readable and actionable.
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Reads and validates the proxy response body. The proxy preserves upstream
// status and error bodies, so this function gives the rest of the app one safe
// response shape to use for both success and failure handling.
async function readProxyResponse(response: Response): Promise<CatalogResponse> {
  // Read the raw body first. This avoids response.json() failures seen in
  // some React Native TV runtimes after a successful HTTP response.
  const rawBody =
    typeof response.text === 'function'
      ? await response.text()
      : await response.json();

  const payload =
    typeof rawBody === 'string'
      ? JSON.parse(rawBody.replace(/^\uFEFF/, '').trim())
      : rawBody;

  if (!isObject(payload)) {
    throw new Error(`The catalog proxy returned an unreadable response (HTTP ${response.status}).`);
  }

  return payload as CatalogResponse;
}

async function fetchCatalogItems(
  proxyBaseUrl: string,
  endpoint: string,
  mediaType: CatalogItem['media_type'],
): Promise<CatalogItem[]> {
  const response = await fetchProxyResponse(`${proxyBaseUrl}${endpoint}`);
  const data = await readProxyResponse(response);

  if (!(response.status >= 200 && response.status < 300)) {
    throw new Error(getProxyErrorMessage(response.status, data));
  }

  if (!Array.isArray(data.Items)) {
    throw new Error(
      'The catalog proxy returned a Jellyfin response without an Items list. Check the proxy response contract or Jellyfin configuration.',
    );
  }

  return normalizeJellyfinItems(data.Items, mediaType);
}

// Converts a proxy or upstream HTTP failure into a message that explains the
// likely action, such as checking the server-side credential or proxy status.
function getProxyErrorMessage(
  responseStatus: number,
  errorData: ProxyErrorResponse,
) {
  const apiMessage = errorData.status_message
    ? ` Upstream service says: ${errorData.status_message}.`
    : '';

  if (responseStatus === 401 || responseStatus === 403 || errorData.status_code === 7 || errorData.status_code === 3) {
    return `The catalog proxy could not authorize its upstream request (HTTP ${responseStatus}). Check the server-side API credential.${apiMessage}`;
  }

  return `The catalog proxy returned HTTP ${responseStatus}.${apiMessage}`;
}

/**
 * Reusable CTA button for the hero area.
 */
// Renders a D-pad-friendly button for hero actions and tracks focus/hover state
// so Fire OS users can see which action will run when they press Select.
function FocusableButton({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      focusable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      style={[
        primary ? styles.primaryButton : styles.secondaryButton,
        (focused || hovered) && styles.focusedButton,
      ]}>
      <Text style={primary ? styles.primaryButtonText : styles.secondaryButtonText}>
        {label}
      </Text>
    </Pressable>
  );
}

// Renders one navigation tab and reports focus and selection changes back to
// the main screen so the current browsing section remains visible.
function NavTab({
  tab,
  activeTab,
  setActiveTab,
  focusedTab,
  setFocusedTab,
}: {
  tab: string;
  activeTab: string;
  setActiveTab: (t: string) => void;
  focusedTab: string;
  setFocusedTab: (t: string) => void;
}) {
  return (
    <Pressable
      focusable
      onPress={() => setActiveTab(tab)}
      onFocus={() => setFocusedTab(tab)}
      style={[
        styles.navItem,
        focusedTab === tab && styles.activeNavItem,
      ]}>
      <Text
        style={[
          styles.navText,
          focusedTab === tab && styles.activeNavText,
        ]}>
        {tab}
      </Text>
    </Pressable>
  );
}

/* Poster renders a real image from the catalog proxy's poster_path
   instead of a flat colored box + text. Title still overlays as a caption
   below the image, same as before. ===== */
// Renders a show poster using the proxy image route and opens the selected show
// when the user presses the poster from the D-pad or another input device.
function Poster({
  show,
  onPress,
  preferredFocus = false,
}: {
  show: CatalogItem;
  onPress: () => void;
  preferredFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPreviewTimer = () => {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
  };

  const startPreviewTimer = () => {
    clearPreviewTimer();
    setPreviewVisible(false);
    previewTimer.current = setTimeout(() => {
      // Preview media is not available yet. The black panel is intentional
      // and reserves the exact poster-art dimensions for the future preview.
      setPreviewVisible(true);
    }, 5000);
  };

  useEffect(() => clearPreviewTimer, []);

  return (
    <Pressable
      focusable
      hasTVPreferredFocus={preferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        startPreviewTimer();
      }}
      onBlur={() => {
        setFocused(false);
        clearPreviewTimer();
        setPreviewVisible(false);
      }}
      onHoverIn={() => {
        setHovered(true);
        startPreviewTimer();
      }}
      onHoverOut={() => {
        setHovered(false);
        clearPreviewTimer();
        setPreviewVisible(false);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open ${show.name}`}
      style={styles.poster}>
      <View pointerEvents="none">
        {previewVisible ? (
          <View style={styles.previewScreen} accessibilityLabel={`${show.name} preview`} />
        ) : (
          <Image
            source={
              getCatalogImageUrl(show.poster_path)
                ? {uri: getCatalogImageUrl(show.poster_path)}
                : undefined
            }
            style={styles.posterArt}
            resizeMode="cover"
          />
        )}
        <Text style={styles.posterTitle} numberOfLines={1}>
          {show.name}
        </Text>
        <Text style={styles.posterDetail} numberOfLines={2}>
          {show.overview}
        </Text>
      </View>
      {(focused || hovered) && (
        <View style={styles.focusBorder} pointerEvents="none" />
      )}
    </Pressable>
  );
}
/* ===== END CHANGED ===== */

/* Hero banner behaves like a Poster: pressable, with the same white
   focus/hover border, and opens the featured show's details. */
// Renders the featured hero card, including the proxy-served backdrop and the
// actions that move the user into playback or the personal list workflow.
function HeroCard({
  show,
  onPress,
  children,
}: {
  show?: CatalogItem;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      focusable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={show ? `Open ${show.name}` : 'Featured show'}
      style={styles.hero}>
      {children}
      {(focused || hovered) && (
        <View style={[styles.focusBorder, styles.heroFocusBorder]} pointerEvents="none" />
      )}
    </Pressable>
  );
}

/* when the hovered poster is selected, opens a new tab.
There is a back button  in the new tab, styled already.
There are the show's information including the backdrop, the rating,
the overview, poster as well.


9/25 NOW includes verticalscroll indicator and can be scrolled 
*/
// Renders the selected show's details and provides the navigation callbacks
// needed to return to browsing or begin playback from the detail view.
function ShowDetails({
  show,
  onBack,
  onPress,
  isInMyList,
  onToggleMyList,
}: {
  show: CatalogItem;
  onBack: () => void;
  onPress?: () => void;
  isInMyList: boolean;
  onToggleMyList: () => void;
}) {
  const [backFocused, setBackFocused] = useState(false);
  const [playFocused, setPlayFocused] = useState(false);
  const [detailsFocused, setDetailsFocused] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        focusable
        showsVerticalScrollIndicator
        contentContainerStyle={styles.detailScreen}
        directionalLockEnabled>
        <Pressable
          focusable
          onPress={onBack}
          onFocus={() => setBackFocused(true)}
          onBlur={() => setBackFocused(false)}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          style={[
            styles.detailBackButton,
            backFocused && styles.focusedButton,
          ]}>
          <Text style={styles.detailBackText}>‹  Back</Text>
        </Pressable>

        <View style={styles.detailContent}>
          <ImageBackground
            source={
              getCatalogImageUrl(show.backdrop_path)
                ? {uri: getCatalogImageUrl(show.backdrop_path)}
                : undefined
            }
            style={styles.detailBackdrop}
            imageStyle={styles.detailBackdropImage}>
            <View style={styles.detailBackdropOverlay} />
          </ImageBackground>

          <View style={styles.detailBody}>
            <Image
              source={
                getCatalogImageUrl(show.poster_path)
                  ? {uri: getCatalogImageUrl(show.poster_path)}
                  : undefined
              }
              style={styles.detailPoster}
              resizeMode="cover"
            />

            <View style={styles.detailCopy}>
              <Pressable
                focusable
                onPress={() => setDetailsVisible(v => !v)}
                onFocus={() => setDetailsFocused(true)}
                onBlur={() => setDetailsFocused(false)}
                onHoverIn={() => setDetailsFocused(true)}
                onHoverOut={() => setDetailsFocused(false)}
                accessibilityRole="button"
                accessibilityLabel={detailsVisible ? 'Hide show details' : 'Show show details'}
                style={[
                  styles.detailToggle,
                  detailsFocused && styles.detailToggleFocused,
                ]}>
                <Text style={styles.kicker}>
                  SHOW DETAILS {detailsVisible ? '▴' : '▾'}
                </Text>
              </Pressable>
              <Text style={styles.detailTitle}>{show.name}</Text>
              <Text style={styles.detailRating}>
                ⭐ {show.vote_average?.toFixed(1)} / 10
              </Text>
              {detailsVisible && (
                <Text style={styles.detailOverview}>{show.overview}</Text>
              )}

              <Pressable
                focusable
                onPress={onPress}
                onFocus={() => setPlayFocused(true)}
                onBlur={() => setPlayFocused(false)}
                accessibilityRole="button"
                accessibilityLabel="Play Show"
                style={[
                  styles.primaryButton,
                  styles.detailPlayButton,
                  playFocused && styles.focusedButton,
                ]}>
                <Text style={styles.primaryButtonText}>▶  Play</Text>
              </Pressable>
              <Pressable
                focusable
                onPress={onToggleMyList}
                accessibilityRole="button"
                accessibilityLabel={isInMyList ? 'Remove from My List' : 'Add to My List'}
                style={styles.detailListButton}>
                <Text style={styles.secondaryButtonText}>
                  {isInMyList ? 'Remove from My List' : 'Add to My List'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getSortLabel(sort: MyListSort): string {
  if (sort === 'new') {
    return 'New';
  }
  if (sort === 'rating') {
    return 'Rating';
  }
  return 'Recently added';
}

function MyListView({
  items,
  sort,
  onSortChange,
  onSelect,
  onRemove,
}: {
  items: (CatalogItem & {addedAt: number})[];
  sort: MyListSort;
  onSortChange: () => void;
  onSelect: (item: CatalogItem) => void;
  onRemove: (item: CatalogItem) => void;
}) {
  const sortedItems = sortMyList(items, sort);

  return (
    <View style={styles.myListScreen}>
      <View style={styles.myListHeader}>
        <View>
          <Text style={styles.placeholderKicker}>MY LIST</Text>
          <Text style={styles.myListTitle}>Saved for later</Text>
        </View>
      </View>

      {sortedItems.length === 0 ? (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderText}>
            Add a show or movie to see it here.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews={false}
          contentContainerStyle={styles.row}>
          {sortedItems.map((item, index) => (
            <View key={item.id} style={styles.myListItem}>
              <Poster
                show={item}
                preferredFocus={index === 0}
                onPress={() => onSelect(item)}
              />
              <Pressable
                focusable={false}
                accessible={false}
                onPress={() => onRemove(item)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name} from My List`}
                style={styles.removeListButton}>
                <Text style={styles.removeListButtonText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      {sortedItems.length > 0 && (
        <Pressable
          focusable
          onPress={onSortChange}
          accessibilityRole="button"
          accessibilityLabel={`Sort My List by ${getSortLabel(sort)}`}
          style={styles.sortButton}>
          <Text style={styles.sortButtonText}>Sort: {getSortLabel(sort)}</Text>
        </Pressable>
      )}
    </View>
  );
}

//api logic
export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [focusedTab, setFocusedTab] = useState('Home');
  const [shows, setShows] = useState<CatalogItem[]>([]);
  const [movies, setMovies] = useState<CatalogItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState('Checking for refreshed show metadata…');
  const [selectedShow, setSelectedShow] = useState<CatalogItem | null>(null);
  const [playingShow, setPlayingShow] = useState<CatalogItem | null>(null);
  const [myList, setMyList] = useState<(CatalogItem & {addedAt: number})[]>([]);
  const [myListSort, setMyListSort] = useState<MyListSort>('recentlyAdded');
  const [myListLoaded, setMyListLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([readMyList(), readMyListSort()]).then(([items, sort]) => {
      if (mounted) {
        setMyList(items);
        setMyListSort(sort);
        setMyListLoaded(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!myListLoaded) {
      return;
    }

    const latestItems = new Map(
      [...shows, ...movies].map(item => [item.id, item]),
    );
    setMyList(current => {
      let changed = false;
      const refreshed = current.map(saved => {
        const latest = latestItems.get(saved.id);
        if (!latest) {
          return saved;
        }
        changed = true;
        return {...latest, addedAt: saved.addedAt};
      });
      if (changed) {
        void writeMyList(refreshed);
      }
      return changed ? refreshed : current;
    });
  }, [shows, movies, myListLoaded]);

  const toggleMyList = (item: CatalogItem) => {
    setMyList(current => {
      const alreadySaved = current.some(saved => saved.id === item.id);
      const next = alreadySaved
        ? current.filter(saved => saved.id !== item.id)
        : [...current, {...item, addedAt: Date.now()}];
      void writeMyList(next);
      return next;
    });
  };

  const changeMyListSort = () => {
    setMyListSort(current => {
      const next: MyListSort =
        current === 'recentlyAdded'
          ? 'new'
          : current === 'new'
            ? 'rating'
            : 'recentlyAdded';
      void writeMyListSort(next);
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;

    // Requests fresh show metadata through KrakenD, updates the fallback cache
    // after success, and falls back to saved data with an actionable message
    // when the proxy or its upstream service cannot be reached.
    const refreshFromApi = async () => {
      try {
        const proxyBaseUrl = getProxyBaseUrl();
        console.log("ProxyBaseUrl: " + proxyBaseUrl);
        if (!proxyBaseUrl) {
          throw new Error(
            'The catalog proxy URL is not configured. Set EXPO_PUBLIC_PROXY_BASE_URL and restart Expo.',
          );
        }

        const items = await fetchCatalogItems(proxyBaseUrl, '/v1/tv/popular', 'show');

        const cached = await readShowsCache();
        const hasNewMetadata = !cached || !catalogItemsAreEqual(cached.shows, items);

        if (hasNewMetadata) {
          await writeShowsCache(items);
          console.log('New catalog metadata received; fallback cache replaced:', {
            showCount: items.length,
          });
        } else {
          console.log('Catalog metadata unchanged; fallback cache retained.');
        }

        if (mounted) {
          setShows(items);
          setRefreshStatus(
            hasNewMetadata
              ? 'New API metadata received.'
              : 'API metadata unchanged; using the latest API results.',
          );
        }
      } catch (error) {
        const message =
          error instanceof TypeError
            ? 'Could not reach the catalog proxy from this device. Check the proxy URL, Fire TV internet connection, DNS, TLS, or network restrictions.'
            : error instanceof Error
              ? error.message
              : 'The catalog proxy request failed for an unknown reason.';

        const cached = await readShowsCache();
        if (mounted) {
          if (cached) {
            setShows(cached.shows);
          }
          setRefreshStatus(
            cached
              ? 'API unavailable; using the saved fallback cache.'
              : 'No new API metadata received and no saved fallback cache is available.',
          );
          setApiError(
            cached
              ? `API refresh unavailable; using the saved fallback cache. ${message}`
              : message,
          );
        }
        console.error('Catalog proxy request failed:', {
          message: error instanceof Error ? error.message : String(error),
          error,
          usedFallbackCache: Boolean(cached),
        });
      }
    };

    refreshFromApi();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const refreshMoviesFromApi = async () => {
      try {
        const proxyBaseUrl = getProxyBaseUrl();
        if (!proxyBaseUrl) {
          throw new Error(
            'The catalog proxy URL is not configured. Set EXPO_PUBLIC_PROXY_BASE_URL and restart Expo.',
          );
        }

        const items = await fetchCatalogItems(proxyBaseUrl, '/v1/movies/popular', 'movie');
        const cached = await readMoviesCache();
        const hasNewMetadata = !cached || !catalogItemsAreEqual(cached.movies, items);

        if (hasNewMetadata) {
          await writeMoviesCache(items);
          console.log('New movie metadata received; fallback cache replaced:', {
            movieCount: items.length,
          });
        }

        if (mounted) {
          setMovies(items);
        }
      } catch (error) {
        const message =
          error instanceof TypeError
            ? 'Could not reach the catalog proxy from this device. Check the proxy URL, Fire TV internet connection, DNS, TLS, or network restrictions.'
            : error instanceof Error
              ? error.message
              : 'The movie catalog request failed for an unknown reason.';
        const cached = await readMoviesCache();

        if (mounted && cached) {
          setMovies(cached.movies);
        }

        console.error('Movie catalog proxy request failed:', {
          message,
          error,
          usedFallbackCache: Boolean(cached),
        });
      }
    };

    refreshMoviesFromApi();

    return () => {
      mounted = false;
    };
  }, []);

  const catalogItems = activeTab === 'Movies' ? movies : shows;
  const featuredShow = catalogItems[0];
  const remainingShows = catalogItems.slice(1);

  // Exiting the player returns to wherever Play was pressed (details or home).
  if (playingShow) {
    return (
      <PlayerScreen
        show={playingShow}
        imageBase={getProxyImageBase()}
        onExit={() => setPlayingShow(null)}
      />
    );
  }

  if (selectedShow) {
    return (
      <ShowDetails
        show={selectedShow}
        onBack={() => setSelectedShow(null)}
        onPress={() => setPlayingShow(selectedShow)}
        isInMyList={myList.some(item => item.id === selectedShow.id)}
        onToggleMyList={() => toggleMyList(selectedShow)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>F</Text>
            </View>
            <Text style={styles.brand}>FIRELIGHT</Text>
          </View>

          <View style={styles.navigation}>
            {['Home', 'Movies', 'My List'].map(tab => (
              <NavTab
                key={tab}
                tab={tab}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                focusedTab={focusedTab}
                setFocusedTab={setFocusedTab}
              />
            ))}
          </View>

          <View style={styles.profile}>
            <Text style={styles.search}>⌕</Text>
            <Text style={styles.avatar}>A</Text>
          </View>
        </View>

        {/* ===== CHANGED — hero is now an ImageBackground using the show's
            real backdrop_path instead of a flat blue View. A dark overlay
            (heroOverlay) sits on top so the white text stays readable
            over any image. Removed the old planet/ring fake-art View
            entirely — the real image replaces it. ===== */}
        {activeTab === 'My List' ? (
          <MyListView
            items={myList}
            sort={myListSort}
            onSortChange={changeMyListSort}
            onSelect={setSelectedShow}
            onRemove={toggleMyList}
          />
        ) : (
          <>
        <HeroCard
          show={featuredShow}
          onPress={() => featuredShow && setSelectedShow(featuredShow)}>
        <ImageBackground
          source={
            featuredShow?.backdrop_path
              ? {uri: getCatalogImageUrl(featuredShow.backdrop_path)}
              : undefined
          }
          style={styles.heroImageBox}
          imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay}>
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>FIRELIGHT ORIGINAL</Text>

              <Text style={styles.heroTitle}>
                {featuredShow?.name}
              </Text>

              <Text style={styles.heroSubtitle} numberOfLines={3}>
                {featuredShow?.overview}
              </Text>

              <Text style={styles.meta}>
                ⭐ {featuredShow?.vote_average?.toFixed(1)}
              </Text>

              <View style={styles.heroActions}>
                <FocusableButton
                  label="▶  Play Now"
                  primary
                  onPress={() => featuredShow && setPlayingShow(featuredShow)}
                />
                <FocusableButton
                  label={
                    featuredShow && myList.some(item => item.id === featuredShow.id)
                      ? 'Remove from My List'
                      : 'Add to My List'
                  }
                  onPress={() => featuredShow && toggleMyList(featuredShow)}
                />
              </View>
            </View>
          </View>
        </ImageBackground>
        </HeroCard>
        {/* ===== END CHANGED ===== */}

        {/* if shows are still loading shows loading shows
        If we get an error, it now displays on the app.
        */}

        <Text style={styles.apiStatus}>{refreshStatus}</Text>
        {apiError && <Text style={styles.apiError}>{apiError}</Text>}

        <View style={styles.body}>
          <View style={styles.section}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowTitle}>
                {activeTab === 'Movies' ? 'Popular Movies' : 'Popular Shows'}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={false}
              contentContainerStyle={styles.row}>
              {remainingShows.map(show => (
                <Poster
                  key={show.id}
                  show={show}
                  onPress={() => setSelectedShow(show)}
                />
              ))}
            </ScrollView>
          </View>
        </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#080b12',
  },

  content: {
    paddingBottom: 48,
  },

  header: {
    height: 84,
    paddingHorizontal: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  brandRow: {
    width: 215,
    flexDirection: 'row',
    alignItems: 'center',
  },

  logo: {
    width: 32,
    height: 32,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: '#ff5b35',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },

  brand: {
    color: '#f4f6fa',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },

  navigation: {
    flexDirection: 'row',
  },

  navItem: {
    marginHorizontal: 15,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },

  activeNavItem: {
    borderBottomWidth: 2,
    borderBottomColor: '#ff6947',
  },

  focusedNavItem: {
    backgroundColor: '#ffffff22',
    borderRadius: 6,
  },

  navText: {
    color: '#8991a1',
    fontSize: 15,
    fontWeight: '600',
  },

  activeNavText: {
    color: '#fff',
  },

  profile: {
    width: 215,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  search: {
    color: '#dbe0ea',
    marginRight: 22,
    fontSize: 30,
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    paddingTop: 8,
    color: '#10141e',
    backgroundColor: '#f5c779',
    textAlign: 'center',
    fontWeight: '800',
  },

  /* ===== CHANGED — hero no longer has backgroundColor/flexDirection
     directly; ImageBackground handles the image, and heroOverlay
     (new, below) handles the layout + dark tint on top of it. ===== */
  hero: {
    height: 390,
    marginHorizontal: 34,
    borderRadius: 16,
    overflow: 'hidden',
  },

  heroImageBox: {
    flex: 1,
  },

  heroImage: {
    borderRadius: 16,
  },

  heroFocusBorder: {
    borderRadius: 16,
  },

  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 11, 18, 0.55)', // dark tint so white text stays readable over any image
    flexDirection: 'row',
  },
  /* ===== END CHANGED ===== */

  heroCopy: {
    zIndex: 2,
    width: '56%',
    paddingTop: 56,
    paddingLeft: 50,
  },

  kicker: {
    color: '#62d1ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },

  heroTitle: {
    color: '#fff',
    marginTop: 12,
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '900',
    letterSpacing: 1,
  },

  heroSubtitle: {
    color: '#d1d8e3',
    marginTop: 12,
    fontSize: 18,
  },

  meta: {
    color: '#9ca9bb',
    marginTop: 16,
    fontSize: 14,
  },

  heroActions: {
    flexDirection: 'row',
    marginTop: 28,
  },

  primaryButton: {
    marginRight: 12,
    paddingHorizontal: 21,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },

  secondaryButton: {
    paddingHorizontal: 21,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffffff4c',
    backgroundColor: '#ffffff26',
  },

  focusedButton: {
    borderWidth: 3,
    borderColor: '#62d1ff',
    transform: [{scale: 1.04}],
  },

  primaryButtonText: {
    color: '#0d1523',
    fontWeight: '800',
    fontSize: 14,
  },

  secondaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  /* ===== REMOVED — heroArt, planet, ring styles deleted. They were the
     fake planet graphic that's now replaced by the real backdrop image. ===== */

  body: {
    paddingTop: 28,
    paddingHorizontal: 54,
  },

  placeholderCard: {
    marginHorizontal: 54,
    marginTop: 48,
    paddingHorizontal: 48,
    paddingVertical: 64,
    borderRadius: 16,
    backgroundColor: '#141a24',
    borderWidth: 1,
    borderColor: '#ffffff1f',
    alignItems: 'center',
  },

  placeholderKicker: {
    color: '#62d1ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },

  placeholderTitle: {
    color: '#fff',
    marginTop: 14,
    fontSize: 32,
    fontWeight: '900',
  },

  placeholderText: {
    color: '#c6ccd6',
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },

  myListScreen: {
    paddingTop: 42,
    paddingHorizontal: 54,
  },

  myListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  myListTitle: {
    color: '#fff',
    marginTop: 10,
    fontSize: 32,
    fontWeight: '900',
  },

  sortButton: {
    alignSelf: 'flex-start',
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffffff4c',
    backgroundColor: '#ffffff18',
  },

  sortButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  myListItem: {
    marginRight: 16,
  },

  removeListButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 5,
    backgroundColor: '#ffffff18',
  },

  removeListButtonText: {
    color: '#ffb2a3',
    fontSize: 12,
    fontWeight: '700',
  },

  detailListButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 21,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffffff4c',
    backgroundColor: '#ffffff26',
  },

  section: {
    marginBottom: 30,
  },

  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  rowTitle: {
    color: '#f3f5f8',
    fontSize: 20,
    fontWeight: '800',
  },

  seeAll: {
    color: '#8b96a8',
    fontSize: 13,
  },

  row: {
    paddingVertical: 4,
    paddingRight: 18,
  },

  poster: {
    width: 160,
    marginRight: 16,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#141a24',
  },

  focusedPoster: {
    borderWidth: 3,
    borderColor: '#fff',
    transform: [{scale: 1.05}],
  },

  /* ===== CHANGED — posterArt is now the actual <Image> box (fixed height,
     matching a typical poster aspect ratio) instead of a colored View
     wrapping text. ===== */
  posterArt: {
    width: '100%',
    height: 230,
    backgroundColor: '#2a2f3d', // shows while the image is loading
  },

  previewScreen: {
    width: '100%',
    height: 230,
    backgroundColor: '#000',
  },
  /* ===== END CHANGED ===== */

  posterTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingTop: 8,
  },

  posterDetail: {
    color: '#c6ccd6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
  },

  apiStatus: {
    color: '#9ca9bb',
    marginTop: 16,
    marginHorizontal: 54,
    fontSize: 14,
  },

  apiError: {
    color: '#ff9b86',
    marginTop: 16,
    marginHorizontal: 54,
    fontSize: 14,
  },
  
  focusBorder: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  borderWidth: 3,
  borderColor: '#fff',
  borderRadius: 8,
},

  detailScreen: {
    paddingHorizontal: 54,
    paddingTop: 34,
    paddingBottom: 54,
  },

  detailBackButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffffff4c',
    backgroundColor: '#ffffff18',
  },

  detailBackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  detailContent: {
    marginTop: 28,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#141a24',
  },

  detailBackdrop: {
    height: 300,
  },

  detailBackdropImage: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },

  detailBackdropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 21, 0.48)',
  },

  detailBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 36,
    paddingBottom: 36,
  },

  // poster overlaps the bottom of the backdrop
  detailPoster: {
    width: 180,
    height: 270,
    marginTop: -120,
    marginRight: 36,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff30',
    backgroundColor: '#2a2f3d',
  },

  detailCopy: {
    flex: 1,
    paddingTop: 28,
  },

  detailTitle: {
    color: '#fff',
    marginTop: 10,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '900',
  },

  detailRating: {
    color: '#f5c779',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
  },

  detailPlayButton: {
    alignSelf: 'flex-start',
    marginTop: 28,
    marginRight: 0,
    paddingHorizontal: 36,
    paddingVertical: 14,
  },

  // blue "SHOW DETAILS" label that toggles the overview
  detailToggle: {
    alignSelf: 'flex-start',
    marginLeft: -8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },

  detailToggleFocused: {
    borderColor: '#62d1ff',
    backgroundColor: '#62d1ff1a',
  },

  detailOverview: {
    color: '#d1d8e3',
    marginTop: 18,
    maxWidth: 780,
    fontSize: 18,
    lineHeight: 27,
  },
});
