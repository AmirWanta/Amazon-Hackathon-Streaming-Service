/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

const fetchedShow = {
  id: 1,
  name: 'Fetched Test Show',
  overview: 'A show returned by TMDB.',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  vote_average: 8.5,
};

afterEach(() => {
  jest.restoreAllMocks();
});

test('stores fetched shows in state and renders them', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({results: [fetchedShow, {...fetchedShow, id: 2, name: 'Second Show'}]}),
  } as Response);

  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  const renderedText = renderer!.root
    .findAllByType('Text' as never)
    .map(node => node.props.children)
    .flat()
    .filter(child => typeof child === 'string')
    .join(' ');

  expect(renderedText).toContain('Fetched Test Show');
  expect(renderedText).toContain('Second Show');
});

test('renders actionable feedback for an unauthorized API response', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({status_code: 7, status_message: 'Invalid API key'}),
  } as Response);

  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  const renderedText = renderer!.root
    .findAllByType('Text' as never)
    .map(node => node.props.children)
    .flat()
    .filter(child => typeof child === 'string')
    .join(' ');

  expect(renderedText).toContain('API key appears invalid or unauthorized');
  expect(renderedText).toContain('Fetched Test Show');
  expect(renderedText).toContain('using the saved fallback cache');
});
