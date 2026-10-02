import type { LatLng } from '../bridge/bridge';
import { distanceM, moveToward } from '../utils/geo';
import { pointInArea } from './bounds';

/** 위치를 갱신하는 간격(ms). 약 12fps. 걷는 흔들림은 CSS가 맡으므로 이 정도로 충분하다 */
const TICK_MS = 83;
/** 탭이 백그라운드에 있다 돌아오는 등 한 번에 너무 멀리 가지 않게 dt를 자른다 */
const MAX_DT_MS = 250;
/** 걷는 속도(화면 px/초). 줌과 상관없이 화면에서 같은 빠르기로 보이게 한다. TODO: 디자인 확인 후 조정 */
const WALK_SPEED_PX = 18;
/** 한 번에 걷는 최대 거리(m). 영역 끝에서 끝까지 한 번에 가지 않게 한다 */
const MAX_WALK_M = 400;
/** 멈춰 있는 시간 범위(ms) */
const IDLE_MIN_MS = 2000;
const IDLE_MAX_MS = 5000;
/** 화면 밖이어도 이만큼(px) 안쪽이면 DOM을 갱신한다. 그보다 멀면 숨긴다. 화면 가장자리에서 갑자기 나타나지 않게 */
const VIEW_MARGIN_PX = 120;

/** 화면 아래(위도가 낮은) 캐릭터가 앞에 오도록 한다. 오버레이 zIndex는 정수여야 한다. */
function zIndexFor(lat: number): number {
  return Math.round((90 - lat) * 10_000);
}
/** 말풍선이 뜬 캐릭터는 다른 캐릭터보다 앞에 둔다 (zIndexFor의 최댓값 1,800,000보다 크게) */
const BUBBLE_Z_OFFSET = 2_000_000;

const WALKING_CLASS = 'character-marker--walking';

interface Agent {
  id: string;
  position: LatLng;
  state: 'idle' | 'walking';
  /** idle이 끝나는 시각 */
  idleUntil: number;
  target: LatLng | null;
  /** 탭 등으로 이 시각까지 멈춘다 */
  holdUntil: number;
}

/** 마커 DOM 쪽. 마커가 엔진보다 먼저 그려질 수 있어 캐릭터 상태와 따로 id로 보관한다 */
interface View {
  overlay: kakao.maps.CustomOverlay | null;
  element: HTMLElement | null;
  /** 마지막으로 DOM에 반영한 값 (같으면 다시 쓰지 않는다) */
  appliedPosition: LatLng | null;
  appliedZIndex: number | null;
  appliedWalking: boolean;
  /** 화면에서 멀리 벗어나 숨겼는지. 숨긴 동안은 위치를 갱신하지 않는다 */
  hidden: boolean;
}

function randomIdleMs(): number {
  return IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
}

/**
 * 캐릭터 돌아다니기 (계획 6.3). 모든 캐릭터를 rAF 루프 하나로 움직인다.
 * React를 다시 그리지 않고 카카오 오버레이의 setPosition / setZIndex와 클래스만 직접 바꾼다.
 *
 * - idle(2~5초) → walking(목표 지점까지) → idle ... 목표 지점은 캐릭터 이동 허용 영역(bounds.ts) 안
 * - 말풍선이 떠 있거나 탭 직후에는 멈춘다. 대화 중(포커스)인 캐릭터는 포커스가 풀릴 때까지 멈춘다
 * - 화면 밖 캐릭터는 숨기고 위치 계산만 한다(DOM 위치는 갱신하지 않는다). 다시 들어오면 위치를 맞추고 보인다
 *   숨기지 않으면 멈춘 옛 위치가 지도를 옮겼을 때 엉뚱한 곳에 보인다
 * - 줌 애니메이션 중에는 DOM을 멈춘다
 * - 페이지가 숨겨지면(visibilityState hidden) 루프를 멈춘다
 */
export class RoamingEngine {
  private readonly map: kakao.maps.Map;
  private center: LatLng | null = null;
  private readonly agents = new Map<string, Agent>();
  private readonly views = new Map<string, View>();
  private busy: ReadonlySet<string> = new Set();
  /** 대화 중인 캐릭터. hold·busy와 달리 저절로 풀리지 않고 setFocus(null)까지 멈춘다 */
  private focusedId: string | null = null;
  private frame: number | null = null;
  private lastTick: number | null = null;
  private zooming = false;
  private running = false;

  constructor(map: kakao.maps.Map) {
    this.map = map;
  }

