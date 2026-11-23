import '../styles/tokens.css';
import '../styles/fonts.css';
import './share.css';
import { detectPlatform, getOpenAppUrl, getStoreUrl } from './links';
import { fetchSharedPost, type SharedPost } from './post';

// 앱이 열리면 페이지가 가려진다. 이 시간이 지나도 보이면 앱이 없다고 보고 스토어로 보낸다(iOS 커스텀 스킴).
const OPEN_APP_TIMEOUT_MS = 1500;

const postId = decodeURIComponent(location.pathname.match(/^\/p\/([^/]+)/)?.[1] ?? '');
const platform = detectPlatform(navigator.userAgent);
const storeUrl = getStoreUrl(platform);

const card = document.getElementById('post')!;
const openButton = document.getElementById('open-app') as HTMLAnchorElement;
const installButton = document.getElementById('install-app') as HTMLAnchorElement;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  // 사용자가 쓴 글이 들어가므로 innerHTML을 쓰지 않는다.
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(dateTime: string) {
  const [date] = dateTime.split('T');
  return date.replaceAll('-', '.');
}

function renderPost(post: SharedPost) {
  const author = el('div', 'share__author');
  author.append(
    el('strong', 'share__author-name', post.user_name),
    el(
      'span',
      'share__meta',
      `${post.city_name} ${post.location} · ${formatDate(post.created_at)}`,
    ),
  );

  const nodes: HTMLElement[] = [author];
  if (post.post_image_url) {
    const image = el('img', 'share__image');
    image.src = post.post_image_url;
    image.alt = '게시글 사진';
    image.draggable = false;
    nodes.push(image);
  }
  nodes.push(
    el('p', 'share__content', post.content),
    el('span', 'share__likes', `좋아요 ${post.like_count.toLocaleString()}개`),
  );
  card.replaceChildren(...nodes);
}

function renderStatus(message: string) {
  card.replaceChildren(el('p', 'share__status', message));
}

function setupButtons() {
  if (postId) {
    openButton.href = getOpenAppUrl(platform, postId);
  } else {
    openButton.hidden = true;
  }

  if (storeUrl) {
    installButton.href = storeUrl;
  } else {
    installButton.hidden = true;
  }

  // Android는 intent URL이 스토어 이동까지 맡는다.
  if (platform !== 'ios' || !storeUrl) return;
  openButton.addEventListener('click', () => {
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') location.href = storeUrl;
    }, OPEN_APP_TIMEOUT_MS);
    document.addEventListener('visibilitychange', () => window.clearTimeout(timer), { once: true });
  });
}

async function load() {
  if (!postId) {
    renderStatus('잘못된 링크예요.');
    return;
  }
  try {
    const post = await fetchSharedPost(postId);
    if (post) renderPost(post);
    else renderStatus('삭제되었거나 볼 수 없는 게시글이에요.');
  } catch {
    renderStatus('게시글을 불러오지 못했어요. 앱에서 확인해 주세요.');
  } finally {
    card.setAttribute('aria-busy', 'false');
  }
}

setupButtons();
void load();
