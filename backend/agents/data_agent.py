"""
Data Agent: Collects, selects, qualifies trajectories for RLHF/fine-tuning.
"""
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
import numpy as np
from stable_baselines3.common.buffers import ReplayBuffer
from backend.services.memory import memory

@dataclass
class Trajectory:
    obs: np.ndarray
    action: np.ndarray
    reward: float
    next_obs: np.ndarray
    done: bool
    info: Dict[str, Any]

class DataAgent:
    def __init__(self):
        self.trajectories = []
        self.buffer = ReplayBuffer(10000)  # Low VRAM

    def collect_from_play(self, episode_results: List[Dict]) -> List[Trajectory]:
        """Collect trajectories from controller episodes."""
        trajectories = []
        for episode in episode_results:
            # Assume episode has obs_seq, action_seq, reward_seq from controller
            for t in range(len(episode['observations'])):
                traj = Trajectory(
                    obs=episode['observations'][t],
                    action=episode['actions'][t],
                    reward=episode['rewards'][t],
                    next_obs=episode['observations'][t+1] if t+1 < len(episode['observations']) else episode['observations'][t],
                    done=episode['dones'][t],
                    info=episode['infos'][t]
                )
                trajectories.append(traj)
                self.buffer.add(traj.obs, traj.next_obs, traj.reward, traj.done, traj.info)
        memory.save_data_trajectories(trajectories)  # Log to memory
        return trajectories

    def qualify_data(self, trajectories: List[Trajectory], target_score: float, llm_score: bool = True) -> List[Trajectory]:
        """Qualify/filter data: high reward traj + LLM RLHF."""
        qualified = []
        for traj in trajectories:
            score = traj.reward
            if llm_score:
                score += self._llm_rlhf_score(traj)
            if score >= target_score * 0.8:  # Top 80% quality
                qualified.append(traj)
        return qualified[:5000]  # Cap for VRAM

    def _llm_rlhf_score(self, traj: Trajectory) -> float:
        """Dummy LLM RLHF (replace with ollama)."""
        # Reward high progress trajectories
        return traj.reward * 0.1 + (1 if traj.info.get('progress', 0) > 0.5 else 0)

data_agent = DataAgent()

