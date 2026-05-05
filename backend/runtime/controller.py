"""
Runtime Controller: Manages gameplay execution, monitoring, and goal checking.
Implements the evaluation loop and autonomous retry logic.
"""
import time
import numpy as np
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
import logging

from backend.rl.trainer import RLTrainer
from backend.agents.planner import TrainingPlan


class ControllerState(Enum):
    """Runtime controller states."""
    IDLE = "idle"
    RUNNING = "running"
    EVALUATING = "evaluating"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"


@dataclass
class EpisodeResult:
    """Results from a single episode."""
    episode_number: int
    total_reward: float
    score: float
    length: int
    success: bool
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvaluationResult:
    """Aggregated evaluation results."""
    episodes: List[EpisodeResult]
    mean_reward: float
    std_reward: float
    mean_score: float
    success_rate: float
    total_episodes: int
    goal_achieved: bool
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ControllerConfig:
    """Configuration for runtime controller."""
    max_episodes: int = 100            # Hard cap — never run more than this
    max_steps_per_episode: int = 1000  # Steps per episode (reduced for speed)
    success_threshold: float = 0.8     # 80% success rate to declare goal met
    consecutive_successes_required: int = 5   # Reduced from 10 for faster detection
    eval_frequency: int = 10           # Evaluate every N episodes
    retry_limit: int = 2               # Max retries
    early_stopping_patience: int = 5   # Evaluations with no improvement before stopping
    render_during_eval: bool = False   # Don't render during eval (headless)
    render_during_training: bool = False


