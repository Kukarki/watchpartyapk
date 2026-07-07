const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
  /youtube\.com\/shorts\/([\w-]{11})/,
];

export function parseVideoUrl(url) {
  if (!url || typeof url !== 'string') return { isValid: false, type: null };

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { isValid: false, type: null };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { isValid: false, type: null };
  }

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return { isValid: true, type: 'youtube', videoId: match[1] };
    }
  }

  // HLS stream
  if (parsed.pathname.endsWith('.m3u8')) {
    return { isValid: true, type: 'hls' };
  }

  return { isValid: true, type: 'direct' };
}
