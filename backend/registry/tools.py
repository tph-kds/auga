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
from backend.core.env_factory import build_env

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
        "name": "evaluate_model",
        "description": "Evaluate trained model performance",
        "input_schema": {
            "type": "object",
            "properties": {
                "model_path": {
                    "type": "string",
                    "description": "Path to saved model"
                },
                "environment": {
                    "type": "string",
                    "description": "Gymnasium environment name"
                },
                "n_episodes": {
                    "type": "integer",
                    "description": "Number of evaluation episodes"
                },
                "level": {
                    "type": "string",
                    "description": "Level name for Angry Birds (basic, medium, advanced)"
                }
            },
            "required": ["model_path", "environment"]
        }
    },
    {
        "name": "run_runtime",
        "description": "Run agent in environment until goal achieved",
        "input_schema": {
            "type": "object",
            "properties": {
                "model_path": {
                    "type": "string",
                    "description": "Path to saved model"
                },
                "environment": {
                    "type": "string",
                    "description": "Gymnasium environment name"
                },
                "target": {
                    "type": "number",
                    "description": "Target value to achieve"
                },
                "max_episodes": {
                    "type": "integer",
                    "description": "Maximum episodes to run"
                },
                "render": {
                    "type": "boolean",
                    "description": "Whether to render during execution"
                },
                "level": {
                    "type": "string",
                    "description": "Level name for Angry Birds (basic, medium, advanced)"
                }
            },
            "required": ["model_path", "environment", "target"]
        }
    },
    {
        "name": "generate_reward_function",
        "description": "Generate custom reward function for specific goals",
        "input_schema": {
            "type": "object",
            "properties": {
                "goal_type": {
                    "type": "string",
                    "description": "Type of goal (maximize_score, balance, survive, etc.)"
                },
                "environment": {
                    "type": "string",
                    "description": "Target environment"
                },
                "target_value": {
                    "type": "number",
                    "description": "Target value to achieve"
                }
            },
            "required": ["goal_type", "environment"]
        }
    },
    {
        "name": "get_status",
        "description": "Get current system status and progress",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "save_checkpoint",
        "description": "Save current training checkpoint",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to save checkpoint"
                }
            },
            "required": []
        }
    },
    {
        "name": "load_model",
        "description": "Load a saved model",
        "input_schema": {
            "type": "object",
            "properties": {
                "model_path": {
                    "type": "string",
                    "description": "Path to saved model file"
                }
            },
            "required": ["model_path"]
        }
    }
]


