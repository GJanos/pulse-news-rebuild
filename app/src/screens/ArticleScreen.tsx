import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, THEMES, AESTHETICS } from '../themes';
import { useAppStore } from '../store';
import PulseIcon from '../components/Icon';
import Flag from '../components/Flag';
import { useSwipe } from '../hooks/useSwipe';
import { useSlideIn } from '../hooks/useSlideIn';
import type { Headline, Region } from '../types';

interface Props {
  headline: Headline;
  region: Region;
  onClose: () => void;
}

export default function ArticleScreen({
  headline,
  region,
  onClose,
}: Props): React.ReactElement | null {
  const theme = useAppStore((s) => THEMES[s.prefs.theme]);
  const aes = useAppStore((s) => AESTHETICS[s.prefs.aesthetic]);
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { slideAnim, dismiss } = useSlideIn(onClose);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const openArticle = (): void => {
    void WebBrowser.openBrowserAsync(headline.url);
  };

  const panHandlers = useSwipe(openArticle, dismiss);

  const hostname = useMemo<string>(() => {
    try {
      return new URL(headline.url).hostname.replace(/^www\./, '');
    } catch {
      return headline.url;
    }
  }, [headline.url]);

  const copyLink = (): void => {
    void Clipboard.setStringAsync(headline.url).then(() => {
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: theme.bg, zIndex: 100, transform: [{ translateX: slideAnim }] },
      ]}
      {...panHandlers}
    >
      <View
        style={[
          s.header,
          { paddingTop: insets.top, backgroundColor: theme.surface, borderBottomColor: theme.rule },
        ]}
      >
        <View style={s.headerRow}>
          <Pressable
            onPress={dismiss}
            style={[s.headerBtn, { backgroundColor: theme.chip }]}
            hitSlop={6}
            accessibilityLabel="Back to digest"
          >
            <PulseIcon name="arrow-left" size={16} color={theme.text} />
          </Pressable>

          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: 'center',
              marginHorizontal: 12,
              fontFamily: font(aes, 'eyebrow', 600),
              fontSize: 10,
              letterSpacing: 2,
              color: theme.accent,
              textTransform: 'uppercase',
            }}
          >
            {headline.sourceName ?? 'Article'}
          </Text>

          <View style={s.headerBtn} />
        </View>
      </View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontFamily: font(aes, 'title', 700),
            fontSize: 22,
            lineHeight: 27,
            letterSpacing: -0.4,
            color: theme.text,
          }}
        >
          {headline.title}
        </Text>

        <View style={[s.byline, { borderBottomColor: theme.rule }]}>
          <Flag
            country={region.country?.length === 2 ? region.country : region.code}
            width={32}
            height={22}
          />
          <Text
            style={{
              marginLeft: 14,
              fontFamily: font(aes, 'body'),
              fontSize: 18,
              color: theme.textDim,
            }}
          >
            {region.region}
          </Text>
          {headline.category && (
            <View style={[s.categoryChip, { backgroundColor: theme.accentSoft, marginLeft: 14 }]}>
              <Text
                style={{
                  fontFamily: font(aes, 'eyebrow', 600),
                  fontSize: 10,
                  letterSpacing: 1.4,
                  color: theme.accent,
                  textTransform: 'uppercase',
                }}
              >
                {headline.category}
              </Text>
            </View>
          )}
        </View>

        <View style={[s.summaryBlock, { borderLeftColor: theme.accent }]}>
          <Text
            style={{
              fontFamily: font(aes, 'body', 600),
              fontSize: 16,
              lineHeight: 24,
              color: theme.text,
            }}
          >
            {headline.summary}
          </Text>
        </View>

        {headline.detail && (
          <Text
            style={{
              fontFamily: font(aes, 'body'),
              fontSize: 16,
              lineHeight: 26,
              color: theme.textDim,
              marginTop: 16,
            }}
          >
            {headline.detail}
          </Text>
        )}

        <Pressable
          onPress={openArticle}
          accessibilityLabel="Read full article"
          style={({ pressed }) => [
            s.readBtn,
            { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1, marginTop: 28 },
          ]}
        >
          <Text
            style={{
              fontFamily: font(aes, 'ui', 600),
              fontSize: 15,
              color: '#fff',
              letterSpacing: -0.1,
            }}
          >
            Read full article
          </Text>
          <View style={{ marginLeft: 8 }}>
            <PulseIcon name="arrow-right" size={14} color="#fff" strokeWidth={2} />
          </View>
        </Pressable>

        <View style={[s.copyRow, { backgroundColor: theme.chip }]}>
          <PulseIcon name="link" size={13} color={theme.textFaint} strokeWidth={1.8} />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: font(aes, 'number'),
              fontSize: 11,
              color: theme.textFaint,
            }}
          >
            {hostname}
          </Text>
          <Pressable
            onPress={copyLink}
            accessibilityLabel={copied ? 'Link copied' : 'Copy link'}
            style={[s.copyBtn, { borderColor: copied ? theme.accent : theme.ruleStrong }]}
          >
            <PulseIcon
              name={copied ? 'check' : 'copy'}
              size={13}
              color={copied ? theme.accent : theme.textDim}
              strokeWidth={1.8}
            />
            <Text
              style={{
                fontFamily: font(aes, 'ui', 600),
                fontSize: 12,
                color: copied ? theme.accent : theme.textDim,
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>
        </View>

        <View style={s.swipeHints}>
          <Text
            style={{
              fontFamily: font(aes, 'eyebrow', 600),
              fontSize: 9,
              letterSpacing: 1.4,
              color: theme.textFaint,
              textTransform: 'uppercase',
            }}
          >
            ← swipe right · close
          </Text>
          <Text
            style={{
              fontFamily: font(aes, 'eyebrow', 600),
              fontSize: 9,
              letterSpacing: 1.4,
              color: theme.textFaint,
              textTransform: 'uppercase',
            }}
          >
            swipe left · open →
          </Text>
        </View>
      </Animated.ScrollView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  byline: {
    marginTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  summaryBlock: {
    marginTop: 18,
    paddingLeft: 14,
    borderLeftWidth: 3,
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  copyRow: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    paddingHorizontal: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
});
