import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { useTheme } from '../context/ThemeProvider';
import { Layout, Typography } from '../constants';
import { getImageUri } from '../utils/imageStorage';
import { WritingSettings } from '../types';

interface MarkdownPreviewProps {
  content: string;
  images?: string[];
  writingSettings?: WritingSettings;
}

const DEFAULT_SETTINGS: WritingSettings = {
  fontSize: 16,
  lineHeight: 1.75,
  letterSpacing: 0,
};

export function MarkdownPreview({ content, images, writingSettings = DEFAULT_SETTINGS }: MarkdownPreviewProps) {
  const { colors } = useTheme();

  const baseFontSize = writingSettings.fontSize;
  const lineHeightFactor = writingSettings.lineHeight;
  const letterSpacing = writingSettings.letterSpacing;

  const getLineHeight = (fontSize: number) => Math.round(fontSize * lineHeightFactor);

  const parseMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listIndex = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      if (!trimmed) {
        elements.push(<View key={index} style={styles.spacer} />);
        return;
      }

      if (trimmed.startsWith('### ')) {
        elements.push(
          <Text key={index} style={[styles.h3, { color: colors.textPrimary, fontSize: baseFontSize * 1.2, lineHeight: getLineHeight(baseFontSize * 1.2), letterSpacing }]}>
            {trimmed.slice(4)}
          </Text>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <Text key={index} style={[styles.h2, { color: colors.textPrimary, fontSize: baseFontSize * 1.375, lineHeight: getLineHeight(baseFontSize * 1.375), letterSpacing }]}>
            {trimmed.slice(3)}
          </Text>
        );
      } else if (trimmed.startsWith('# ')) {
        elements.push(
          <Text key={index} style={[styles.h1, { color: colors.textPrimary, fontSize: baseFontSize * 1.5, lineHeight: getLineHeight(baseFontSize * 1.5), letterSpacing }]}>
            {trimmed.slice(2)}
          </Text>
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <View key={index} style={styles.listItem}>
            <Text style={[styles.listBullet, { color: colors.primary, fontSize: baseFontSize }]}>•</Text>
            <Text style={[styles.listText, { color: colors.textPrimary, fontSize: baseFontSize, lineHeight: getLineHeight(baseFontSize), letterSpacing }]}>
              {renderInlineStyles(trimmed.slice(2), colors, baseFontSize, lineHeightFactor, letterSpacing)}
            </Text>
          </View>
        );
      } else if (/^\d+\.\s/.test(trimmed)) {
        listIndex++;
        const textContent = trimmed.replace(/^\d+\.\s/, '');
        elements.push(
          <View key={index} style={styles.listItem}>
            <Text style={[styles.listNumber, { color: colors.primary, fontSize: baseFontSize }]}>{listIndex}.</Text>
            <Text style={[styles.listText, { color: colors.textPrimary, fontSize: baseFontSize, lineHeight: getLineHeight(baseFontSize), letterSpacing }]}>
              {renderInlineStyles(textContent, colors, baseFontSize, lineHeightFactor, letterSpacing)}
            </Text>
          </View>
        );
      } else if (trimmed.startsWith('> ')) {
        elements.push(
          <View key={index} style={[styles.blockquote, { borderLeftColor: colors.primary, backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.blockquoteText, { color: colors.textSecondary, fontSize: baseFontSize, lineHeight: getLineHeight(baseFontSize), letterSpacing }]}>
              {renderInlineStyles(trimmed.slice(2), colors, baseFontSize, lineHeightFactor, letterSpacing)}
            </Text>
          </View>
        );
      } else if (trimmed.startsWith('---') || trimmed.startsWith('***')) {
        elements.push(<View key={index} style={[styles.hr, { backgroundColor: colors.divider }]} />);
      } else {
        listIndex = 0;
        elements.push(
          <Text key={index} style={[styles.paragraph, { color: colors.textPrimary, fontSize: baseFontSize, lineHeight: getLineHeight(baseFontSize), letterSpacing }]}>
            {renderInlineStyles(trimmed, colors, baseFontSize, lineHeightFactor, letterSpacing)}
          </Text>
        );
      }
    });

    return elements;
  };

  const renderInlineStyles = (text: string, colors: any, fontSize: number, lineHeightFactor: number, letterSpacing: number): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIndex = 0;

    const patterns = [
      { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: 'link' },
      { regex: /\*\*\*(.+?)\*\*\*/g, style: [styles.bold, styles.italic] },
      { regex: /\*\*(.+?)\*\*/g, style: [styles.bold] },
      { regex: /\*(.+?)\*/g, style: [styles.italic] },
      { regex: /__(.+?)__/g, style: [styles.bold] },
      { regex: /_(.+?)_/g, style: [styles.italic] },
      { regex: /~~(.+?)~~/g, style: [styles.strikethrough] },
      { regex: /`(.+?)`/g, style: [styles.code, { backgroundColor: colors.inputBackground }] },
    ];

    let hasMatch = true;
    while (hasMatch && remaining.length > 0) {
      hasMatch = false;
      let earliestMatch: { index: number; length: number; content: string; url?: string; style: any[] } | null = null;
      let isLink = false;

      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(remaining);
        if (match && (!earliestMatch || match.index < earliestMatch.index)) {
          isLink = pattern.type === 'link';
          earliestMatch = {
            index: match.index,
            length: match[0].length,
            content: isLink ? match[1] : match[1],
            url: isLink ? match[2] : undefined,
            style: pattern.style || [],
          };
        }
      }

      if (earliestMatch) {
        hasMatch = true;
        if (earliestMatch.index > 0) {
          parts.push(
            <Text key={keyIndex++} style={{ fontSize, lineHeight: Math.round(fontSize * lineHeightFactor), letterSpacing }}>
              {remaining.slice(0, earliestMatch.index)}
            </Text>
          );
        }
        if (isLink && earliestMatch.url) {
          parts.push(
            <TouchableOpacity
              key={keyIndex++}
              onPress={() => earliestMatch.url && Linking.openURL(earliestMatch.url)}
              activeOpacity={0.7}
            >
              <Text style={[styles.link, { fontSize, lineHeight: Math.round(fontSize * lineHeightFactor), letterSpacing, color: colors.primary }]}>
                {earliestMatch.content}
              </Text>
            </TouchableOpacity>
          );
        } else {
          parts.push(
            <Text key={keyIndex++} style={[...earliestMatch.style, { fontSize, lineHeight: Math.round(fontSize * lineHeightFactor), letterSpacing }]}>
              {earliestMatch.content}
            </Text>
          );
        }
        remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
      }
    }

    if (remaining.length > 0) {
      parts.push(<Text key={keyIndex++} style={{ fontSize, lineHeight: Math.round(fontSize * lineHeightFactor), letterSpacing }}>{remaining}</Text>);
    }

    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
  };

  return (
    <View style={styles.container}>
      {parseMarkdown(content)}
      {images && images.length > 0 && (
        <View style={styles.imagesContainer}>
          {images.map((img, index) => (
            <View key={index} style={[styles.imageFrame, { backgroundColor: colors.inputBackground }]}>
              <Image
                source={{ uri: getImageUri(img) }}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  spacer: { height: Layout.spacing.xs },
  h1: {
    fontWeight: Typography.fontWeight.bold,
    marginVertical: Layout.spacing.sm,
  },
  h2: {
    fontWeight: Typography.fontWeight.semibold,
    marginVertical: Layout.spacing.xs + 2,
  },
  h3: {
    fontWeight: Typography.fontWeight.semibold,
    marginVertical: Layout.spacing.xs,
  },
  paragraph: {
    marginVertical: Layout.spacing.xs / 2,
  },
  bold: { fontWeight: Typography.fontWeight.bold },
  italic: { fontStyle: 'italic' },
  strikethrough: { textDecorationLine: 'line-through' },
  code: { fontFamily: 'monospace', paddingHorizontal: Layout.spacing.xs / 2, borderRadius: 4 },
  link: { textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  listItem: { flexDirection: 'row', marginVertical: Layout.spacing.xs / 2, paddingLeft: Layout.spacing.xs },
  listBullet: { width: 20, fontWeight: Typography.fontWeight.semibold },
  listNumber: { width: 24, fontWeight: Typography.fontWeight.medium },
  listText: {
    flex: 1,
  },
  blockquote: { 
    borderLeftWidth: 4, 
    paddingLeft: Layout.spacing.sm,
    paddingVertical: Layout.spacing.xs,
    marginVertical: Layout.spacing.xs,
    borderRadius: 4,
  },
  blockquoteText: {
    fontStyle: 'italic',
  },
  hr: { height: 1, marginVertical: Layout.spacing.md },
  imagesContainer: { gap: Layout.spacing.sm, marginTop: Layout.spacing.md },
  imageFrame: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Layout.borderRadius.md,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});

export default MarkdownPreview;
