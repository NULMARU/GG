import type { TrackDraft } from "../types";
import { analyzeSourceUrl, extractYouTubeId } from "./source";
import { fetchYouTubeVideoMetadata } from "./youtubeData";
import { fetchYouTubeOembedMetadata } from "./youtubeOembed";

export interface SourceMetadataPatch {
  title?: string;
  artist?: string;
  genre?: string;
  imageUrl?: string;
  note: string;
}

function filenameTitle(sourceUrl: string): string | undefined {
  try {
    const url = new URL(sourceUrl);
    const filename = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
    const withoutExtension = filename.replace(/\.(mp3|m4a|aac|wav|ogg|opus|flac)$/i, "");
    return withoutExtension
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return undefined;
  }
}

function titleFromSlug(sourceUrl: string): string | undefined {
  try {
    const url = new URL(sourceUrl);
    const slug = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
    return slug.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    return undefined;
  }
}

export async function analyzeSourceMetadata(
  sourceUrl: string
): Promise<SourceMetadataPatch> {
  const source = analyzeSourceUrl(sourceUrl);

  if (source.provider === "youtube") {
    const videoId = extractYouTubeId(sourceUrl);
    if (!videoId) {
      return {
        genre: "YouTube Music",
        imageUrl: source.thumbnailUrl,
        note: "YouTube 링크를 감지했지만 영상 ID를 찾지 못했습니다."
      };
    }

    try {
      const metadata = await fetchYouTubeOembedMetadata(source.externalUrl);
      return {
        title: metadata.title,
        artist: metadata.authorName,
        genre: "YouTube Music",
        imageUrl: metadata.thumbnailUrl ?? source.thumbnailUrl,
        note: "API 키 없이 YouTube oEmbed로 제목, 채널명, 썸네일을 가져왔습니다."
      };
    } catch {
      // Some browsers or networks block oEmbed CORS. Fall back to the keyed API.
    }

    const metadata = await fetchYouTubeVideoMetadata(videoId);
    return {
      title: metadata.title,
      artist: metadata.channelTitle,
      genre: "YouTube Music",
      imageUrl: metadata.thumbnailUrl ?? source.thumbnailUrl,
      note: "YouTube Data API로 제목, 채널명, 썸네일을 가져왔습니다."
    };
  }

  if (source.sourceType === "audio") {
    return {
      title: filenameTitle(sourceUrl),
      genre: "Audio File",
      note: "오디오 파일명을 바탕으로 제목을 추정했습니다."
    };
  }

  if (source.sourceType === "music-generation") {
    return {
      title: titleFromSlug(sourceUrl),
      artist: "Me",
      genre: `${source.label} Generated Music`,
      note: `${source.label} 생성앱 링크를 감지했습니다. 공개 메타데이터는 서비스 정책상 앱에서 직접 읽기 어려울 수 있습니다.`
    };
  }

  return {
    title: titleFromSlug(sourceUrl),
    genre: source.label,
    note: "링크 유형을 바탕으로 기본 정보를 추정했습니다."
  };
}

export function applySourceMetadataPatch(
  draft: TrackDraft,
  patch: SourceMetadataPatch
): TrackDraft {
  return {
    ...draft,
    title: patch.title || draft.title,
    artist: patch.artist || draft.artist,
    genre: patch.genre || draft.genre,
    imageUrl: patch.imageUrl || draft.imageUrl
  };
}
