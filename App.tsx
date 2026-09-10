import React, {useState} from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Show = {
  title: string;
  detail: string;
  genre: string;
  color: string;
  accent: string;
};

// Content data used to populate the horizontal streaming-service rails.
const contentRows: Array<{title: string; shows: Show[]}> = [
  {
    title: 'Continue Watching',
    shows: [
      {title: 'Signal Lost', detail: 'Season 1  •  Episode 4', genre: 'Drama', color: '#48283e', accent: '#ed7b9e'},
      {title: 'Wild Waters', detail: 'Season 2  •  Episode 1', genre: 'Nature', color: '#164b50', accent: '#55d6c2'},
      {title: 'The Courier', detail: 'Season 1  •  Episode 6', genre: 'Thriller', color: '#513724', accent: '#f4ae6b'},
      {title: 'Orbit', detail: 'Season 1  •  Episode 2', genre: 'Sci-Fi', color: '#2b3567', accent: '#899cff'},
    ],
  },
  {
    title: 'Popular on Firelight',
    shows: [
      {title: 'Deep Blue', detail: 'A new original', genre: 'Documentary', color: '#173f62', accent: '#49b9f2'},
      {title: 'Northbound', detail: 'Critically acclaimed', genre: 'Adventure', color: '#5a3e2f', accent: '#f3c477'},
      {title: 'Neon City', detail: 'Top 10 today', genre: 'Action', color: '#4e2857', accent: '#ef7bf0'},
      {title: 'Home Team', detail: 'Feel-good favorite', genre: 'Comedy', color: '#31583e', accent: '#a4e47b'},
    ],
  },
  {
    title: 'Recommended for You',
    shows: [
      {title: 'Afterlight', detail: 'Because you watched Orbit', genre: 'Mystery', color: '#313453', accent: '#c5a9ff'},
      {title: 'Open Road', detail: 'Because you watched Wild Waters', genre: 'Travel', color: '#7b452d', accent: '#ffb35a'},
      {title: 'The Makers', detail: 'A Firelight original', genre: 'Reality', color: '#244e55', accent: '#5be1d6'},
      {title: 'Glass House', detail: 'New episodes weekly', genre: 'Drama', color: '#532d3e', accent: '#ff9cbd'},
    ],
  },
];

/**
 * Reusable CTA button for the hero area.
 * It tracks focus and hover independently so it works with both a Fire TV
 * remote and pointer-based testing in a desktop/emulator environment.
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

/**
 * A single selectable title card.
 * Posters behave like buttons, announce their title to accessibility tools,
 * highlight on focus/hover, and log the pressed title for development testing.
 */
function Poster({
  show,
  showProgress,
}: {
  show: Show;
  showProgress: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      focusable
      onPress={() => console.log(`Poster pressed: ${show.title}`)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${show.title}`}
      style={[styles.poster, (focused || hovered) && styles.focusedPoster]}>
      <View style={[styles.posterArt, {backgroundColor: show.color}]}>
        <View style={[styles.posterGlow, {backgroundColor: show.accent}]} />
        <Text style={styles.posterBrand}>FIRELIGHT</Text>
        <Text style={styles.posterTitle}>{show.title}</Text>
        <Text style={[styles.posterGenre, {color: show.accent}]}>
          {show.genre}
        </Text>
      </View>

      <Text style={styles.posterDetail}>{show.detail}</Text>

      {showProgress && (
        <View style={styles.progressTrack}>
          <View style={[styles.progress, {backgroundColor: show.accent}]} />
        </View>
      )}
    </Pressable>
  );
}

/**
 * Main Firelight streaming home screen.
 * The outer horizontal ScrollView supports wide-TV layouts, while the inner
 * vertical ScrollView lets users browse down through content rows. Each row
 * remains horizontally scrollable for remote-friendly poster navigation.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState('Home');

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalContent}>
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
              <Pressable
                key={tab}
                focusable
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.navItem,
                  activeTab === tab && styles.activeNavItem,
                ]}>
                <Text
                  style={[
                    styles.navText,
                    activeTab === tab && styles.activeNavText,
                  ]}>
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.profile}>
            <Text style={styles.search}>⌕</Text>
            <Text style={styles.avatar}>A</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>FIRELIGHT ORIGINAL</Text>

            <Text style={styles.heroTitle}>
              THE LAST{'\n'}FRONTIER
            </Text>

            <Text style={styles.heroSubtitle}>
              The future of survival starts here.
            </Text>

            <Text style={styles.meta}>Sci-Fi  •  2026  •  8 Episodes</Text>

            <View style={styles.heroActions}>
              <FocusableButton label="▶  Play Now" primary />
              <FocusableButton label="＋  My List" />
            </View>
          </View>

          <View style={styles.heroArt}>
            <View style={styles.planet} />
            <View style={styles.ring} />

            <Text style={styles.heroArtTitle}>
              THE{'\n'}LAST{'\n'}FRONTIER
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {contentRows.map((row, rowIndex) => (
            <View key={row.title} style={styles.section}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.seeAll}>See all  ›</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}>
                {row.shows.map(show => (
                  <Poster
                    key={show.title}
                    show={show}
                    showProgress={rowIndex === 0}
                  />
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#080b12',
  },

  horizontalContent: {
    minWidth: '100%',
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
  },

  activeNavItem: {
    borderBottomWidth: 2,
    borderBottomColor: '#ff6947',
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

  hero: {
    height: 390,
    marginHorizontal: 34,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#17375e',
    flexDirection: 'row',
  },

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

  heroArt: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#21466d',
  },

  planet: {
    position: 'absolute',
    top: 55,
    right: 25,
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: '#31739a',
  },

  ring: {
    position: 'absolute',
    top: 150,
    right: -22,
    width: 350,
    height: 75,
    borderRadius: 200,
    borderWidth: 16,
    borderColor: '#80c3d077',
    transform: [{rotate: '-18deg'}],
  },

  heroArtTitle: {
    position: 'absolute',
    right: 42,
    bottom: 34,
    color: '#d7f4ff',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'right',
  },

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
    width: 205,
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

  posterArt: {
    height: 210,
    padding: 14,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },

  posterGlow: {
    position: 'absolute',
    top: -38,
    right: -60,
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.45,
  },

  posterBrand: {
    color: '#ffffff99',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  posterTitle: {
    maxWidth: 165,
    color: '#fff',
    fontSize: 24,
    lineHeight: 25,
    fontWeight: '900',
  },

  posterGenre: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  posterDetail: {
    color: '#c6ccd6',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 12,
  },

  progressTrack: {
    height: 4,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 3,
    backgroundColor: '#ffffff24',
  },

  progress: {
    width: '58%',
    height: 4,
    borderRadius: 3,
  },
});