class ToolRegistry:
    """Registry for all available tools."""

    def __init__(self):
        self.tools = {}
        self._register_tools()

    def _register_tools(self):
        """Register all tool functions."""
        for schema in TOOL_SCHEMAS:
            name = schema['name']
            self.tools[name] = {
                'schema': schema,
                'function': getattr(self, f"_tool_{name}", None)
            }

    def get_schemas(self) -> List[Dict]:
        """Get all tool schemas for Claude Code."""
        return TOOL_SCHEMAS

    def execute(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool by name with given arguments."""
        if tool_name not in self.tools:
            return {
                'error': f"Unknown tool: {tool_name}",
                'available_tools': list(self.tools.keys())
            }

        tool = self.tools[tool_name]
        if tool['function'] is None:
            return {'error': f"Tool {tool_name} not implemented"}

        try:
            result = tool['function'](**arguments)
            return {'result': result}
        except Exception as e:
            logger.error(f"Tool execution failed {tool_name}: {e}")
            return {'error': str(e)}

    # Tool implementations
    def _tool_parse_goal(self, user_input: str) -> Dict[str, Any]:
        """Parse natural language goal."""
        planner = PlannerAgent()
        plan = planner.parse_goal(user_input)
        return asdict(plan)

    def _tool_train_rl_agent(self,
                            environment: str,
                            algorithm: str = "PPO",
                            total_timesteps: int = 100000,
                            target_score: float = 100.0,
                            level: str = "basic",
                            hyperparameters: Optional[Dict] = None) -> Dict[str, Any]:
        """Train RL agent."""
        trainer = RLTrainer()

        # Create environment
        env, env_factory = build_env(environment, level=level)

        # Validate
        valid, msg = trainer.validate_environment(env)
        if not valid:
            return {'error': msg}

        # Create model
        success, msg = trainer.create_model(
            env=env,
            algorithm=algorithm,
            config=hyperparameters,
            env_id=environment,
            env_factory=env_factory
        )

        if not success:
            return {'error': msg}

        # Train
        metrics = trainer.train(total_timesteps=total_timesteps)

        # Save
        model_path = trainer.save_model()

        return {
            'model_path': model_path,
            'metrics': metrics,
            'algorithm': algorithm,
            'environment': environment
        }

    def _tool_evaluate_model(self,
                           model_path: Optional[str] = None,
                           environment: Optional[str] = None,
                           n_episodes: int = 100,
                           level: str = "basic") -> Dict[str, Any]:
        """Evaluate model performance."""
        trainer = RLTrainer()

        if not model_path:
            return {'error': "model_path is required"}

        if not environment:
            return {'error': "environment is required"}

        if not trainer.load_model(model_path):
            return {'error': f"Failed to load model from {model_path}"}

        env, env_factory = build_env(environment, level=level)
        trainer.attach_env(env, env_id=environment, env_factory=env_factory)

        results = trainer.evaluate(n_episodes=n_episodes)
        return results

    def _tool_run_runtime(self,
                         model_path: str,
                         environment: str,
                         target: float,
                         max_episodes: int = 1000,
                         render: bool = False,
                         level: str = "basic") -> Dict[str, Any]:
        """Run runtime controller until goal achieved."""
        trainer = RLTrainer()
        controller = RuntimeController(trainer=trainer)

        if not trainer.load_model(model_path):
            return {'error': f"Failed to load model from {model_path}"}

        env, env_factory = build_env(environment, level=level)
        trainer.attach_env(env, env_id=environment, env_factory=env_factory)

        # Need a plan - create minimal one
        plan = TrainingPlan(
            goal="target_score",
            target_value=target,
            game_type=GameType(environment) if environment in [e.value for e in GameType] else GameType.CARTPOLE,
            algorithm=Algorithm.PPO,
            total_timesteps=10000,
            reward_strategy="default",
            success_criteria=f"Achieve score >= {target}",
            hyperparameters={}
        )

        controller.config.render_during_eval = render
        success, results = controller.run_until_goal(plan, max_retries=1)
        return {
            'success': success,
            'results': results
        }

    def _tool_generate_reward_function(self,
                                      goal_type: str,
                                      environment: str,
                                      target_value: float = 100.0) -> Dict[str, Any]:
        """Generate custom reward function."""
        reward_gen = RewardGenerator()

        # Determine game type
        game_type_map = {
            "CartPole-v1": GameType.CARTPOLE,
            "FlappyBird-v0": GameType.FLAPPY_BIRD,
            "AngryBird-v0": GameType.ANGRY_BIRDS
        }
        game_type = game_type_map.get(environment, GameType.CARTPOLE)

        plan = TrainingPlan(
            goal=goal_type,
            target_value=target_value,
            game_type=game_type,
            algorithm=Algorithm.PPO,
            total_timesteps=100000,
            reward_strategy="custom",
            success_criteria="custom"
        )

        reward_fn = reward_gen.generate_reward_fn(plan)

        return {
            'reward_function': 'generated',
            'description': f"Custom reward for {goal_type} in {environment}",
            'config': asdict(reward_gen.config)
        }

    def _tool_get_status(self) -> Dict[str, Any]:
        """Get system status."""
        return {
            'status': 'operational',
            'tools_available': list(self.tools.keys())
        }

    def _tool_save_checkpoint(self, path: Optional[str] = None) -> Dict[str, Any]:
        """Save checkpoint."""
        import os
        from datetime import datetime

        save_dir = path or "data/checkpoints"
        os.makedirs(save_dir, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        checkpoint_file = os.path.join(save_dir, f"checkpoint_{timestamp}.json")

        checkpoint_data = {
            'timestamp': timestamp,
            'status': 'placeholder'
        }

        with open(checkpoint_file, 'w') as f:
            json.dump(checkpoint_data, f)

        return {'checkpoint_path': checkpoint_file}

    def _tool_load_model(self, model_path: str) -> Dict[str, Any]:
        """Load saved model."""
        trainer = RLTrainer()
        success = trainer.load_model(model_path)

        if success:
            return {
                'loaded': True,
                'model_path': model_path,
                'algorithm': trainer.config.get('algorithm', 'unknown')
            }
        else:
            return {'error': f"Failed to load model from {model_path}"}

    def _tool_data_collect(self, model_path: str, env: str, episodes: int = 10, level: str = 'basic') -> Dict:
        """Collect trajectories from play episodes."""
        from backend.agents.data_agent import data_agent
        from backend.core.env_factory import build_env
        from backend.rl.trainer import RLTrainer

        trainer = RLTrainer()
        trainer.load_model(model_path)
        env, _ = build_env(env, level)

        controller = RuntimeController(trainer)
        results = controller.collect_data(model_path, env, episodes)  # Assume collect method
        traj = data_agent.collect_from_play(results)
        return {'trajectories': len(traj), 'qualified': len(data_agent.qualify_data(traj, 10.0))}

    def _tool_fine_tune_lora(self, model_path: str, trajectories: List, target: float):
        """LoRA fine-tune for target."""
        trainer = RLTrainer()
        trainer.load_model(model_path)
        metrics = trainer.fine_tune_lora(trajectories, epochs=3)
        new_path = trainer.save_model(f"{Path(model_path).stem}_lora.zip")
        return {'new_model': new_path, 'metrics': metrics}


# Global tool registry
tool_registry = ToolRegistry()
