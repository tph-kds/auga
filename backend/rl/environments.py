"""
Custom Flappy Bird Environment wrapper using Gymnasium.
Implements the game logic and observation space.
"""
import gymnasium as gym
from gymnasium import spaces
import numpy as np
import pygame
import time


class FlappyBirdEnv(gym.Env):
    """Flappy Bird environment compatible with Stable-Baselines3."""

    metadata = {'render_modes': ['human', 'rgb_array'], 'render_fps': 30}

    def __init__(self, render_mode=None):
        super(FlappyBirdEnv, self).__init__()

        # Action space: 0 = do nothing, 1 = flap
        self.action_space = spaces.Discrete(2)

        # Observation space: bird y, bird velocity, pipe x, pipe gap y
        self.observation_space = spaces.Box(
            low=np.array([0, -10, 0, 0]),
            high=np.array([480, 10, 288, 480]),
            dtype=np.float32
        )

        self.render_mode = render_mode
        self.screen = None
        self.clock = None

        # Game parameters
        self.width = 288
        self.height = 480
        self.gravity = 0.5
        self.lift = -8
        self.pipe_speed = 3
        self.pipe_gap = 150
        self.pipe_frequency = 1800  # ms

        self.reset()

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.bird_y = self.height // 2
        self.bird_vel = 0
        self.pipes = []
        self.score = 0
        self.last_pipe_time = 0
        self.frame_count = 0
        self.done = False

        if self.render_mode == "human":
            self._init_render()

        return self._get_obs(), {}

    def step(self, action):
        if action == 1:  # Flap
            self.bird_vel = self.lift

        # Apply gravity
        self.bird_vel += self.gravity
        self.bird_y += self.bird_vel

        # Floor and ceiling collision
        if self.bird_y <= 0 or self.bird_y >= self.height:
            self.done = True

        # Manage pipes
        current_time = pygame.time.get_ticks() if pygame.get_init() else self.frame_count * 16
        if current_time - self.last_pipe_time > self.pipe_frequency:
            gap_y = self.np_random.integers(100, self.height - 100)
            self.pipes.append({
                'x': self.width,
                'top_height': gap_y - self.pipe_gap // 2,
                'bottom_y': gap_y + self.pipe_gap // 2
            })
            self.last_pipe_time = current_time

        # Move pipes and check collisions
        pipes_to_remove = []
        for pipe in self.pipes:
            pipe['x'] -= self.pipe_speed

            # Score when passing pipe
            if pipe['x'] < 100 and pipe.get('scored', False) == False:
                self.score += 1
                pipe['scored'] = True

            # Collision check
            if 100 < pipe['x'] < 140:  # Bird x position ~120
                if self.bird_y < pipe['top_height'] or self.bird_y > pipe['bottom_y']:
                    self.done = True

            # Remove off-screen pipes
            if pipe['x'] < -50:
                pipes_to_remove.append(pipe)

        for pipe in pipes_to_remove:
            self.pipes.remove(pipe)

        self.frame_count += 1

        # Reward calculation
        reward = 0.1  # Small reward for staying alive
        if self.done:
            reward = -1.0

        return self._get_obs(), reward, self.done, False, {'score': self.score}

    def _get_obs(self):
        # Return the nearest pipe's info or default if no pipes
        if self.pipes:
            nearest_pipe = min(self.pipes, key=lambda p: abs(p['x'] - 100))
            obs = np.array([
                self.bird_y / self.height,
                self.bird_vel / 10.0,
                nearest_pipe['x'] / self.width,
                (nearest_pipe['bottom_y'] - nearest_pipe['top_height']) / self.height
            ], dtype=np.float32)
        else:
            obs = np.array([self.bird_y / self.height, self.bird_vel / 10.0, 1.0, 0.5], dtype=np.float32)

        return obs

    def render(self):
        if self.render_mode == "rgb_array":
            return self._render_frame()

    def _init_render(self):
        pygame.init()
        pygame.display.init()
        self.screen = pygame.display.set_mode((self.width, self.height))
        pygame.display.set_caption("Flappy Bird")
        self.clock = pygame.time.Clock()

    def _render_frame(self):
        if self.screen is None:
            self._init_render()

        canvas = pygame.Surface((self.width, self.height))
        canvas.fill((135, 206, 235))  # Sky blue

        # Draw ground
        pygame.draw.rect(canvas, (222, 184, 135), (0, self.height - 50, self.width, 50))

        # Draw pipes
        for pipe in self.pipes:
            pygame.draw.rect(canvas, (0, 200, 0), (pipe['x'], 0, 50, pipe['top_height']))
            pygame.draw.rect(canvas, (0, 200, 0), (pipe['x'], pipe['bottom_y'], 50, self.height))

        # Draw bird
        pygame.draw.circle(canvas, (255, 255, 0), (100, int(self.bird_y)), 15)

        # Draw score
        font = pygame.font.Font(None, 36)
        score_text = font.render(str(self.score), True, (255, 255, 255))
        canvas.blit(score_text, (self.width // 2, 50))

        if self.render_mode == "human":
            self.screen.blit(canvas, (0, 0))
            pygame.display.flip()
            self.clock.tick(self.metadata['render_fps'])
        else:
            return np.transpose(np.array(pygame.surfarray.pixels3d(canvas)), (1, 0, 2))

    def close(self):
        if self.screen is not None:
            pygame.display.quit()
            pygame.quit()
            self.screen = None


def make_flappy_bird(render_mode=None):
    """Factory function to create Flappy Bird environment."""
    return FlappyBirdEnv(render_mode=render_mode)


# Register Angry Birds environment
from .angry_birds_env import AngryBirdsEnv, make_angry_birds

# Gym registration
gym.register(
    id='AngryBird-v0',
    entry_point='backend.rl.environments:make_angry_birds',
    max_episode_steps=1000,
)
