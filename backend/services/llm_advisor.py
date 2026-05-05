"""
LLM Advisor Service
===================
Optional LLM-based strategic decision layer for the inference phase.

Supports:
  - Google Gemini (via google-generativeai)
  - OpenRouter (OpenAI-compatible endpoint)
  - Fallback: pure RL policy (no LLM)

Configuration (via environment variables or config.py):
  GEMINI_API_KEY       — for Gemini Flash
  OPENROUTER_API_KEY   — for OpenRouter (GPT-4o, Claude, etc.)
  LLM_PROVIDER         — 'gemini' | 'openrouter' | 'none' (default: 'none')
"""
import os
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class LLMAdvisor:
    """
    Strategic LLM advisor for the RL inference phase.

    In pure-RL mode, this is a no-op — the trained policy handles all actions.
    When enabled, the LLM assists with:
    - Shot trajectory selection for physics puzzles (Angry Birds)
    - Bird-type prioritization
    - High-level multi-step planning
    """

    def __init__(self, provider: str = "none"):
        self.provider = provider.lower()
        self._client   = None
        self._enabled  = False

        if self.provider == "gemini":
            self._init_gemini()
        elif self.provider == "openrouter":
            self._init_openrouter()
        else:
            logger.info("LLM Advisor: running in pure-RL mode (no LLM)")

    # ── Initialization ────────────────────────────────────────────────────

    def _init_gemini(self) -> None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logger.warning("LLM Advisor: GEMINI_API_KEY not set — falling back to pure-RL mode")
            return
        try:
            import google.generativeai as genai  # type: ignore
            genai.configure(api_key=api_key)
            self._client = genai.GenerativeModel("gemini-1.5-flash")
            self._enabled = True
            logger.info("LLM Advisor: Gemini Flash initialized")
        except ImportError:
            logger.warning("LLM Advisor: google-generativeai not installed. pip install google-generativeai")

    def _init_openrouter(self) -> None:
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            logger.warning("LLM Advisor: OPENROUTER_API_KEY not set — falling back to pure-RL mode")
            return
        try:
            from openai import OpenAI  # type: ignore
            self._client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=api_key,
            )
            self._or_model = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")
            self._enabled = True
            logger.info(f"LLM Advisor: OpenRouter initialized (model: {self._or_model})")
        except ImportError:
            logger.warning("LLM Advisor: openai package not installed. pip install openai")

    # ── Public API ────────────────────────────────────────────────────────

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    def advise_shot(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Given the current game state, ask the LLM to suggest the best shot.

        Returns:
            dict with keys: angle (float), power (float), bird_type (str)
            or None if LLM advisor is disabled / fails.
        """
        if not self._enabled:
            return None

        prompt = self._build_shot_prompt(game_state)

        try:
            if self.provider == "gemini":
                return self._call_gemini(prompt)
            elif self.provider == "openrouter":
                return self._call_openrouter(prompt)
        except Exception as e:
            logger.warning(f"LLM Advisor: advice call failed — {e}")

        return None

    def advise_strategy(
        self,
        episode: int,
        recent_rewards: List[float],
        current_best: float,
        target: float,
    ) -> Optional[str]:
        """
        High-level strategic advice based on recent performance trends.

        Returns:
            A short strategic suggestion string, or None.
        """
        if not self._enabled:
            return None

        avg = sum(recent_rewards) / len(recent_rewards) if recent_rewards else 0.0
        prompt = (
            f"You are advising an RL agent playing Angry Birds.\n"
            f"Episode: {episode} | Avg recent reward: {avg:.1f} | "
            f"Best score: {current_best:.1f} | Target: {target:.1f}\n"
            f"Give a ONE-sentence strategic suggestion to improve performance."
        )

        try:
            if self.provider == "gemini":
                resp = self._client.generate_content(prompt)  # type: ignore
                return resp.text.strip()
            elif self.provider == "openrouter":
                resp = self._client.chat.completions.create(  # type: ignore
                    model=self._or_model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=60,
                )
                return resp.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"LLM Advisor: strategy call failed — {e}")

        return None

    # ── Private helpers ───────────────────────────────────────────────────

    def _build_shot_prompt(self, state: Dict[str, Any]) -> str:
        pigs = state.get("pigs", [])
        birds = state.get("birds_remaining", [])
        structures = state.get("structures", [])

        return (
            f"You are advising an Angry Birds agent.\n"
            f"Current state:\n"
            f"  Pigs remaining: {json.dumps(pigs)}\n"
            f"  Birds available: {birds}\n"
            f"  Structures: {json.dumps(structures[:3])}\n"
            f"Suggest the optimal shot as JSON: "
            f'{{ "angle": <degrees 0-90>, "power": <0-1.0>, "bird_type": "<red|blue|yellow|black>" }}\n'
            f"Reply with JSON only, no explanation."
        )

    def _call_gemini(self, prompt: str) -> Optional[Dict[str, Any]]:
        resp = self._client.generate_content(prompt)  # type: ignore
        text = resp.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1].strip()
            if text.startswith("json"):
                text = text[4:].strip()
        return json.loads(text)

    def _call_openrouter(self, prompt: str) -> Optional[Dict[str, Any]]:
        resp = self._client.chat.completions.create(  # type: ignore
            model=self._or_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)


# ── Singleton factory ──────────────────────────────────────────────────────

def get_advisor(provider: Optional[str] = None) -> LLMAdvisor:
    """
    Return an LLMAdvisor instance for the given provider.
    Falls back to env var LLM_PROVIDER, then 'none'.
    """
    p = provider or os.environ.get("LLM_PROVIDER", "none")
    return LLMAdvisor(provider=p)
