"""Environment factory helpers shared across API and tools."""
from typing import Callable, Tuple, Any


def build_env(environment: str, level: str = "basic") -> Tuple[Any, Callable[[], Any]]:
    """Create environment and a factory for recreating it."""
    if environment == "FlappyBird-v0":
        from backend.rl.environments import make_flappy_bird
        return make_flappy_bird(), lambda: make_flappy_bird()
    if environment == "AngryBird-v0":
        from backend.rl.angry_birds_env import make_angry_birds
        # Use rgb_array so VisualAugmentedEnv can capture frames
        return (
            make_angry_birds(render_mode="rgb_array", level=level),
            lambda: make_angry_birds(render_mode="rgb_array", level=level),
        )

    import gymnasium as gym
    return gym.make(environment), lambda: gym.make(environment)


def map_game_type(environment: str):
    """Map environment name to planner GameType."""
    from backend.agents.planner import GameType

    mapping = {
        "CartPole-v1": GameType.CARTPOLE,
        "FlappyBird-v0": GameType.FLAPPY_BIRD,
        "AngryBird-v0": GameType.ANGRY_BIRDS,
        "Pong-v0": GameType.PONG,
        "Breakout-v0": GameType.BREAKOUT,
    }
    return mapping.get(environment, GameType.CARTPOLE)
