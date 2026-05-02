"""
Project Configuration: Central config for the autonomous RL agent system.
"""
import os
from dataclasses import dataclass, asdict
from typing import Optional

# Base paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
MODELS_DIR = DATA_DIR / "models"
LOGS_DIR = DATA_DIR / "logs"
CHECKPOINTS_DIR = DATA_DIR / "checkpoints"
DB_PATH = DATA_DIR / "memory" / "memory.db"

# Ensure directories exist
for directory in [DATA_DIR, MODELS_DIR, LOGS_DIR, CHECKPOINTS_DIR, DATA_DIR / "memory"]:
    directory.mkdir(parents=True, exist_ok=True)


@dataclass
class DatabaseConfig:
    """Database configuration."""
    path: str = str(DB_PATH)
    echo: bool = False
    pool_size: int = 5


@dataclass
class TrainerConfig:
    """RL trainer configuration."""
    default_algorithm: str = "PPO"
    default_timesteps: int = 100000
    eval_frequency: int = 10000
    n_eval_episodes: int = 10
    verbose: int = 1


@dataclass
class ControllerConfig:
    """Runtime controller configuration."""
    max_episodes: int = 1000
    max_steps_per_episode: int = 10000
    success_threshold: float = 0.9
    consecutive_successes_required: int = 10
    eval_frequency: int = 10
    retry_limit: int = 3
    early_stopping_patience: int = 50


@dataclass
class SafetyConfig:
    """Safety and validation configuration."""
    validation_level: str = "standard"
    max_input_length: int = 10000
    enable_sandbox: bool = True
    sandbox_timeout: int = 3600
    sandbox_memory_limit: str = "2g"


@dataclass
class APIConfig:
    """API server configuration."""
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    cors_origins: list = None

    def __post_init__(self):
        if self.cors_origins is None:
            self.cors_origins = ["*"]


@dataclass
class SystemConfig:
    """Main system configuration."""
    database: DatabaseConfig = DatabaseConfig()
    trainer: TrainerConfig = TrainerConfig()
    controller: ControllerConfig = ControllerConfig()
    safety: SafetyConfig = SafetyConfig()
    api: APIConfig = APIConfig()

    log_level: str = "INFO"
    enable_monitoring: bool = True
    checkpoint_interval: int = 10000


# Global config instance
config = SystemConfig()
