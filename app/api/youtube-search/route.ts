import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ items: [] });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "YouTube API key not configured" }, { status: 500 });
  }

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=6&q=${encodeURIComponent(q)}&key=${key}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message ?? "YouTube API error" }, { status: 500 });
    }

    const items = (data.items ?? []).map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.default?.url ?? "",
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Failed to reach YouTube" }, { status: 500 });
  }
}
