import React, {useEffect, useRef, useState} from 'react';
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

type CatalogShow = {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
};

type ProxyErrorResponse = {
  status_code?: number;
  status_message?: string;
};

type CatalogResponse = ProxyErrorResponse & {
  results?: CatalogShow[];
};

type ShowsCache = {
  shows: CatalogShow[];
  refreshedAt: string;
};

let inMemoryShowsCache: string | null = null;

// Reads the most recent catalog response from the in-memory fallback cache so
// the UI can still show previously loaded shows when the proxy is unavailable.
async function readShowsCache(): Promise<ShowsCache | null> {
  try {
    const raw = inMemoryShowsCache;
    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw) as Partial<ShowsCache>;
    return Array.isArray(cached.shows) && typeof cached.refreshedAt === 'string'
      ? {shows: cached.shows, refreshedAt: cached.refreshedAt}
      : null;
  } catch (error) {
    console.warn('Shows cache could not be read:', error);
    return null;
  }
}

// Stores the latest successful catalog response and its timestamp for the
// fallback path used when a later proxy request cannot be completed.
async function writeShowsCache(shows: CatalogShow[]): Promise<void> {
  const cache: ShowsCache = {
    shows,
    refreshedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(cache);
  inMemoryShowsCache = raw;
}

// Compares two catalog result lists to decide whether the successful proxy
// response contains new metadata worth replacing in the fallback cache.
function showsAreEqual(left: CatalogShow[], right: CatalogShow[]) {
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
function Poster({show, onPress}: {show: CatalogShow; onPress: () => void}) {
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
            source={{uri: `${getProxyImageBase()}/w500${show.poster_path}`}}
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
  show?: CatalogShow;
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
function ShowDetails({show, onBack, onPress}: {show: CatalogShow; onBack: () => void; onPress?: () => void}) {
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
            source={{uri: `${getProxyImageBase()}/w780${show.backdrop_path}`}}
            style={styles.detailBackdrop}
            imageStyle={styles.detailBackdropImage}>
            <View style={styles.detailBackdropOverlay} />
          </ImageBackground>

          <View style={styles.detailBody}>
            <Image
              source={{uri: `${getProxyImageBase()}/w342${show.poster_path}`}}
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
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

//api logic
export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [focusedTab, setFocusedTab] = useState('Home');
  const [shows, setShows] = useState<CatalogShow[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState('Checking for refreshed show metadata…');
  const [selectedShow, setSelectedShow] = useState<CatalogShow | null>(null);
  const [playingShow, setPlayingShow] = useState<CatalogShow | null>(null);

  useEffect(() => {
    let mounted = true;

    // Requests fresh show metadata through KrakenD, updates the fallback cache
    // after success, and falls back to saved data with an actionable message
    // when the proxy or its upstream service cannot be reached.
    const refreshFromApi = async () => {
      try {
        const proxyBaseUrl = getProxyBaseUrl();
        if (!proxyBaseUrl) {
          throw new Error(
            'The catalog proxy URL is not configured. Set EXPO_PUBLIC_PROXY_BASE_URL and restart Expo.',
          );
        }

        const response = await fetchProxyResponse(`${proxyBaseUrl}/v1/tv/popular`);

        let data: CatalogResponse;
        try {
          data = await readProxyResponse(response);
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new Error(`The catalog proxy returned invalid JSON (HTTP ${response.status}).`);
          }
          throw new Error(
            `The catalog proxy response could not be read (HTTP ${response.status}): ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }

        const responseSucceeded =
          response.status >= 200 && response.status < 300;
        if (!responseSucceeded) {
          throw new Error(getProxyErrorMessage(response.status, data));
        }

        if (!Array.isArray(data.results)) {
          throw new Error(
            'The catalog proxy responded successfully, but the response did not contain a shows list. Check the proxy response contract or app data handling.',
          );
        }

        const cached = await readShowsCache();
        const hasNewMetadata = !cached || !showsAreEqual(cached.shows, data.results);

        if (hasNewMetadata) {
          await writeShowsCache(data.results);
          console.log('New catalog metadata received; fallback cache replaced:', {
            showCount: data.results.length,
          });
        } else {
          console.log('Catalog metadata unchanged; fallback cache retained.');
        }

        if (mounted) {
          setShows(data.results);
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

  const featuredShow = shows[0];
  const remainingShows = shows.slice(1);

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
            {['Home', 'Movies', 'Series', 'My List'].map(tab => (
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
        <HeroCard
          show={featuredShow}
          onPress={() => featuredShow && setSelectedShow(featuredShow)}>
        <ImageBackground
          source={{uri: `${getProxyImageBase()}/w1280${featuredShow?.backdrop_path}`}}
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
                <FocusableButton label="＋  My List" />
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
              <Text style={styles.rowTitle}>Popular Shows</Text>
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
