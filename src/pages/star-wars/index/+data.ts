import { useConfig } from "vike-react/useConfig";
import type { Movie, MovieDetails } from "../types.js";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data() {
  const config = useConfig();

  const response = await fetch("https://brillout.github.io/star-wars/api/films.json");
  const moviesData = (await response.json()) as MovieDetails[];

  config({
    title: `${moviesData.length} Star Wars Movies`,
  });

  const movies = minimize(moviesData);
  return { movies };
}

function minimize(movies: MovieDetails[]): Movie[] {
  return movies.map((movie) => {
    const { title, release_date, id } = movie;
    return { title, release_date, id };
  });
}
