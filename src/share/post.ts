import * as z from 'zod/mini';

/**
 * `GET /api/post/{postId}`(로그인 없이 조회 가능). 웹은 지도에서는 백엔드를 부르지 않지만, 공유 페이지는 앱 밖이라
 * 브리지가 없어 직접 받는다. vercel.json(운영)·vite proxy(로컬)가 같은 출처로 넘겨 CORS 설정이 필요 없다.
 * 앱 레포(TikiTaka-app)와 동기화 필요: src/types/post.ts의 PostDetail
 */
const PostDetailSchema = z.object({
  user_name: z.string(),
  content: z.string(),
  city_name: z.string(),
  location: z.string(),
  /** 발급 실패하면 빠진다. 10분짜리 presigned URL이다. */
  post_image_url: z.optional(z.string()),
  like_count: z.number(),
  /** 타임존 없는 KST 문자열. 예: '2026-09-07T21:34:56.789' */
  created_at: z.string(),
});

const ResponseSchema = z.object({ data: PostDetailSchema });

export type SharedPost = z.infer<typeof PostDetailSchema>;

/** 없거나 삭제·심사 중인 글은 404라 `null`을 돌려준다. 그 밖의 실패는 던진다. */
export async function fetchSharedPost(postId: string): Promise<SharedPost | null> {
  const response = await fetch(`/api/post/${encodeURIComponent(postId)}`);
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`post ${response.status}`);
  const json: unknown = await response.json();
  return ResponseSchema.parse(json).data;
}
