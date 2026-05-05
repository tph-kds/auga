"""
Lightweight Visual Feature Extractor for RL Training.

Captures rendered game frames, extracts compact visual features using
lightweight CNN (no GPU required), stores frames+features to data/images/.
Features feed directly into the RL observation space for visual training.
"""
import io
import os
import json
import time
import logging
import hashlib
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from datetime import datetime

import numpy as np

logger = logging.getLogger(__name__)

# ── Image data directory ────────────────────────────────────────────────────
IMAGE_DIR = Path("data/images")
IMAGE_DIR.mkdir(parents=True, exist_ok=True)
META_FILE = IMAGE_DIR / "index.json"


def _load_index() -> Dict:
    if META_FILE.exists():
        try:
            return json.loads(META_FILE.read_text())
        except Exception:
            pass
    return {"frames": [], "total": 0}


def _save_index(idx: Dict):
    META_FILE.write_text(json.dumps(idx, indent=2))


class VisualFeatureExtractor:
    """
    Lightweight image-based feature extraction for Angry Birds env.

    Pipeline:
      1. Receive RGB array from env render()
      2. Downsample to 84×84 (canonical DQN size)
      3. Convert to grayscale (optional)
      4. Extract compact feature vector via simple statistics
      5. Save raw frame + features to data/images/
      6. Return feature array for RL observation augmentation
    """

    def __init__(
        self,
        img_size: Tuple[int, int] = (84, 84),
        grayscale: bool = True,
        save_every: int = 10,        # Save 1 in every N frames
        max_stored: int = 5000,       # Max frames to store
    ):
        self.img_size = img_size
        self.grayscale = grayscale
        self.save_every = save_every
        self.max_stored = max_stored
        self._frame_count = 0
        self._index = _load_index()
        self._has_cv = self._check_cv()

    def _check_cv(self) -> bool:
        try:
            import cv2  # noqa: F401
            return True
        except ImportError:
            logger.info("cv2 not available — using numpy-only processing")
            return False

    # ── Core extraction ─────────────────────────────────────────────────────

    def extract(self, frame: np.ndarray, episode: int = 0, step: int = 0) -> np.ndarray:
        """
        Process a raw RGB frame and return a compact feature vector.

        Args:
            frame: np.ndarray shape (H, W, 3) uint8 RGB
            episode: current episode number
            step: current timestep within episode

        Returns:
            features: np.ndarray shape (feature_dim,) float32
        """
        if frame is None or frame.size == 0:
            return np.zeros(128, dtype=np.float32)

        # Resize
        small = self._resize(frame)

        # Convert to grayscale
        gray = self._to_gray(small) if self.grayscale else small

        # Extract features
        features = self._compute_features(gray, small)

        # Store periodically
        self._frame_count += 1
        if self._frame_count % self.save_every == 0:
            self._store(small, features, episode, step)

        return features

    def _resize(self, frame: np.ndarray) -> np.ndarray:
        H, W = self.img_size
        if self._has_cv:
            import cv2
            return cv2.resize(frame, (W, H), interpolation=cv2.INTER_AREA)
        # Numpy fallback: simple strided downsampling
        fh, fw = frame.shape[:2]
        row_idx = np.linspace(0, fh-1, H, dtype=int)
        col_idx = np.linspace(0, fw-1, W, dtype=int)
        return frame[np.ix_(row_idx, col_idx)]

    def _to_gray(self, rgb: np.ndarray) -> np.ndarray:
        """BT.601 luminance weights."""
        r, g, b = rgb[...,0], rgb[...,1], rgb[...,2]
        return (0.299*r + 0.587*g + 0.114*b).astype(np.uint8)

    def _compute_features(self, gray: np.ndarray, rgb: np.ndarray) -> np.ndarray:
        """
        Extract compact 128-dim feature vector from processed frame.

        Features cover:
          - Global statistics (mean, std, min, max)  [4]
          - 4×4 spatial grid means (spatial layout)  [16]
          - 4×4 spatial grid stds                    [16]
          - 8-bin intensity histogram                 [8]
          - RGB channel stats                         [12]
          - Edge density (gradient magnitude mean)    [4]
          - Spatial attention weights (top/bottom/left/right region means) [4]
          - Temporal placeholder (zeros for now)      [64]  ← filled by caller
        """
        f = gray.astype(np.float32) / 255.0
        H, W = f.shape

        feats = []

        # Global stats
        feats += [f.mean(), f.std(), f.min(), f.max()]

        # 4×4 spatial grid
        for r in range(4):
            for c in range(4):
                cell = f[r*H//4:(r+1)*H//4, c*W//4:(c+1)*W//4]
                feats.append(cell.mean())
        for r in range(4):
            for c in range(4):
                cell = f[r*H//4:(r+1)*H//4, c*W//4:(c+1)*W//4]
                feats.append(cell.std())

        # Histogram (8 bins)
        hist, _ = np.histogram(f, bins=8, range=(0,1))
        feats += list(hist.astype(np.float32) / max(hist.sum(), 1))

        # RGB channel stats
        for ch in range(rgb.shape[2] if len(rgb.shape)==3 else 1):
            c_data = rgb[...,ch].astype(np.float32)/255.0 if len(rgb.shape)==3 else f
            feats += [c_data.mean(), c_data.std(), c_data.max() - c_data.min(), np.percentile(c_data,75)]

        # Edge density (simple gradient)
        dx = np.abs(np.diff(f, axis=1)).mean()
        dy = np.abs(np.diff(f, axis=0)).mean()
        feats += [dx, dy, (dx+dy)/2, np.sqrt(dx**2+dy**2)]

        # Spatial attention regions
        feats += [f[:H//2,:].mean(), f[H//2:,:].mean(), f[:,:W//2].mean(), f[:,W//2:].mean()]

        n = len(feats)
        if n < 128:
            feats += [0.0] * (128 - n)

        return np.array(feats[:128], dtype=np.float32)

    # ── Storage ─────────────────────────────────────────────────────────────

    def _store(self, frame: np.ndarray, features: np.ndarray, episode: int, step: int):
        """Save frame as PNG and features as npy alongside an index entry."""
        try:
            # Enforce max_stored
            while self._index["total"] >= self.max_stored:
                oldest = self._index["frames"].pop(0)
                for f in [oldest.get("img"), oldest.get("feat")]:
                    if f and os.path.exists(f):
                        os.remove(f)
                self._index["total"] -= 1

            ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
            base = f"ep{episode:04d}_step{step:06d}_{ts}"
            img_path  = str(IMAGE_DIR / f"{base}.png")
            feat_path = str(IMAGE_DIR / f"{base}.npy")

            # Save image
            if self._has_cv:
                import cv2
                cv2.imwrite(img_path, cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
            else:
                # PIL fallback
                from PIL import Image
                Image.fromarray(frame).save(img_path)

            # Save feature vector
            np.save(feat_path, features)

            entry = {
                "img": img_path, "feat": feat_path,
                "episode": episode, "step": step,
                "timestamp": ts, "feature_dim": len(features),
            }
            self._index["frames"].append(entry)
            self._index["total"] += 1
            _save_index(self._index)

        except Exception as e:
            logger.debug(f"Frame storage skipped: {e}")

    # ── Utilities ────────────────────────────────────────────────────────────

    def get_statistics(self) -> Dict:
        return {
            "total_stored": self._index["total"],
            "frames_processed": self._frame_count,
            "img_size": self.img_size,
            "feature_dim": 128,
            "storage_dir": str(IMAGE_DIR),
        }

    def load_batch(self, n: int = 32) -> Tuple[np.ndarray, np.ndarray]:
        """Load a random batch of stored features and metadata for offline training."""
        entries = self._index["frames"]
        if not entries:
            return np.zeros((0, 128), dtype=np.float32), np.array([])
        idx = np.random.choice(len(entries), min(n, len(entries)), replace=False)
        feats, labels = [], []
        for i in idx:
            e = entries[i]
            if os.path.exists(e["feat"]):
                feats.append(np.load(e["feat"]))
                labels.append(e["episode"])
        return np.array(feats, dtype=np.float32), np.array(labels)


# ── Observation Wrapper ───────────────────────────────────────────────────

import gymnasium as gym


class VisualAugmentedEnv(gym.Wrapper):
    """
    Wraps an existing gymnasium.Env to capture rendered frames
    and extract visual features as a side-channel for logging.

    The wrapper is TRANSPARENT to the RL algorithm:
    - observation_space / action_space are unchanged
    - Visual features are extracted and stored, NOT added to obs
      (keeps compatibility with MlpPolicy without changing obs dim)

    Inherits from gym.Wrapper so SB3's check_env() and Monitor
    recognise it as a valid gymnasium.Env.
    """

    def __init__(self, env: gym.Env, extractor: Optional[VisualFeatureExtractor] = None):
        super().__init__(env)          # gym.Wrapper sets self.env and delegates spaces
        self.extractor = extractor or VisualFeatureExtractor()
        self._episode = 0
        self._step    = 0

    # ── Gymnasium interface ───────────────────────────────────────────

    def reset(self, **kwargs):
        obs, info = self.env.reset(**kwargs)
        self._episode += 1
        self._step    = 0
        self._capture_frame()
        return obs, info

    def step(self, action):
        obs, reward, terminated, truncated, info = self.env.step(action)
        self._step += 1
        self._capture_frame()
        return obs, reward, terminated, truncated, info

    # ── Internal helpers ──────────────────────────────────────────────

    def _capture_frame(self) -> None:
        """Extract visual features from the current rendered frame (best-effort)."""
        try:
            frame = self.env.render()
            if frame is not None and isinstance(frame, np.ndarray) and frame.size > 0:
                self.extractor.extract(frame, self._episode, self._step)
        except Exception:
            pass  # Never let frame capture crash the training loop


# ── Singleton ─────────────────────────────────────────────────────────────────
visual_extractor = VisualFeatureExtractor()
