import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_BUCKETS = ['chat-media', 'teacher-media', 'teacher-files', 'client-files'];

function parseStorageParams(searchParams) {
  let bucket = searchParams.get('bucket');
  let filePath = searchParams.get('path');
  const rawUrl = searchParams.get('url');

  if (rawUrl) {
    const match = rawUrl.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/([^?]+)/);
    if (match) {
      bucket = match[1];
      filePath = decodeURIComponent(match[2]);
    }
  }

  if (!bucket) bucket = 'chat-media';
  return { bucket, filePath };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { bucket, filePath } = parseStorageParams(searchParams);
    const customName = searchParams.get('name');

    if (!filePath) {
      return new NextResponse('Missing file path', { status: 400 });
    }

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return new NextResponse('Access to specified bucket is not permitted', { status: 403 });
    }

    const cleanPath = filePath.replace(/\.\./g, '').replace(/^\/+/, '');

    const { data: blob, error: downloadErr } = await supabaseAdmin.storage
      .from(bucket)
      .download(cleanPath);

    if (downloadErr || !blob) {
      console.warn(`[Admin API Gateway Media] Download error for ${bucket}/${cleanPath}:`, downloadErr?.message);

      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(cleanPath, 3600);

      if (signErr || !signed?.signedUrl) {
        return new NextResponse('File not found', { status: 404 });
      }

      return NextResponse.redirect(signed.signedUrl, {
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
      });
    }

    const arrayBuffer = await blob.arrayBuffer();
    const contentType = blob.type || 'application/octet-stream';
    const filename = customName || cleanPath.split('/').pop() || 'attachment';

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[Admin API Gateway Media] Exception:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
