"""
Tests for RL Trainer and Environments.
"""
import pytest
import sys
import os
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.rl.trainer import RLTrainer, MetricsCallback
from backend.rl.environments import FlappyBirdEnv, make_flappy_bird


class TestRLTrainer:
    """Tests for the RL Trainer."""

    def setup_method(self):
        self.trainer = RLTrainer()

    def test_create_model(self):
        """Test model creation."""
        import gymnasium as gym
        env = gym.make("CartPole-v1")

        success, msg = self.trainer.create_model(env, "PPO")
        assert success
        assert self.trainer.model is not None

    def test_train_short(self):
        """Test short training run."""
        import gymnasium as gym
        env = gym.make("CartPole-v1")

        self.trainer.create_model(env, "PPO")
        metrics = self.trainer.train(total_timesteps=1000)

        assert 'episode_rewards' in metrics
        assert len(metrics['timesteps']) > 0

    def test_evaluate(self):
        """Test model evaluation."""
        import gymnasium as gym
        env = gym.make("CartPole-v1")

        self.trainer.create_model(env, "PPO")
        self.trainer.train(total_timesteps=5000)

        results = self.trainer.evaluate(n_episodes=5)
        assert 'mean_reward' in results
        assert 'success_rate' in results

    def test_save_and_load(self):
        """Test model persistence."""
        import gymnasium as gym
        env = gym.make("CartPole-v1")

        self.trainer.create_model(env, "PPO")
        self.trainer.train(total_timesteps=1000)

        path = self.trainer.save_model("test_model")
        assert os.path.exists(path)

        # Load into new trainer
        new_trainer = RLTrainer()
        success = new_trainer.load_model(path)
        assert success
        assert new_trainer.model is not None

    def test_invalid_algorithm(self):
        """Test invalid algorithm handling."""
        import gymnasium as gym
        env = gym.make("CartPole-v1")

        success, msg = self.trainer.create_model(env, "INVALID_ALGO")
        assert not success
        assert "Unsupported" in msg


class TestFlappyBirdEnv:
    """Tests for Flappy Bird environment."""

    def test_env_creation(self):
        """Test environment initialization."""
        env = FlappyBirdEnv()
        assert env.action_space.n == 2
        assert env.observation_space.shape == (4,)

    def test_env_step(self):
        """Test environment stepping."""
        env = FlappyBirdEnv()
        obs, _ = env.reset()

        assert obs is not None
        assert len(obs) == 4

        # Take a step
        obs, reward, done, _, info = env.step(0)
        assert isinstance(reward, float)
        assert isinstance(done, bool)

    def test_env_multiple_episodes(self):
        """Test multiple episode runs."""
        env = FlappyBirdEnv()

        for episode in range(3):
            obs, _ = env.reset()
            steps = 0
            done = False

            while not done and steps < 100:
                obs, reward, done, _, info = env.step(env.action_space.sample())
                steps += 1

            assert steps > 0

    def test_make_function(self):
        """Test factory function."""
        env = make_flappy_bird()
        assert isinstance(env, FlappyBirdEnv)


class TestMetricsCallback:
    """Tests for training callback."""

    def test_callback_records_metrics(self):
        """Test that callback records training metrics."""
        from stable_baselines3.common.env_checker import check_env
        import gymnasium as gym
        from types import SimpleNamespace

        env = gym.make("CartPole-v1")
        callback = MetricsCallback()
        callback.model = SimpleNamespace(ep_info_buffer=[{'r': 1.0, 'l': 10}], num_timesteps=10)
        callback.num_timesteps = 10

        # Simulate some steps
        for i in range(10):
            callback.update_locals({'total_timesteps': 100})
            callback.on_step()

        assert len(callback.metrics['timesteps']) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
