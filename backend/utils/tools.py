"""
Claude Code Tool Definitions: Exposes system functionality as tools.
Each function conforms to the Claude Code tool-calling standard.
"""
from typing import Dict, Any, Optional, List, TypedDict
from dataclasses import asdict
import json
import logging

from backend.agents.planner import PlannerAgent, TrainingPlan, GameType, Algorithm
from backend.agents.reward_generator import RewardGenerator
from backend.rl.trainer import RLTrainer
from backend.runtime.controller import RuntimeController, ControllerConfig

logger = logging.getLogger(__name__)


# Tool schema definitions
TOOL_SCHEMAS = [
    {
        "name": "parse_goal",
        "description": "Parse natural language goal into structured training plan",
        "input_schema": {
            "type": "object",
            "properties": {
                "user_input": {
                    "type": "string",
                    "description": "Natural language description of the RL goal"
                }
            },
            "required": ["user_input"]
        }
    },
    {
        "name": "train_rl_agent",
        "description": "Train an RL agent with specified parameters",
        "input_schema": {
            "type": "object",
            "properties": {
                "environment": {
                    "type": "string",
                    "enum": ["CartPole-v1", "FlappyBird-v0", "AngryBird-v0", "Pong-v0", "Breakout-v0"],
                    "description": "Gymnasium environment to train on"
                },
                "algorithm": {
                    "type": "string",
                    "enum": ["PPO", "A2C", "DQN"],
                    "description": "RL algorithm to use"
                },
                "total_timesteps": {
                    "type": "integer",
                    "description": "Total training timesteps"
                },
                "target_score": {
                    "type": "number",
                    "description": "Target score to achieve"
                },
                "level": {
                    "type": "string",
                    "description": "Level name for Angry Birds (basic, medium, advanced)"
                },
                "hyperparameters": {
                    "type": "object",
                    "description": "Algorithm-specific hyperparameters",
                    "additionalProperties": {"type": "number"}
                }
            },
            "required": ["environment", "algorithm"]
        }
    },
    {
        """Compatibility wrapper for tool registry."""
        from backend.registry.tools import TOOL_SCHEMAS, ToolRegistry, tool_registry

        __all__ = [
            "TOOL_SCHEMAS",
            "ToolRegistry",
            "tool_registry",
        ]
                },