class RuntimeController:
    """
    Main controller for runtime gameplay and goal monitoring.
    Manages evaluation loops, success detection, and retry logic.
    """

    def __init__(self,
                 trainer: RLTrainer,
                 config: Optional[ControllerConfig] = None,
                 memory_system=None):
        self.trainer = trainer
        self.config = config or ControllerConfig()
        self.memory = memory_system
        self.logger = logging.getLogger(__name__)

        # State tracking
        self.state = ControllerState.IDLE
        self.episode_history: List[EpisodeResult] = []
        self.evaluation_history: List[EvaluationResult] = []
        self.consecutive_successes = 0
        self.retry_count = 0
        self.total_episodes_played = 0
        self.start_time = None

        # Goal monitoring
        self.current_plan: Optional[TrainingPlan] = None
        self.goal_achieved = False

    def set_plan(self, plan: TrainingPlan):
        """Set the current training/evaluation plan."""
        self.current_plan = plan
        self.goal_achieved = False
        self.consecutive_successes = 0
        self.retry_count = 0
        self.episode_history.clear()
        self.logger.info(f"Set new plan: {plan.goal} for {plan.game_type.value}")

    def play_episode(self,
                     render: bool = False,
                     deterministic: bool = True) -> EpisodeResult:
        """
        Play a single episode.

        Args:
            render: Whether to render the episode
            deterministic: Use deterministic actions

        Returns:
            EpisodeResult with episode statistics
        """
        if self.trainer.model is None:
            raise ValueError("No trained model available")

        env = self.trainer.env
        obs, _ = env.reset()
        total_reward = 0.0
        score = 0.0
        steps = 0
        done = False

        while not done and steps < self.config.max_steps_per_episode:
            action, _states = self.trainer.predict(obs, deterministic=deterministic)
            obs, reward, done, _, info = env.step(action)
            total_reward += reward
            score = info.get('score', score)
            steps += 1

            if render:
                env.render()
                time.sleep(0.01)  # Small delay for visualization

        episode = EpisodeResult(
            episode_number=self.total_episodes_played + 1,
            total_reward=total_reward,
            score=score,
            length=steps,
            success=self._check_episode_success(score, plan=self.current_plan)
        )

        self.episode_history.append(episode)
        self.total_episodes_played += 1

        return episode

    def evaluate(self,
                 n_episodes: int = 100,
                 render: bool = False) -> EvaluationResult:
        """
        Evaluate model performance over multiple episodes.

        Args:
            n_episodes: Number of evaluation episodes
            render: Whether to render during evaluation

        Returns:
            EvaluationResult with aggregated statistics
        """
        self.logger.info(f"Evaluating over {n_episodes} episodes...")
        self.state = ControllerState.EVALUATING

        episodes = []
        for i in range(n_episodes):
            render_flag = render and (i % 10 == 0)  # Render every 10th episode
            episode = self.play_episode(render=render_flag, deterministic=True)
            episodes.append(episode)

            if (i + 1) % 10 == 0:
                self.logger.info(f"Completed {i+1}/{n_episodes} evaluation episodes")

        rewards = [e.total_reward for e in episodes]
        scores = [e.score for e in episodes]
        successes = [e.success for e in episodes]

        result = EvaluationResult(
            episodes=episodes,
            mean_reward=float(np.mean(rewards)),
            std_reward=float(np.std(rewards)),
            mean_score=float(np.mean(scores)),
            success_rate=float(np.mean(successes)),
            total_episodes=n_episodes,
            goal_achieved=self._check_goal_achieved(episodes)
        )

        self.evaluation_history.append(result)
        self.state = ControllerState.RUNNING

        # Store in memory
        if self.memory:
            self.memory.store_evaluation(result)

        return result

    def _check_episode_success(self,
                              score: float,
                              plan: Optional[TrainingPlan]) -> bool:
        """Check if a single episode meets the success criteria."""
        if plan is None:
            return score > 0

        goal = plan.goal
        target = plan.target_value

        if goal in ['maximize_score', 'target_score']:
            return score >= target
        elif goal == 'balance':
            # For CartPole, episode length indicates success
            return score >= target  # Using episode length as score proxy
        elif goal == 'survive':
            return score >= target
        else:
            return score >= target

    def _check_goal_achieved(self, episodes: List[EpisodeResult]) -> bool:
        """Check if overall goal is achieved based on recent episodes."""
        if len(episodes) < self.config.consecutive_successes_required:
            return False

        recent_successes = [e.success for e in episodes[-self.config.consecutive_successes_required:]]
        success_rate = np.mean(recent_successes)

        return success_rate >= self.config.success_threshold

    def run_until_goal(
        self,
        plan: TrainingPlan,
        max_retries: int = 2,
    ) -> Tuple[bool, Dict]:
        """
        Evaluate the trained policy until the goal is met or resources exhausted.

        Termination conditions (whichever comes first):
        1. Goal achieved (success_rate >= threshold over consecutive episodes)
        2. total_episodes >= config.max_episodes  (hard cap)
        3. retry_count > max_retries after early-stopping
        """
        self.set_plan(plan)
        self.state = ControllerState.RUNNING
        self.start_time = time.time()

        self.logger.info(f"Starting goal-driven gameplay: {plan.goal}")
        self.logger.info(f"Target: {plan.target_value}, Algorithm: {plan.algorithm.value}")

        while (
            self.total_episodes_played < self.config.max_episodes
            and self.retry_count <= max_retries
        ):
            remaining = self.config.max_episodes - self.total_episodes_played
            n_eval = min(self.config.eval_frequency, remaining)

            eval_result = self.evaluate(
                n_episodes=n_eval,
                render=self.config.render_during_eval,
            )

            # ── Goal achieved ────────────────────────────────────────────
            if eval_result.goal_achieved:
                self.state = ControllerState.SUCCESS
                self.goal_achieved = True
                elapsed_time = time.time() - self.start_time

                self.logger.info(
                    f"Goal achieved! success_rate={eval_result.success_rate:.2f} "
                    f"after {self.total_episodes_played} episodes"
                )
                return True, {
                    'success': True,
                    'episodes': self.total_episodes_played,
                    'final_score': eval_result.mean_score,
                    'mean_reward': eval_result.mean_reward,
                    'success_rate': eval_result.success_rate,
                    'time_elapsed': elapsed_time,
                    'retries': self.retry_count,
                }

            # ── Hard episode cap reached ─────────────────────────────────
            if self.total_episodes_played >= self.config.max_episodes:
                self.logger.info(
                    f"Episode cap reached ({self.config.max_episodes}), stopping."
                )
                break

            # ── Early stopping ───────────────────────────────────────────
            if self._should_early_stop():
                self.logger.warning("Early stopping triggered — no improvement detected")
                self.retry_count += 1
                if self.retry_count > max_retries:
                    break
                self.logger.info(
                    f"Retry {self.retry_count}/{max_retries} — continuing evaluation"
                )

        # ── Failed ──────────────────────────────────────────────────────
        self.state = ControllerState.FAILED
        elapsed_time = time.time() - self.start_time
        best = max((e.score for e in self.episode_history), default=0.0)

        self.logger.warning(
            f"Goal not achieved after {self.total_episodes_played} episodes, "
            f"best score: {best:.2f}"
        )

        return False, {
            'success': False,
            'episodes': self.total_episodes_played,
            'best_score': best,
            'mean_reward': float(np.mean([e.total_reward for e in self.episode_history])) if self.episode_history else 0.0,
            'time_elapsed': elapsed_time,
            'retries': self.retry_count,
        }

    def _should_early_stop(self) -> bool:
        """Trigger early stopping if no score improvement over last N evaluations."""
        if len(self.evaluation_history) < self.config.early_stopping_patience:
            return False

        recent = self.evaluation_history[-self.config.early_stopping_patience:]
        scores = [e.mean_score for e in recent]

        # Stop if the max score hasn't improved across the window
        return max(scores[:-1], default=0) >= scores[-1]

    def get_progress_stats(self) -> Dict[str, Any]:
        """Get current progress statistics."""
        if not self.episode_history:
            return {'status': 'no_episodes'}

        recent_episodes = self.episode_history[-100:]
        return {
            'total_episodes': self.total_episodes_played,
            'mean_recent_score': float(np.mean([e.score for e in recent_episodes])),
            'best_score': float(max(e.score for e in self.episode_history)),
            'success_rate': float(np.mean([e.success for e in recent_episodes])),
            'consecutive_successes': self.consecutive_successes,
            'retry_count': self.retry_count,
            'state': self.state.value
        }

    def reset(self):
        """Reset controller state."""
        self.episode_history.clear()
        self.evaluation_history.clear()
        self.consecutive_successes = 0
        self.retry_count = 0
        self.total_episodes_played = 0
        self.state = ControllerState.IDLE
        self.goal_achieved = False

    def save_history(self, filepath: str):
        """Save episode and evaluation history."""
        import json
        from dataclasses import asdict

        data = {
            'episodes': [asdict(e) for e in self.episode_history],
            'evaluations': [asdict(e) for e in self.evaluation_history],
            'config': asdict(self.config),
            'total_episodes': self.total_episodes_played
        }

        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
