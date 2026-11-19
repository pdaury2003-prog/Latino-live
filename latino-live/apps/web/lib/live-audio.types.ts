export type LiveSignal =
  | { kind: 'join'; from: string }
  | { kind: 'leave'; from: string }
  | { kind: 'camera'; from: string; on: boolean }
  | { kind: 'offer'; from: string; to: string; sdp: string }
  | { kind: 'answer'; from: string; to: string; sdp: string }
  | { kind: 'ice'; from: string; to: string; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };

export type LiveAudio = {
  /** Joins the mesh of this room as a listener; no microphone is opened. */
  start: () => Promise<void>;
  /** Opens the microphone and sends it to everyone already connected. */
  enableMic: () => Promise<boolean>;
  /** Closes the microphone and every peer connection. */
  stop: () => void;
  /** Sends one peer signal received from the room channel. */
  receive: (signal: LiveSignal) => void;
  /**
   * Tries every call again after the phone slept, changed network or lost the
   * socket: dead connections are rebuilt and the room is asked to answer.
   */
  resume?: () => void;
  /** Person ids currently sending audio. */
  remotes: () => string[];
  /** Opens the camera and sends it to everyone already connected. */
  startCamera: () => Promise<boolean>;
  /** Stops sending the camera; the microphone keeps working. */
  stopCamera: () => void;
  /** Turns the phone's camera around while it is on. */
  switchCamera: () => Promise<boolean>;
  /** Cuts or restores this person's microphone without leaving the camera. */
  setMicEnabled: (on: boolean) => void;
  /** Whether this person is sending video right now. */
  cameraOn: () => boolean;
  /** Every camera in the room, this person included. */
  videos: () => LiveVideoEntry[];
};

/** A camera picture: a browser stream or a native stream address. */
export type VideoSource = { stream: unknown } | { url: string };

export type LiveVideoEntry = { id: string; source: VideoSource; self: boolean };

export type LiveAudioOptions = {
  selfId: string;
  /** STUN and TURN servers for the call; the app reads them from the project. */
  iceServers?: { urls: string; username?: string; credential?: string }[];
  onSignal: (signal: LiveSignal) => void;
  onRemoteChange: (ids: string[]) => void;
  onVideoChange?: (videos: LiveVideoEntry[]) => void;
  onError: (message: string) => void;
};
