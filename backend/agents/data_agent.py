"""
Data Agent: Collects and qualifies trajectories for iterative training improvement.
Lightweight implementation — no broken dependencies.
"""
from typing import List, Dict, Any
from dataclasses import dataclass, field
import numpy as np
import logging

logger = logging.getLogger(__name__)


@dataclass
class Trajectory:
    """Single transition in an episode."""
    obs: np.ndarray
    action: np.ndarray
    reward: float
    next_obs: np.ndarray
    done: bool
    info: Dict[str, Any] = field(default_factory=dict)


class DataAgent:
    """Collects, filters, and scores trajectory data from gameplay episodes."""

    def __init__(self, max_buffer_size: int = 10000):
        self.trajectories: List[Trajectory] = []
        self.max_buffer_size = max_buffer_size

    def collect_from_episodes(self, episode_results: List[Dict]) -> List[Trajectory]:
        """
        Collect trajectories from controller episode results.

        Args:
            episode_results: List of dicts with keys:
                observations, actions, rewards, dones, infos
        """
        collected = []
        for episode in episode_results:
            obs_list = episode.get('observations', [])
            actions = episode.get('actions', [])
            rewards = episode.get('rewards', [])
            dones = episode.get('dones', [])
            infos = episode.get('infos', [{}] * len(rewards))

            for t in range(len(rewards)):
                next_obs = obs_list[t + 1] if t + 1 < len(obs_list) else obs_list[t]
                traj = Trajectory(
                    obs=np.asarray(obs_list[t]),
                    action=np.asarray(actions[t]),
                    reward=float(rewards[t]),
                    next_obs=np.asarray(next_obs),
                    done=bool(dones[t]),
                    info=infos[t] if t < len(infos) else {},
                )
                collected.append(traj)

        # Add to buffer (FIFO eviction)
        self.trajectories.extend(collected)
        if len(self.trajectories) > self.max_buffer_size:
            self.trajectories = self.trajectories[-self.max_buffer_size:]

        logger.info(f"Collected {len(collected)} transitions, buffer: {len(self.trajectories)}")
        return collected

    def qualify_data(
        self,
        trajectories: List[Trajectory],
        min_reward_ratio: float = 0.8,
    ) -> List[Trajectory]:
        """
        Filter trajectories keeping only high-quality samples.

        Args:
            trajectories: Raw trajectories
            min_reward_ratio: Keep top N% by reward (0.8 = top 80%)
        """
        if not trajectories:
            return []

        rewards = [t.reward for t in trajectories]
        threshold = np.percentile(rewards, (1 - min_reward_ratio) * 100)

        qualified = [t for t in trajectories if t.reward >= threshold]
        logger.info(f"Qualified {len(qualified)}/{len(trajectories)} trajectories (threshold={threshold:.2f})")
        return qualified

    def get_statistics(self) -> Dict[str, Any]:
        """Return summary statistics of the trajectory buffer."""
        if not self.trajectories:
            return {'buffer_size': 0}

        rewards = [t.reward for t in self.trajectories]
        return {
            'buffer_size': len(self.trajectories),
            'mean_reward': float(np.mean(rewards)),
            'std_reward': float(np.std(rewards)),
            'min_reward': float(np.min(rewards)),
            'max_reward': float(np.max(rewards)),
        }


# Module-level singleton
data_agent = DataAgent()
