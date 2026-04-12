import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import type { MovieDetails } from "../types.js";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
    // biome-ignore lint/correctness/useHookAtTopLevel: Vike data() convention
    const config = useConfig();

    const response = await fetch(
        `https://brillout.github.io/star-wars/api/films/${pageContext.routeParams.id}.json`,
    );
    let movie = (await response.json()) as MovieDetails;

    config({
        title: movie.title,
    });

    movie = minimize(movie);
    return { movie };
}

function minimize(movie: MovieDetails): MovieDetails {
    const { id, title, release_date, director, producer } = movie;
    return { id, title, release_date, director, producer };
}
