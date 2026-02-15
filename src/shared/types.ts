// ── Session Status ──────────────────────────────────────────────────
export type SessionStatus = 'idle' | 'capturing' | 'paused' | 'editing' | 'done';

// ── Geometry ────────────────────────────────────────────────────────
/** Plain-object replacement for DOMRect (unavailable in service worker). */
export interface BoundingRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ── Element Metadata ────────────────────────────────────────────────
export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  ariaLabel?: string;
  ariaRole?: string;
  href?: string;
  type?: string;
  name?: string;
  placeholder?: string;
  title?: string;
  autocomplete?: string;
  value?: string;
  checked?: boolean;
  boundingRect: BoundingRectLike;
  isInIframe: boolean;
}

// ── Interaction Events ──────────────────────────────────────────────
export type InteractionType =
  | 'click'
  | 'input'
  | 'change'
  | 'keypress'
  | 'navigation'
  | 'scroll';

export interface InteractionEvent {
  type: InteractionType;
  timestamp: number;
  url: string;
  element: ElementInfo;
  key?: string; // For keypress events
  value?: string; // For input/change events (may be redacted)
  clickX?: number; // viewport-relative X from MouseEvent.clientX
  clickY?: number; // viewport-relative Y from MouseEvent.clientY
  viewportWidth?: number; // window.innerWidth at capture time
  viewportHeight?: number; // window.innerHeight at capture time
}

// ── Screenshot Strategy ─────────────────────────────────────────────
export interface ScreenshotStrategy {
  /** Time to wait for DOM mutations to settle (ms). Default 400. */
  settleTime: number;
  /** Maximum time to wait for settlement (ms). Default 3000. */
  maxWait: number;
  /** Fixed delay fallback when no mutation observer (ms). Default 500. */
  fixedDelay: number;
}

// ── Capture Step ────────────────────────────────────────────────────
export interface CaptureStep {
  id: string;
  stepNumber: number;
  description: string;
  screenshotDataUrl: string;
  thumbnailDataUrl?: string;
  element: ElementInfo;
  interaction: InteractionEvent;
  timestamp: number;
  url: string;
  annotations?: string; // Fabric.js JSON for editor annotations
}

// ── Capture Session ─────────────────────────────────────────────────
export type SessionMode = 'workflow' | 'screenshot';

export interface CaptureSession {
  id: string;
  tabId: number;
  status: SessionStatus;
  title: string;
  mode?: SessionMode;
  steps: CaptureStep[];
  startUrl: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

// ── Extension Messages (discriminated union) ────────────────────────
export interface StartCaptureMessage {
  type: 'START_CAPTURE';
  payload: { tabId: number };
}

export interface StopCaptureMessage {
  type: 'STOP_CAPTURE';
  payload: Record<string, never>;
}

export interface InteractionEventMessage {
  type: 'INTERACTION_EVENT';
  payload: { event: InteractionEvent };
}

export interface ScreenshotReadyMessage {
  type: 'SCREENSHOT_READY';
  payload: { dataUrl: string; stepId: string };
}

export interface GetSessionDataMessage {
  type: 'GET_SESSION_DATA';
  payload: Record<string, never>;
}

export interface GetStepScreenshotMessage {
  type: 'GET_STEP_SCREENSHOT';
  payload: { stepId: string };
}

export interface HideToolbarMessage {
  type: 'HIDE_TOOLBAR';
  payload: Record<string, never>;
}

export interface ShowToolbarMessage {
  type: 'SHOW_TOOLBAR';
  payload: Record<string, never>;
}

export interface DomSettledMessage {
  type: 'DOM_SETTLED';
  payload: { url: string };
}

export interface HeartbeatMessage {
  type: 'HEARTBEAT';
  payload: Record<string, never>;
}

export interface NavigationDetectedMessage {
  type: 'NAVIGATION_DETECTED';
  payload: { url: string; previousUrl: string };
}

export interface PauseCaptureMessage {
  type: 'PAUSE_CAPTURE';
  payload: Record<string, never>;
}

export interface ResumeCaptureMessage {
  type: 'RESUME_CAPTURE';
  payload: Record<string, never>;
}

export interface CancelCaptureMessage {
  type: 'CANCEL_CAPTURE';
  payload: Record<string, never>;
}

export interface PreClickBufferMessage {
  type: 'PRE_CLICK_BUFFER';
  payload: { timestamp: number };
}

export interface UpdateStepDescriptionMessage {
  type: 'UPDATE_STEP_DESCRIPTION';
  payload: { stepId: string; description: string };
}

export interface UpdateStepAnnotationsMessage {
  type: 'UPDATE_STEP_ANNOTATIONS';
  payload: { stepId: string; annotations: string };
}

export interface ExportCompleteMessage {
  type: 'EXPORT_COMPLETE';
  payload: Record<string, never>;
}

export interface RestoreToolbarMessage {
  type: 'RESTORE_TOOLBAR';
  payload: { stepCount: number; position: { x: number; y: number } | null };
}

export interface SaveToolbarPositionMessage {
  type: 'SAVE_TOOLBAR_POSITION';
  payload: { x: number; y: number };
}

export interface DeleteStepMessage {
  type: 'DELETE_STEP';
  payload: { stepId: string };
}

export interface UpdateStepScreenshotMessage {
  type: 'UPDATE_STEP_SCREENSHOT';
  payload: { stepId: string; screenshotDataUrl: string };
}

export interface ReorderStepsMessage {
  type: 'REORDER_STEPS';
  payload: { stepIds: string[] };
}

export interface TakeScreenshotMessage {
  type: 'TAKE_SCREENSHOT';
  payload: { tabId: number };
}

export type ExtensionMessage =
  | StartCaptureMessage
  | StopCaptureMessage
  | InteractionEventMessage
  | ScreenshotReadyMessage
  | GetSessionDataMessage
  | GetStepScreenshotMessage
  | HideToolbarMessage
  | ShowToolbarMessage
  | DomSettledMessage
  | HeartbeatMessage
  | NavigationDetectedMessage
  | PauseCaptureMessage
  | ResumeCaptureMessage
  | CancelCaptureMessage
  | PreClickBufferMessage
  | UpdateStepDescriptionMessage
  | UpdateStepAnnotationsMessage
  | ExportCompleteMessage
  | RestoreToolbarMessage
  | SaveToolbarPositionMessage
  | DeleteStepMessage
  | UpdateStepScreenshotMessage
  | ReorderStepsMessage
  | TakeScreenshotMessage;

export type MessageType = ExtensionMessage['type'];
