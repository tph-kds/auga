"""
Lightweight Environment Wrappers for Frame Skipping and Action Repeat.
Implements the strategies from GAME_RL_AGENTS.md.
"""
import gymnasium as gym

class FrameSkipWrapper(gym.Wrapper):
    """
    Action Repeat / Frame Skip Wrapper.
    Repeats the action `skip` times to reduce decision making frequency (e.g. 60 FPS to 15 FPS).
    Accumulates reward over the skipped frames.
    """
    def __init__(self, env: gym.Env, skip: int = 4):
        super().__init__(env)
        self._skip = skip

    def step(self, action):
        total_reward = 0.0
        done = False
        for _ in range(self._skip):
            obs, reward, terminated, truncated, info = self.env.step(action)
            total_reward += reward
            done = terminated or truncated
            if done:
                break
        return obs, total_reward, terminated, truncated, info
