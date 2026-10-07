import React, {useEffect, useState} from 'react';
import {fetchTMDBList, TMDBMovie, TMDBShow} from '../tmdb';
import PosterRow from './PosterRow';

type Props = Omit<React.ComponentProps<typeof PosterRow>, 'title' | 'items'>;

/* "Movies" row: TMDB popular movies, normalized so `title` becomes `name`
   and the shared Poster, details and player screens work unchanged. */
export default function MoviesRow(props: Props) {
  const [movies, setMovies] = useState<TMDBShow[]>([]);

  useEffect(() => {
    fetchTMDBList<TMDBMovie>('/movie/popular')
      .then(results =>
        setMovies(results.map(({title, ...rest}) => ({...rest, name: title}))),
      )
      .catch(error => console.error('TMDB movies request failed:', error));
  }, []);

  return <PosterRow title="Movies" items={movies} {...props} />;
}
