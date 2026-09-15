import React, {useState, useEffect} from 'react';
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

const TMDB_API_KEY = 'APIKEY';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'; // ===== NEW — base URL for building image links

type TMDBShow = {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
};

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
function Poster({show}: {show: TMDBShow}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      focusable
      onPress={() => console.log(`Poster pressed: ${show.name}`)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${show.name}`}
      style={styles.poster}>
      <View>
        <Image
          source={{uri: `${TMDB_IMAGE_BASE}/w500${show.poster_path}`}}
          style={styles.posterArt}
          resizeMode="cover"
        />
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

//api logic
export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [focusedTab, setFocusedTab] = useState('Home');
  const [shows, setShows] = useState<TMDBShow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}`)
      .then(response => response.json())
      .then(data => {
        if(Array.isArray(data?.results)) {
                  setShows(data.results);
                }
                else {
                  console.log("Data is invalid. Check API key as it may have errors fetching or no longer works");
                }        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching shows:', error);
        setLoading(false);
      });
  }, []);

  const featuredShow = shows[0];
  const remainingShows = shows.slice(1);

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
        <ImageBackground
          source={{uri: `${TMDB_IMAGE_BASE}/w1280${featuredShow?.backdrop_path}`}}
          style={styles.hero}
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
                <FocusableButton label="▶  Play Now" primary />
                <FocusableButton label="＋  My List" />
              </View>
            </View>
          </View>
        </ImageBackground>
        {/* ===== END CHANGED ===== */}

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
                <Poster key={show.id} show={show} />
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

  heroImage: {
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
});