"""
RL Trainer module using Stable-Baselines3.
Supports multiple algorithms: PPO, A2C, DQN.
"""
import os
import json
import pickle
from datetime import datetime
from typing import Dict, Optional, Tuple, Any, Callable
import gymnasium as gym
from stable_baselines3 import PPO, A2C, DQN
from stable_baselines3.common.env_checker import check_env
from stable_baselines3.common.callbacks import BaseCallback, EvalCallback
from stable_baselines3.common.monitor import Monitor
import numpy as np


class MetricsCallback(BaseCallback):
    """Custom callback for tracking training metrics."""

    def __init__(self, verbose=0):
        super().__init__(verbose)
        self.metrics = {
            'episode_rewards': [],
            'episode_lengths': [],
            'timesteps': []
        }

    def _on_step(self) -> bool:
        if len(self.model.ep_info_buffer) > 0:
            info = self.model.ep_info_buffer[-1]
            if 'r' in info:
                self.metrics['episode_rewards'].append(info['r'])
            if 'l' in info:
                self.metrics['episode_lengths'].append(info['l'])
            self.metrics['timesteps'].append(self.num_timesteps)
        return True


class RLTrainer:
    """
    Main RL training class with support for multiple algorithms.
    Manages training, evaluation, and model persistence.
    """

    ALGORITHMS = {
        'PPO': PPO,
        'A2C': A2C,
        'DQN': DQN
    }

    def __init__(self,
                 model_dir: str = "data/models",
                 log_dir: str = "data/logs",
                 verbose: int = 1):
        self.model_dir = model_dir
        self.log_dir = log_dir
        self.verbose = verbose

        os.makedirs(model_dir, exist_ok=True)
        os.makedirs(log_dir, exist_ok=True)

        self.model = None
        self.env = None
        self.env_factory: Optional[Callable[[], Any]] = None
        self.training_metrics = {}
        self.config = {}

    def validate_environment(self, env) -> Tuple[bool, str]:
        """Validate that environment is compatible with SB3."""
        try:
            check_env(env, warn=True, skip_render_check=True)
            return True, "Environment is valid"
        except Exception as e:
            return False, str(e)

    def attach_env(
        self,
        env,
        env_id: Optional[str] = None,
        env_factory: Optional[Callable[[], Any]] = None,
    ) -> None:
        """Attach an environment and optional factory to the trainer."""
        self.env = Monitor(env, self.log_dir)

        resolved_env_id = env_id or getattr(getattr(env, "spec", None), "id", None)
        self.env_factory = env_factory

        if self.env_factory is None and resolved_env_id:
            self.env_factory = lambda: gym.make(resolved_env_id)

        env_label = resolved_env_id or env.__class__.__name__
        self.config = {**self.config, 'environment': env_label}

    def create_model(self,
                     env,
                     algorithm: str = "PPO",
                     config: Optional[Dict] = None,
                     env_id: Optional[str] = None,
                     env_factory: Optional[Callable[[], Any]] = None) -> Tuple[bool, str]:
        """
        Create RL model with specified algorithm and configuration.

        Args:
            env: Gymnasium environment
            algorithm: RL algorithm name (PPO, A2C, DQN)
            config: Algorithm-specific hyperparameters

        Returns:
            (success, message)
        """
        if algorithm not in self.ALGORITHMS:
            return False, f"Unsupported algorithm: {algorithm}"

        resolved_env_id = env_id or getattr(getattr(env, "spec", None), "id", None)
        self.env_factory = env_factory

        if self.env_factory is None:
            if resolved_env_id:
                self.env_factory = lambda: gym.make(resolved_env_id)
            else:
                env_cls = env.__class__
                self.env_factory = lambda: env_cls()

        # Default configurations
        default_configs = {
            'PPO': {
                'policy': 'MlpPolicy',
                'learning_rate': 3e-4,
                'n_steps': 2048,
                'batch_size': 64,
                'n_epochs': 10,
                'gamma': 0.99,
                'gae_lambda': 0.95,
                'clip_range': 0.2,
                'ent_coef': 0.0,
                'vf_coef': 0.5,
                'max_grad_norm': 0.5,
                'verbose': self.verbose
            },
            'A2C': {
                'policy': 'MlpPolicy',
                'learning_rate': 7e-4,
                'n_steps': 5,
                'gamma': 0.99,
                'ent_coef': 0.01,
                'vf_coef': 0.25,
                'max_grad_norm': 0.5,
                'verbose': self.verbose
            },
            'DQN': {
                'policy': 'MlpPolicy',
                'learning_rate': 1e-3,
                'buffer_size': 50000,
                'learning_starts': 1000,
                'batch_size': 32,
                'gamma': 0.99,
                'tau': 1.0,
                'train_freq': 4,
                'gradient_steps': 1,
                'target_update_interval': 10000,
                'exploration_fraction': 0.1,
                'exploration_final_eps': 0.01,
                'verbose': self.verbose
            }
        }

        # Merge configs
        algo_config = default_configs.get(algorithm, {})
        if config:
            algo_config.update(config)

        env_label = resolved_env_id or env.__class__.__name__
        self.config = {'algorithm': algorithm, 'environment': env_label, **algo_config}

        try:
            algo_class = self.ALGORITHMS[algorithm]
            self.env = Monitor(env, self.log_dir)
            self.model = algo_class(env=self.env, **algo_config)
            return True, f"Created {algorithm} model"
        except Exception as e:
            return False, f"Model creation failed: {str(e)}"

    def train(self,
              total_timesteps: int = 100000,
              eval_freq: int = 10000,
              n_eval_episodes: int = 5) -> Dict[str, Any]:
        """
        Train the RL model with evaluation callbacks.

        Args:
            total_timesteps: Total number of training timesteps
            eval_freq: Evaluate every N timesteps
            n_eval_episodes: Number of episodes for evaluation

        Returns:
            Dictionary containing training metrics
        """
        if self.model is None:
            raise ValueError("Model not created. Call create_model() first.")

        # Setup callbacks
        metrics_callback = MetricsCallback()
        if self.env_factory:
            eval_env = Monitor(self.env_factory())
        elif self.env is not None:
            eval_env = self.env
        else:
            raise ValueError("No environment available for evaluation.")

        eval_callback = EvalCallback(
            eval_env,
            best_model_save_path=os.path.join(self.model_dir, 'best_model'),
            log_path=self.log_dir,
            eval_freq=max(eval_freq, 1000),
            n_eval_episodes=n_eval_episodes,
            deterministic=True,
            render=False
        )

        # Train
        self.model.learn(
            total_timesteps=total_timesteps,
            callback=[metrics_callback, eval_callback],
            progress_bar=True if self.verbose else False
        )

        self.training_metrics = {
            'episode_rewards': metrics_callback.metrics['episode_rewards'],
            'episode_lengths': metrics_callback.metrics['episode_lengths'],
            'timesteps': metrics_callback.metrics['timesteps'],
            'total_timesteps': total_timesteps
        }

        return self.training_metrics

    def evaluate(self,
                 n_episodes: int = 10,
                 deterministic: bool = True) -> Dict[str, float]:
        """Evaluate trained model performance."""
        if self.model is None:
            raise ValueError("Model not trained yet.")

        env = self.env
        if env is None and self.env_factory is not None:
            env = Monitor(self.env_factory(), self.log_dir)

        if env is None:
            raise ValueError("No environment available for evaluation.")

        episode_rewards = []
        episode_lengths = []
        successes = 0

        for i in range(n_episodes):
            obs, _ = env.reset()
            done = False
            total_reward = 0
            steps = 0

            while not done:
                action, _states = self.model.predict(obs, deterministic=deterministic)
                obs, reward, done, _, info = env.step(action)
                total_reward += reward
                steps += 1

                if 'score' in info and info['score'] >= 100:  # Example success condition
                    successes += 1

            episode_rewards.append(total_reward)
            episode_lengths.append(steps)

        return {
            'mean_reward': np.mean(episode_rewards),
            'std_reward': np.std(episode_rewards),
            'mean_length': np.mean(episode_lengths),
            'success_rate': successes / n_episodes if n_episodes > 0 else 0.0
        }

    def save_model(self, filename: Optional[str] = None) -> str:
        """Save model to disk."""
        if self.model is None:
            raise ValueError("No model to save.")

        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{self.config.get('algorithm', 'model')}_{timestamp}.zip"

        model_path = os.path.join(self.model_dir, filename)
        self.model.save(model_path)

        # Save config and metadata
        metadata = {
            'config': self.config,
            'training_metrics': self.training_metrics,
            'saved_at': datetime.now().isoformat()
        }

        metadata_path = model_path.replace('.zip', '_meta.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        return model_path

    def load_model(self, model_path: str) -> bool:
        """Load model from disk."""
        try:
            algorithm = self._detect_algorithm(model_path)
            if algorithm not in self.ALGORITHMS:
                return False

            algo_class = self.ALGORITHMS[algorithm]
            self.model = algo_class.load(model_path)

            # Load metadata if exists
            metadata_path = model_path.replace('.zip', '_meta.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    self.config = metadata.get('config', {})
                    self.training_metrics = metadata.get('training_metrics', {})

            return True
        except Exception as e:
            print(f"Failed to load model: {e}")
            return False

    def _detect_algorithm(self, model_path: str) -> str:
        """Detect which algorithm was used to train the model."""
        # SB3 models store algorithm in the params
        try:
            import zipfile
            with zipfile.ZipFile(model_path, 'r') as zip_ref:
                if 'policy_kwargs.pkl' in zip_ref.namelist():
                    pass  # Could parse more
                # Simple heuristic based on file naming or params
                pass
        except:
            pass

        # Default to PPO if can't detect
        return 'PPO'

    def predict(self, obs, deterministic: bool = True):
        """Make prediction using trained model."""
        if self.model is None:
            raise ValueError("Model not loaded or trained.")
        return self.model.predict(obs, deterministic=deterministic)

    def get_action_space(self):
        """Get action space from the model."""
        if self.model:
            return self.model.action_space
        return None