  /** 동네(중심)나 캐릭터 목록이 바뀌면 첫 배치 위치에서 다시 시작한다 */
  reset(center: LatLng, placements: readonly { id: string; position: LatLng }[]): void {
    this.center = center;
    const now = performance.now();
    this.agents.clear();
    for (const { id, position } of placements) {
      this.agents.set(id, {
        id,
        position,
        state: 'idle',
        // 모두 동시에 출발하지 않도록 처음 쉬는 시간도 무작위로 준다
        idleUntil: now + randomIdleMs(),
        target: null,
        holdUntil: 0,
      });
    }
    this.agents.forEach((agent) => this.apply(agent, true));
  }

  /** 말풍선이 떠 있는 캐릭터 id. 이 캐릭터들은 멈추고 맨 앞에 그린다 */
  setBusy(ids: ReadonlySet<string>): void {
    this.busy = ids;
    this.agents.forEach((agent) => this.apply(agent, true));
  }

  /**
   * 대화 중인 캐릭터를 정한다(한 번에 하나). 이전 캐릭터는 풀린다.
   * 아직 없는 id여도 걸어 두므로, 나중에 배치되면 그때부터 멈춰 있다.
   */
  setFocus(id: string | null): void {
    this.focusedId = id;
    const agent = id === null ? undefined : this.agents.get(id);
    if (!agent) return;
    this.stopWalking(agent);
    this.apply(agent, true);
  }

  /** 지금 위치. 첫 배치 위치가 아니라 걸어간 뒤의 위치다. 없는 캐릭터면 null */
  positionOf(id: string): LatLng | null {
    return this.agents.get(id)?.position ?? null;
  }

