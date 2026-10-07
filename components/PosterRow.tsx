import React, {useEffect, useRef, useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {TMDB_IMAGE_BASE, TMDBShow} from '../tmdb';

/* Poster renders the image from TMDB's poster_path with the title and
   overview as a caption below it. */
export function Poster({
  show,
  onPress,
  hasTVPreferredFocus,
  onFocus,
}: {
  show: TMDBShow;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  onFocus?: () => void;
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
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        startPreviewTimer();
        onFocus?.();
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

/* A titled horizontal row of posters. onLayout reports the row's position
   so the nav tabs can scroll to it. When focusFirst turns true, D-pad focus
   moves to the first poster and onFirstFocused is called. */
export default function PosterRow({
  title,
  items,
  onSelect,
  onLayout,
  focusFirst,
  onFirstFocused,
}: {
  title: string;
  items: TMDBShow[];
  onSelect: (show: TMDBShow) => void;
  onLayout?: (y: number) => void;
  focusFirst?: boolean;
  onFirstFocused?: () => void;
}) {
  return (
    <View
      style={styles.section}
      onLayout={e => onLayout?.(e.nativeEvent.layout.y)}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{title}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews={false}
        contentContainerStyle={styles.row}>
        {items.map((show, index) => (
          <Poster
            key={show.id}
            show={show}
            onPress={() => onSelect(show)}
            hasTVPreferredFocus={index === 0 && focusFirst}
            onFocus={index === 0 ? onFirstFocused : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
