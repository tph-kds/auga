"""
Reward Generator: Creates custom reward functions based on training plans.
Implements domain-specific reward shaping for various games.
"""
import numpy as np
import math
from typing import Callable, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import math

from backend.agents.planner import TrainingPlan, GameType


class RewardComponent(Enum):
    """Reward component types for modular reward design."""
    SURVIVAL = "survival"
    PROGRESS = "progress"
    ACHIEVEMENT = "achievement"
    PENALTY = "penalty"
    SHAPING = "shaping"


@dataclass
class RewardConfig:
    """Configuration for reward function generation."""
    survival_bonus: float = 0.1
    death_penalty: float = -10.0
    goal_reward: float = 100.0
    progress_weight: float = 1.0
    shaping_weight: float = 0.5
    distance_weight: float = 0.2
    velocity_penalty: float = -0.01


class RewardGenerator:
    """
    Generates tailored reward functions for different environments
    and training goals using modular components.
    """

    def __init__(self, memory_system=None):
        self.memory = memory_system
        self.reward_history = []
        self.config = RewardConfig()

    def generate_reward_fn(self,
                          plan: TrainingPlan,
                          env_info: Optional[Dict] = None) -> Callable:
        """
        Generate a reward function based on the training plan.

        Args:
            plan: TrainingPlan with goal specifications
            env_info: Additional environment information

        Returns:
            Reward function (state, action, next_state, info) -> float
        """
        game_type = plan.game_type
        goal_type = plan.goal
        target = plan.target_value

        # Select reward strategy based on game and goal
        if game_type == GameType.CARTPOLE:
            return self._cartpole_reward(plan)
        elif game_type == GameType.FLAPPY_BIRD:
            return self._flappy_bird_reward(plan)
        elif game_type == GameType.ANGRY_BIRDS:
            return self._angry_birds_reward(plan)
        else:
            return self._generic_reward(plan)

    def _cartpole_reward(self, plan: TrainingPlan) -> Callable:
        """Generate reward function for CartPole."""
        target = plan.target_value

        def reward_fn(state, action, next_state, done, info):
            reward = 0.0

            # Base survival reward (given by environment already)
            # Add shaping based on pole angle and cart position
            x, x_dot, theta, theta_dot = state

            # Keep pole upright (angle near 0)
            angle_reward = (1.0 - abs(theta / 0.2)) ** 2  # Normalize to max angle ~0.2 rad
            reward += angle_reward * self.config.shaping_weight

            # Keep cart centered
            position_reward = (1.0 - min(abs(x) / 2.4, 1.0))
            reward += position_reward * self.config.distance_weight

            # Penalize high velocity (unstable)
            velocity_penalty = (abs(theta_dot) + abs(x_dot)) * self.config.velocity_penalty
            reward += velocity_penalty

            # Bonus for staying alive (each timestep)
            reward += self.config.survival_bonus

            # Large bonus for reaching target (handled by environment termination)
            if done and abs(x) < 2.4 and abs(theta) < 0.2:
                reward += self.config.goal_reward

            # Death penalty (large negative)
            if done and (abs(x) >= 2.4 or abs(theta) >= 0.2):
                reward += self.config.death_penalty

            return reward

        return reward_fn

    def _flappy_bird_reward(self, plan: TrainingPlan) -> Callable:
        """Generate reward function for Flappy Bird."""
        target = plan.target_value

        def reward_fn(state, action, next_state, done, info):
            reward = 0.0

            # Extract bird metrics from state/observation
            bird_y, bird_vel, pipe_x, pipe_gap = state

            # Survival bonus
            reward += self.config.survival_bonus

            # Gap alignment reward - encourage being in the middle of pipe gap
            if pipe_x < 100:  # Bird near pipe
                gap_center = pipe_gap / 2.0
                distance_from_center = abs(bird_y - gap_center)
                max_distance = 240.0
                alignment_reward = (1.0 - min(distance_from_center / max_distance, 1.0))
                reward += alignment_reward * self.config.shaping_weight

            # Velocity shaping - encourage upward velocity when low, neutral when high
            if bird_y < 200:
                velocity_reward = max(0, -bird_vel * 0.1)  # Upward velocity is good
                reward += velocity_reward * self.config.shaping_weight

            # Passing pipe bonus
            score = info.get('score', 0)
            reward += score * 10.0  # Direct score reward

            # Death penalty
            if done:
                reward += self.config.death_penalty

            return reward

        return reward_fn

    def _angry_birds_reward(self, plan: TrainingPlan) -> Callable:
        """Generate reward function for Angry Birds."""
        target = plan.target_value

        def reward_fn(state, action, next_state, done, info):
            reward = 0.0

            # Extract state info
            # state: [bird_pos_x, bird_pos_y, bird_vx, bird_vy, slingshot_x, slingshot_y, bird_type, birds_remaining]
            bird_x, bird_y, bird_vx, bird_vy, slingshot_x, slingshot_y, bird_type, birds_remaining = state

            # Goal-specific rewards
            goal = plan.goal

            if goal == 'destroy_pigs':
                # Reward for each pig killed (given by info)
                pigs_killed = info.get('pigs_killed', 0)
                reward += pigs_killed * 50.0  # Pig kill bonus

                # Additional reward for clearing all pigs
                pigs_remaining = info.get('pigs_remaining', 0)
                if pigs_remaining == 0:
                    reward += 100.0  # Level clear bonus

            elif goal == 'maximize_score':
                # Direct score reward
                score = info.get('score', 0)
                reward += score * 0.1

                # Bonus for high score
                if score >= target:
                    reward += 100.0

            elif goal == 'minimize_birds':
                # Simple: reward based on birds remaining (more remaining = better)
                birds_remaining = info.get('birds_remaining', 0)
                reward += birds_remaining * 15.0  # Bonus for each bird left

            elif goal == 'precision':
                # Reward for accurate targeting (close to target center)
                target_x = info.get('target_x', 0)
                target_y = info.get('target_y', 0)
                if target_x > 0 and target_y > 0:
                    distance = math.sqrt((bird_x - target_x)**2 + (bird_y - target_y)**2)
                    accuracy = max(0, 1.0 - distance / 200.0)
                    reward += accuracy * 25.0

            # Structural damage reward
            total_damage = info.get('total_damage', 0)
            reward += total_damage * 0.01

            # No step tracking in closure - encourage efficiency through other means
            # Bird type bonuses
            if bird_type < 0.3:  # Red (basic)
                pass  # no bonus
            elif bird_type < 0.5:  # Yellow
                reward += 2.0  # Small bonus for using more powerful birds
            elif bird_type < 0.7:  # Blue
                reward += 5.0
            else:  # Black
                reward += 10.0

            # No step penalty here - handled by environment

            return reward

        return reward_fn

    def _generic_reward(self, plan: TrainingPlan) -> Callable:
        """Generic reward function for unknown environments."""
        def reward_fn(state, action, next_state, done, info):
            reward = 0.0

            # Basic survival reward
            if not done:
                reward += self.config.survival_bonus
            else:
                reward += self.config.death_penalty

            # Extract score if available
            if 'score' in info:
                reward += info['score'] * 1.0

            return reward

        return reward_fn

    def create_milestone_rewards(self, plan: TrainingPlan) -> Dict[float, float]:
        """
        Create milestone rewards for curriculum learning.
        Returns dict mapping milestone thresholds to bonus rewards.
        """
        target = plan.target_value
        milestones = {}

        # Create progressive milestones
        milestones[target * 0.25] = target * 0.1
        milestones[target * 0.5] = target * 0.25
        milestones[target * 0.75] = target * 0.5
        milestones[target] = target * 1.0

        return milestones

    def progressive_curriculum(self,
                              current_performance: float,
                              target: float) -> Tuple[bool, Optional[Dict]]:
        """
        Determine if curriculum should advance and provide next stage config.

        Args:
            current_performance: Current average performance
            target: Final target value

        Returns:
            (should_advance, next_stage_config)
        """
        milestones = [0.25, 0.5, 0.75, 1.0]
        current_ratio = current_performance / target if target > 0 else 0

        # Find next milestone
        next_milestone = None
        for milestone in milestones:
            if current_ratio < milestone:
                next_milestone = milestone * target
                break

        if next_milestone is not None:
            # Adjust difficulty
            new_target = next_milestone
            next_config = {
                'target_value': new_target,
                'total_timesteps_factor': 1.0 + (current_ratio * 0.5)
            }
            return False, next_config

        return True, None  # Completed curriculum

    def adapt_reward_weights(self,
                            recent_performance: float,
                            target: float) -> RewardConfig:
        """
        Dynamically adapt reward weights based on learning progress.
        """
        ratio = recent_performance / target if target > 0 else 0

        config = RewardConfig()

        if ratio < 0.3:
            # Early training: emphasize survival and shaping
            config.survival_bonus = 1.0
            config.shaping_weight = 1.0
            config.progress_weight = 0.5
        elif ratio < 0.7:
            # Mid training: balance shaping and progress
            config.survival_bonus = 0.5
            config.shaping_weight = 0.7
            config.progress_weight = 0.8
        else:
            # Late training: emphasize goal progress
            config.survival_bonus = 0.1
            config.shaping_weight = 0.3
            config.progress_weight = 1.0

        return config

    def evaluate_reward_success(self,
                              reward_history: list,
                              target: float) -> Dict[str, float]:
        """
        Evaluate effectiveness of current reward function.
        """
        if not reward_history:
            return {'effectiveness': 0.0, 'variance': 0.0, 'trend': 0.0}

        rewards = np.array(reward_history)

        return {
            'effectiveness': float(np.mean(rewards[-100:]) / target if target > 0 else 0),
            'variance': float(np.std(rewards[-100:])),
            'trend': float(np.mean(rewards[-10:]) - np.mean(rewards[:10])) if len(rewards) >= 10 else 0.0
        }

    def suggest_reward_improvements(self,
                                   plan: TrainingPlan,
                                   metrics: Dict[str, float]) -> Dict[str, Any]:
        """
        Suggest improvements to reward function based on metrics.
        """
        suggestions = {'changes': [], 'reason': []}

        if metrics.get('variance', 0) > 10.0:
            suggestions['changes'].append('reduce_shaping')
            suggestions['reason'].append('High variance indicates unstable learning')

        if metrics.get('trend', 0) < 0.5:
            suggestions['changes'].append('increase_goal_bonus')
            suggestions['reason'].append('Poor learning progress')

        if metrics.get('effectiveness', 0) < 0.5:
            suggestions['changes'].append('add_curriculum')
            suggestions['reason'].append('Low effectiveness suggests need for curriculum')

        return suggestions
