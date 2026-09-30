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

const TMDB_API_KEY = 'API_KEY';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'; // ===== NEW — base URL for building image links

type TMDBShow = {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
};

type TMDBErrorResponse = {
  status_code?: number;
  status_message?: string;
};

type TMDBResponse = TMDBErrorResponse & {
  results?: TMDBShow[];
};

type ShowsCache = {
  shows: TMDBShow[];
  refreshedAt: string;
};

const SHOWS_CACHE_KEY = '@firelight/tmdb-popular-shows';
let inMemoryShowsCache: string | null = null;

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

async function writeShowsCache(shows: TMDBShow[]): Promise<void> {
  const cache: ShowsCache = {
    shows,
    refreshedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(cache);
  inMemoryShowsCache = raw;
}

function showsAreEqual(left: TMDBShow[], right: TMDBShow[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readTMDBResponse(response: Response): Promise<TMDBResponse> {
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
    throw new Error(`TMDB returned an unreadable response (HTTP ${response.status}).`);
  }

  return payload as TMDBResponse;
}

function getTMDBErrorMessage(
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

/**
 * Reusable CTA button for the hero area.
 */
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

/* ===== CHANGED — Poster now renders a real image from TMDB's poster_path
   instead of a flat colored box + text. Title still overlays as a caption
   below the image, same as before. ===== */
function Poster({show, onPress}: {show: TMDBShow; onPress: () => void}) {
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
            source={{uri: `${TMDB_IMAGE_BASE}/w500${show.poster_path}`}}
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
function HeroCard({
  show,
  onPress,
  children,
}: {
  show?: TMDBShow;
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
function ShowDetails({show, onBack, onPress}: {show: TMDBShow; onBack: () => void; onPress?: () => void}) {
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
            source={{uri: `${TMDB_IMAGE_BASE}/w780${show.backdrop_path}`}}
            style={styles.detailBackdrop}
            imageStyle={styles.detailBackdropImage}>
            <View style={styles.detailBackdropOverlay} />
          </ImageBackground>

          <View style={styles.detailBody}>
            <Image
              source={{uri: `${TMDB_IMAGE_BASE}/w342${show.poster_path}`}}
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
  const [shows, setShows] = useState<TMDBShow[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState('Checking for refreshed show metadata…');
  const [selectedShow, setSelectedShow] = useState<TMDBShow | null>(null);
  const [playingShow, setPlayingShow] = useState<TMDBShow | null>(null);

  useEffect(() => {
    let mounted = true;

    const refreshFromApi = async () => {
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}`,
        );

        let data: TMDBResponse;
        try {
          data = await readTMDBResponse(response);
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new Error(`TMDB returned invalid JSON (HTTP ${response.status}).`);
          }
          throw new Error(
            `TMDB response body could not be read (HTTP ${response.status}): ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }

        const responseSucceeded =
          response.status >= 200 && response.status < 300;
        if (!responseSucceeded) {
          throw new Error(getTMDBErrorMessage(response.status, data));
        }

        if (!Array.isArray(data.results)) {
          throw new Error(
            'TMDB responded successfully, but the response did not contain a shows list. The API key was accepted; check the endpoint response or app data handling.',
          );
        }

        const cached = await readShowsCache();
        const hasNewMetadata = !cached || !showsAreEqual(cached.shows, data.results);

        if (hasNewMetadata) {
          await writeShowsCache(data.results);
          console.log('TMDB new API metadata received; fallback cache replaced:', {
            showCount: data.results.length,
          });
        } else {
          console.log('TMDB API metadata unchanged; fallback cache retained.');
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
            ? 'Could not reach TMDB from this device. The API key was not validated; check the Fire TV internet connection, DNS, TLS, or network restrictions.'
            : error instanceof Error
              ? error.message
              : 'The TMDB request failed for an unknown reason. The API key could not be verified.';

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
        console.error('TMDB request failed:', {
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
    // Keep the Nitro-backed video module out of the home-screen startup path.
    // A native/player initialization failure should not prevent the catalog UI
    // from mounting.
    const PlayerScreen = require('./components/PlayerScreen').default;

    return (
      <PlayerScreen
        show={playingShow}
        imageBase={TMDB_IMAGE_BASE}
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
          source={{uri: `${TMDB_IMAGE_BASE}/w1280${featuredShow?.backdrop_path}`}}
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
