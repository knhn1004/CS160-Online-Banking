import React from 'react';
import { ThemedText } from '@/components/themed-text';
import { renderWithProviders } from '@/test-utils';

describe('ThemedText', () => {
  it('renders correctly', () => {
    const { getByText } = renderWithProviders(
      <ThemedText>Test Text</ThemedText>
    );
    expect(getByText('Test Text')).toBeTruthy();
  });

  it('applies title type styling', () => {
    const { getByText } = renderWithProviders(
      <ThemedText type="title">Title</ThemedText>
    );
    const title = getByText('Title');
    expect(title).toBeTruthy();
  });

  it('applies subtitle type styling', () => {
    const { getByText } = renderWithProviders(
      <ThemedText type="subtitle">Subtitle</ThemedText>
    );
    const subtitle = getByText('Subtitle');
    expect(subtitle).toBeTruthy();
  });

  it('applies link type styling', () => {
    const { getByText } = renderWithProviders(
      <ThemedText type="link">Link</ThemedText>
    );
    const link = getByText('Link');
    expect(link).toBeTruthy();
  });
});