  /** 탭 등으로 잠시 멈춘다 */
  hold(id: string, ms: number): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    agent.holdUntil = performance.now() + ms;
    this.stopWalking(agent);
    this.apply(agent, true);
  }

  /** 마커가 그려지면(오버레이 생성) 등록한다. 숨었다 다시 나타나도 지금 위치에 바로 선다 */
  attachOverlay(id: string, overlay: kakao.maps.CustomOverlay | null): void {
    const view = this.viewOf(id);
    view.overlay = overlay;
    view.appliedPosition = null;
    view.appliedZIndex = null;
    view.hidden = false; // 새 오버레이는 보이는 상태로 만들어진다
    this.forgetEmptyView(id, view);
    if (!overlay) return;
    // onCreate 직후 라이브러리가 position prop(첫 배치 위치)으로 setPosition을 한 번 더 부른다.
    // 같은 커밋이 끝난 뒤(그리기 전)에 지금 위치를 다시 적용해야 숨었다 나타날 때 제자리로 튀지 않는다.
    queueMicrotask(() => {
      const agent = this.agents.get(id);
      if (!agent || this.views.get(id)?.overlay !== overlay) return;
      view.appliedPosition = null;
      view.appliedZIndex = null;
      this.apply(agent, true);
    });
  }

  /** 걷기 클래스를 붙일 마커 요소 */
  attachElement(id: string, element: HTMLElement | null): void {
    const view = this.viewOf(id);
    view.element = element;
    view.appliedWalking = false;
    this.forgetEmptyView(id, view);
    const agent = this.agents.get(id);
    if (agent && element) this.apply(agent, true);
  }

  private viewOf(id: string): View {
    let view = this.views.get(id);
    if (!view) {
      view = {
        overlay: null,
        element: null,
        appliedPosition: null,
        appliedZIndex: null,
        appliedWalking: false,
        hidden: false,
      };
      this.views.set(id, view);
    }
    return view;
  }

  private forgetEmptyView(id: string, view: View): void {
    if (!view.overlay && !view.element) this.views.delete(id);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    document.addEventListener('visibilitychange', this.handleVisibility);
    kakao.maps.event.addListener(this.map, 'zoom_start', this.handleZoomStart);
    kakao.maps.event.addListener(this.map, 'zoom_changed', this.handleZoomChanged);
    this.requestFrame();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    document.removeEventListener('visibilitychange', this.handleVisibility);
    kakao.maps.event.removeListener(this.map, 'zoom_start', this.handleZoomStart);
    kakao.maps.event.removeListener(this.map, 'zoom_changed', this.handleZoomChanged);
    this.cancelFrame();
  }

  private readonly handleVisibility = () => {
    if (document.visibilityState === 'hidden') {
      this.cancelFrame();
    } else if (this.running) {
      this.requestFrame();
    }
  };

  private readonly handleZoomStart = () => {
    this.zooming = true;
  };

  private readonly handleZoomChanged = () => {
    this.zooming = false;
    // 줌 중에 멈춰 있던 위치를 한 번에 반영한다
    this.agents.forEach((agent) => this.apply(agent, true));
  };

  private requestFrame(): void {
    if (this.frame !== null || document.visibilityState === 'hidden') return;
    this.lastTick = null;
    this.frame = requestAnimationFrame(this.loop);
  }

  private cancelFrame(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.lastTick = null;
  }

  private readonly loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop);
    if (this.lastTick === null) {
      this.lastTick = now;
      return;
    }
    const elapsed = now - this.lastTick;
    if (elapsed < TICK_MS) return;
    this.lastTick = now;
    this.tick(now, Math.min(elapsed, MAX_DT_MS));
  };

  private tick(now: number, dtMs: number): void {
    const center = this.center;
    if (!center) return;
    const metersPerPx = this.metersPerPixel();
    const stepM = metersPerPx === null ? 0 : (WALK_SPEED_PX * metersPerPx * dtMs) / 1000;

    this.agents.forEach((agent) => {
      if (agent.id === this.focusedId || this.busy.has(agent.id) || now < agent.holdUntil) {
        this.stopWalking(agent);
      } else if (agent.state === 'idle') {
        if (now >= agent.idleUntil) {
          agent.target = this.pickTarget(center, agent.position);
          agent.state = 'walking';
        }
      } else if (agent.target) {
        agent.position = moveToward(agent.position, agent.target, stepM);
        if (agent.position === agent.target) this.stopWalking(agent);
      }
      this.apply(agent, false);
    });
  }

  private stopWalking(agent: Agent): void {
    if (agent.state === 'idle') return;
    agent.state = 'idle';
    agent.target = null;
    agent.idleUntil = performance.now() + randomIdleMs();
  }

  /** 영역 안의 무작위 지점 쪽으로, 최대 MAX_WALK_M까지. 원 안의 두 점 사이이므로 결과도 영역 안이다 */
  private pickTarget(center: LatLng, from: LatLng): LatLng {
    const candidate = pointInArea(center, Math.random);
    const distance = distanceM(from, candidate);
    return distance <= MAX_WALK_M ? candidate : moveToward(from, candidate, MAX_WALK_M);
  }

  /** 지금 줌에서 화면 1px이 몇 m인지. 지도가 아직 그려지지 않았으면 null */
  private metersPerPixel(): number | null {
    const projection = this.map.getProjection();
    const a = projection.coordsFromContainerPoint(new kakao.maps.Point(0, 0));
    const b = projection.coordsFromContainerPoint(new kakao.maps.Point(100, 0));
    const meters = distanceM(
      { lat: a.getLat(), lng: a.getLng() },
      { lat: b.getLat(), lng: b.getLng() },
    );
    return meters > 0 ? meters / 100 : null;
  }

  private isNearView(position: LatLng): boolean {
    const point = this.map
      .getProjection()
      .containerPointFromCoords(new kakao.maps.LatLng(position.lat, position.lng));
    const node = this.map.getNode();
    return (
      point.x > -VIEW_MARGIN_PX &&
      point.y > -VIEW_MARGIN_PX &&
      point.x < node.clientWidth + VIEW_MARGIN_PX &&
      point.y < node.clientHeight + VIEW_MARGIN_PX
    );
  }

  /**
   * 계산된 상태를 DOM에 반영한다. force가 아니면 줌 중에는 건너뛰고, 화면에서 멀리 벗어나면 숨긴다.
   * force면(리셋·줌 끝·마커 등록 등) 화면 밖이어도 정확한 위치로 맞추므로 보이게 둔다.
   */
  private apply(agent: Agent, force: boolean): void {
    const view = this.views.get(agent.id);
    if (!view) return;
    const { overlay, element } = view;
    const walking = agent.state === 'walking';
    if (element && view.appliedWalking !== walking) {
      element.classList.toggle(WALKING_CLASS, walking);
      view.appliedWalking = walking;
    }
    if (!overlay) return;
    if (!force) {
      if (this.zooming) return;
      if (!this.isNearView(agent.position)) {
        if (!view.hidden) {
          overlay.setVisible(false);
          view.hidden = true;
        }
        return;
      }
    }

    if (view.appliedPosition !== agent.position) {
      overlay.setPosition(new kakao.maps.LatLng(agent.position.lat, agent.position.lng));
      view.appliedPosition = agent.position;
    }
    const zIndex = zIndexFor(agent.position.lat) + (this.busy.has(agent.id) ? BUBBLE_Z_OFFSET : 0);
    if (view.appliedZIndex !== zIndex) {
      overlay.setZIndex(zIndex);
      view.appliedZIndex = zIndex;
    }
    // 위치를 맞춘 뒤에 보여야 옛 자리에서 한 번 깜빡이지 않는다
    if (view.hidden) {
      overlay.setVisible(true);
      view.hidden = false;
    }
  }
}
