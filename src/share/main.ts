import '../styles/tokens.css';
import '../styles/fonts.css';
import '../styles/pretendard-medium.css';
import '../styles/pretendard-bold.css';
import './share.css';
import type { CharacterConfig } from '../bridge/bridge';
import { DEFAULT_CHARACTER_CONFIG, LAYERS } from '../character/layers';
import { resolvePart } from '../character/resolvePart';
import favoriteIcon from './favorite.svg?raw';
import infoIcon from './info.svg?raw';
import { fetchAuthorCharacter } from './character';
import { APP_STORE_URL, detectPlatform, getOpenAppUrl } from './links';
import placeIcon from './place.svg?raw';
import { fetchSharedPost, type SharedPost } from './post';
import { formatRelativeTime } from './relativeTime';

// 앱이 열리면 페이지가 가려진다. 이 시간이 지나도 보이면 앱이 없다고 보고 스토어로 보낸다(iOS 커스텀 스킴).
const OPEN_APP_TIMEOUT_MS = 1500;
// 앱 AiScoreCheckCard와 같은 속도로 숫자를 굴린다.
const SCORE_ROLL_INTERVAL_MS = 90;
const AUTHOR_CHARACTER_SIZE = 56;

const postId = decodeURIComponent(location.pathname.match(/^\/p\/([^/]+)/)?.[1] ?? '');
const platform = detectPlatform(navigator.userAgent);

const root = document.getElementById('post')!;
const openButton = document.getElementById('open-app') as HTMLAnchorElement;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  // 사용자가 쓴 글이 들어가므로 innerHTML을 쓰지 않는다.
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 번들에 든 고정 SVG(`currentColor`)만 넣는다. 사용자 입력은 절대 이 함수로 넣지 않는다. */
function icon(svg: string, className: string) {
  const node = el('span', className);
  node.innerHTML = svg;
  node.setAttribute('aria-hidden', 'true');
  return node;
}

/**
 * 작성자 착용 정보를 못 받으면 앱처럼 기본 캐릭터를 그린다.
 * 기하는 지도 캐릭터(CharacterSprite.css)·앱 Character와 같다.
 */
function renderCharacter(config: CharacterConfig) {
  const sprite = el('div', 'share-character');
  sprite.style.width = `${AUTHOR_CHARACTER_SIZE}px`;
  sprite.style.height = `${AUTHOR_CHARACTER_SIZE}px`;
  const layers = el('div', 'share-character__layers');
  for (const layer of LAYERS) {
    const src = resolvePart(config, layer);
    if (!src) continue;
    const part = el('img', 'share-character__part');
    part.src = src;
    part.alt = '';
    part.draggable = false;
    layers.append(part);
  }
  sprite.append(layers);
  return sprite;
}

function renderAuthor(post: SharedPost, character: CharacterConfig) {
  const place = el('div', 'share-author__place');
  place.append(
    icon(placeIcon, 'share-author__place-icon'),
    el('span', 'share-text share-text--body3 share-text--gray-400', post.location),
  );

  const meta = el('div', 'share-author__meta');
  meta.append(
    place,
    el('span', 'share-text share-text--body3 share-text--gray-400', '·'),
    el(
      'span',
      'share-text share-text--body3 share-text--gray-400',
      formatRelativeTime(post.created_at),
    ),
  );

  const info = el('div', 'share-author__info');
  info.append(el('strong', 'share-text share-text--h3 share-text--gray-800', post.user_name), meta);

  const author = el('div', 'share-author');
  author.append(renderCharacter(character), info);
  return author;
}

function renderImage(post: SharedPost) {
  const image = el('img', 'share-image');
  image.alt = '게시글 사진';
  image.draggable = false;
  if (post.post_image_url) image.src = post.post_image_url;
  return image;
}

function renderTitleRow(post: SharedPost) {
  const like = el('div', 'share-like');
  like.append(
    icon(favoriteIcon, 'share-like__icon'),
    el('span', 'share-text share-text--body3 share-text--gray-700', String(post.like_count)),
  );

  const row = el('div', 'share-title-row');
  row.append(
    el(
      'p',
      'share-text share-text--body2 share-text--gray-800 share-title-row__content',
      post.content,
    ),
    like,
  );
  return row;
}

function renderScoreCard(score: number, comment: string) {
  const left = el('div', 'share-score__summary');
  left.append(
    el('span', 'share-text share-text--h3 share-text--gray-800', 'AI 평가 점수'),
    el('span', 'share-score__number', String(score)),
  );

  const card = el('div', 'share-score');
  card.append(
    icon(infoIcon, 'share-score__info'),
    left,
    el('div', 'share-score__divider'),
    el('p', 'share-text share-text--body2 share-text--gray-700 share-score__comment', comment),
  );
  return card;
}

/** 앱처럼 점수를 바로 보여 주지 않고, 눌러야 공개한다. */
function renderScoreCheckCard(score: number, comment: string) {
  const randomScore = () => String(Math.floor(Math.random() * 99) + 1);
  const number = el('span', 'share-score__number share-score__number--rolling', randomScore());
  const timer = window.setInterval(() => {
    number.textContent = randomScore();
  }, SCORE_ROLL_INTERVAL_MS);

  const button = el('button', 'share-small-button', 'AI 점수 확인하기');
  button.type = 'button';

  const body = el('div', 'share-score-check__body');
  body.append(number, button);

  const card = el('div', 'share-score-check');
  card.append(body, icon(infoIcon, 'share-score__info'));

  button.addEventListener('click', () => {
    window.clearInterval(timer);
    card.replaceWith(renderScoreCard(score, comment));
  });
  return card;
}

function renderPost(post: SharedPost, character: CharacterConfig) {
  const top = el('div', 'share-post__top');
  top.append(renderAuthor(post, character), renderImage(post));

  const nodes: HTMLElement[] = [top, renderTitleRow(post)];
  if (post.score !== undefined) nodes.push(renderScoreCheckCard(post.score, post.ai_review ?? ''));
  root.replaceChildren(...nodes);
}

function renderStatus(message: string) {
  root.replaceChildren(
    el('p', 'share-text share-text--body2 share-text--gray-500 share-status', message),
  );
}

function setupOpenButton() {
  openButton.href = postId ? getOpenAppUrl(platform, postId) : APP_STORE_URL;
  if (platform !== 'ios' || !postId) return;

  openButton.addEventListener('click', () => {
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') location.href = APP_STORE_URL;
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
    if (!post) {
      renderStatus('삭제되었거나 볼 수 없는 게시글이에요.');
      return;
    }
    // 기본 캐릭터를 먼저 그렸다 바꾸면 깜빡여서, 받아 온 뒤 한 번에 그린다. 실패해도 게시글은 보여 준다.
    const character = post.user_id ? await fetchAuthorCharacter(post.user_id) : null;
    renderPost(post, character ?? DEFAULT_CHARACTER_CONFIG);
  } catch {
    renderStatus('게시글을 불러오지 못했어요. 앱에서 확인해 주세요.');
  } finally {
    root.setAttribute('aria-busy', 'false');
  }
}

setupOpenButton();
void load();
