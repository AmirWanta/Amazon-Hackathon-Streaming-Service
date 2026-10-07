import React, {useEffect, useState} from 'react';
import {fetchTMDBList, TMDBShow} from '../tmdb';
import PosterRow from './PosterRow';

type Props = Omit<React.ComponentProps<typeof PosterRow>, 'title' | 'items'>;

/* "Series" row: TMDB top rated TV, so it doesn't duplicate "Popular Shows". */
export default function SeriesRow(props: Props) {
  const [series, setSeries] = useState<TMDBShow[]>([]);

  useEffect(() => {
    fetchTMDBList<TMDBShow>('/tv/top_rated')
      .then(setSeries)
      .catch(error => console.error('TMDB series request failed:', error));
  }, []);

  return <PosterRow title="Series" items={series} {...props} />;
}
