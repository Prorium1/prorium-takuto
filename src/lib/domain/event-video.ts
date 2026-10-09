export function eventVideo(
  raw: string,
): { provider: "YouTube" | "Vimeo"; embed: string; watch: string } | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    let id: string | null = null;
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
    ) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else
        id =
          url.pathname.match(
            /^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})$/,
          )?.[1] ?? null;
    }
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id))
      return {
        provider: "YouTube",
        embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
        watch: `https://www.youtube.com/watch?v=${id}`,
      };
    if (["vimeo.com", "www.vimeo.com"].includes(url.hostname)) {
      const match = url.pathname.match(
        /^\/(\d{1,12})(?:\/([A-Za-z0-9]{6,64}))?\/?$/,
      );
      if (match)
        return {
          provider: "Vimeo",
          embed: `https://player.vimeo.com/video/${match[1]}?dnt=1&autoplay=1${match[2] ? `&h=${match[2]}` : ""}`,
          watch: `https://vimeo.com/${match[1]}${match[2] ? `/${match[2]}` : ""}`,
        };
    }
    return null;
  } catch {
    return null;
  }
}
