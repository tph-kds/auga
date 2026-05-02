"""
Tests for the Agent modules (Planner, Reward Generator).
"""
import pytest
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.agents.planner import PlannerAgent, TrainingPlan, GameType, Algorithm
from backend.agents.reward_generator import RewardGenerator


class TestPlannerAgent:
    """Tests for the Planner Agent."""

    def setup_method(self):
        self.planner = PlannerAgent()

    def test_parse_cartpole_goal(self):
        """Test parsing CartPole-related goals."""
        plan = self.planner.parse_goal("Train an agent to balance the pole")

        assert plan.game_type == GameType.CARTPOLE
        assert plan.algorithm == Algorithm.PPO  # default
        assert plan.goal == "balance"
        assert plan.target_value > 0

    def test_parse_flappy_bird_goal(self):
        """Test parsing Flappy Bird goals."""
        plan = self.planner.parse_goal("Make the flappy bird fly through pipes")

        assert plan.game_type == GameType.FLAPPY_BIRD
        assert "flap" in plan.goal or "score" in plan.goal.lower()

    def test_parse_with_algorithm_specification(self):
        """Test parsing algorithm preference."""
        plan = self.planner.parse_goal("Train with DQN on CartPole")

        assert plan.algorithm == Algorithm.DQN

    def test_parse_with_target_score(self):
        """Test parsing specific target scores."""
        plan = self.planner.parse_goal("Achieve score of 500 in Flappy Bird")

        assert plan.target_value == 500.0

    def test_default_hyperparameters(self):
        """Test that hyperparameters are populated."""
        plan = self.planner.parse_goal("Balance the pole")

        assert plan.hyperparameters is not None
        assert 'learning_rate' in plan.hyperparameters

    def test_plan_to_dict(self):
        """Test serialization to dictionary."""
        plan = self.planner.parse_goal("Maximize score in CartPole")
        plan_dict = plan.to_dict()

        assert 'goal' in plan_dict
        assert 'game_type' in plan_dict
        assert plan_dict['game_type'] == 'CartPole-v1'

    def test_invalid_input(self):
        """Test handling of empty input."""
        with pytest.raises(ValueError):
            self.planner.parse_goal("")


class TestRewardGenerator:
    """Tests for the Reward Generator."""

    def setup_method(self):
        self.reward_gen = RewardGenerator()
        self.planner = PlannerAgent()

    def test_generate_cartpole_reward(self):
        """Test reward function generation for CartPole."""
        plan = self.planner.parse_goal("Balance the pole")
        reward_fn = self.reward_gen.generate_reward_fn(plan)

        assert reward_fn is not None
        assert callable(reward_fn)

        # Test with dummy data
        import numpy as np
        state = np.array([0.1, 0.0, 0.0, 0.0])
        reward = reward_fn(state, 0, state, False, {})
        assert isinstance(reward, float)

    def test_generate_flappy_bird_reward(self):
        """Test reward function generation for Flappy Bird."""
        plan = self.planner.parse_goal("Maximize score in Flappy Bird")
        reward_fn = self.reward_gen.generate_reward_fn(plan)

        assert reward_fn is not None
        assert callable(reward_fn)

    def test_milestone_rewards(self):
        """Test milestone reward generation."""
        plan = self.planner.parse_goal("Achieve score of 100")
        milestones = self.reward_gen.create_milestone_rewards(plan)

        assert 25.0 in milestones  # 25% of 100
        assert 50.0 in milestones  # 50% of 100
        assert 75.0 in milestones  # 75% of 100
        assert 100.0 in milestones  # 100%

    def test_reward_evaluation(self):
        """Test reward effectiveness evaluation."""
        history = [1.0] * 50 + [10.0] * 50
        metrics = self.reward_gen.evaluate_reward_success(history, 10.0)

        assert 'effectiveness' in metrics
        assert 'variance' in metrics
        assert 'trend' in metrics


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
