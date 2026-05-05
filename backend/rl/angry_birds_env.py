"""
Angry Birds Environment: Gymnasium-compatible wrapper.
Simplified physics simulation for RL training.
"""
import gymnasium as gym
from gymnasium import spaces
import numpy as np
import math
from typing import Optional, Tuple, Dict, Any
from dataclasses import dataclass, field


@dataclass
class Bird:
    """Angry bird with type and state."""
    x: float
    y: float
    vx: float = 0.0
    vy: float = 0.0
    radius: float = 10.0
    type: str = 'red'  # red, yellow, blue, black
    active: bool = True

    def update(self, gravity: float = 0.5, friction: float = 0.99):
        """Update bird physics."""
        if not self.active:
            return
        self.vy += gravity
        self.vx *= friction
        self.x += self.vx
        self.y += self.vy


@dataclass
class Pig:
    """Target pig."""
    x: float
    y: float
    radius: float = 12.0
    health: float = 100.0
    alive: bool = True

    def take_damage(self, damage: float):
        """Apply damage to pig."""
        self.health -= damage
        if self.health <= 0:
            self.alive = False


@dataclass
class Block:
    """Destructible block (wood, stone, ice)."""
    x: float
    y: float
    width: float
    height: float
    material: str  # 'wood', 'stone', 'ice'
    health: float = 100.0
    destroyed: bool = False

    @property
    def center_x(self) -> float:
        return self.x + self.width / 2

    @property
    def center_y(self) -> float:
        return self.y + self.height / 2

    def take_damage(self, damage: float):
        """Apply damage considering material strength."""
        multiplier = {
            'wood': 1.0,
            'stone': 0.5,
            'ice': 2.0,
        }.get(self.material, 1.0)

        self.health -= damage * multiplier
        if self.health <= 0:
            self.destroyed = True


class AngryBirdsEnv(gym.Env):
    """
    Simplified Angry Birds environment for RL training.
    
    Observation Space (8D):
      0-1: Bird x, y (normalized 0-1)
      2-3: Bird velocity (vx, vy)
      4-5: Slingshot position (x, y)
      6: Bird type (0-3 for red, yellow, blue, black)
      7: Remaining birds count (normalized)
    
    Action Space (3D):
      0: Launch angle (0-180 degrees)
      1: Launch power (0-1)
      2: Bird type selection (0-3, optional)
    """

    metadata = {'render_modes': ['human', 'rgb_array'], 'render_fps': 30}

    def __init__(
        self,
        render_mode: Optional[str] = None,
        level: str = 'basic',
        max_birds: int = 5,
    ):
        super().__init__()

        self.render_mode = render_mode
        self.level = level
        self.max_birds = max_birds

        # World parameters
        self.world_width = 800
        self.world_height = 600
        self.gravity = 0.5
        self.slingshot_x = 100
        self.slingshot_y = 450

        # Action space: [angle (0-180), power (0-1), bird_type (0-3)]
        self.action_space = spaces.Box(
            low=np.array([0, 0, 0], dtype=np.float32),
            high=np.array([180, 1, 3], dtype=np.float32),
        )

        # Observation space (8 dimensions)
        self.observation_space = spaces.Box(
            low=np.array([0, 0, -20, -20, 0, 0, 0, 0], dtype=np.float32),
            high=np.array([1, 1, 20, 20, 1, 1, 4, 1], dtype=np.float32),
        )

        # Render
        self.screen = None
        self.clock = None

        # Initialize level
        self.reset()

    def reset(
        self,
        seed: Optional[int] = None,
        options: Optional[Dict] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        super().reset(seed=seed)

        # Reset bird
        self.current_bird = Bird(
            x=self.slingshot_x,
            y=self.slingshot_y,
            type='red',
        )
        self.current_bird_index = 0
        self.birds_remaining = self.max_birds

        # Setup level structures and pigs
        self._setup_level(self.level)

        # Episode tracking
        self.steps = 0
        self.total_damage = 0.0
        self.pigs_killed = 0
        self.episode_reward = 0.0
        self.done = False

        # History for rendering
        self.trajectory = []

        if self.render_mode == 'human':
            self._init_render()

        return self._get_observation(), {}

    def _setup_level(self, level: str):
        """Setup level layout - pigs and blocks."""
        self.pigs = []
        self.blocks = []

        if level == 'basic':
            # Simple level: 2 pigs with 1 wood block each
            self.pigs = [
                Pig(x=600, y=450),
                Pig(x=700, y=400),
            ]
            self.blocks = [
                Block(x=560, y=470, width=30, height=30, material='wood'),
                Block(x=660, y=420, width=30, height=30, material='wood'),
            ]
        elif level == 'medium':
            # Medium: pyramid
            self.pigs = [
                Pig(x=650, y=480),
                Pig(x=620, y=520),
                Pig(x=680, y=520),
            ]
            self.blocks = [
                Block(x=600, y=500, width=60, height=20, material='wood'),
                Block(x=580, y=540, width=30, height=60, material='stone'),
                Block(x=660, y=540, width=30, height=60, material='stone'),
            ]
        elif level == 'advanced':
            # Complex fortress
            self.pigs = [
                Pig(x=700, y=450),
                Pig(x=730, y=500),
                Pig(x=670, y=480),
            ]
            self.blocks = [
                Block(x=650, y=470, width=100, height=20, material='wood'),
                Block(x=640, y=490, width=20, height=60, material='stone'),
                Block(x=740, y=490, width=20, height=60, material='stone'),
            ]

    def step(
        self,
        action: np.ndarray,
    ) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        if self.done:
            raise RuntimeError("Episode is done. Call reset().")

        self.steps += 1

        # Decode action
        angle_deg, power, bird_type_idx = action
        angle_rad = math.radians(angle_deg)

        # Bird type selection
        bird_types = ['red', 'yellow', 'blue', 'black']
        bird_type = bird_types[int(bird_type_idx) % len(bird_types)]

        # If bird is at slingshot, launch it
        if self.current_bird.active and self.current_bird.x == self.slingshot_x:
            speed = 10 + power * 15  # 10-25 units
            self.current_bird.vx = math.cos(angle_rad) * speed
            self.current_bird.vy = -math.sin(angle_rad) * speed  # Negative because screen Y goes down
            self.current_bird.type = bird_type
            self.trajectory = [(self.current_bird.x, self.current_bird.y)]

        # Update bird physics
        self.current_bird.update(gravity=self.gravity)
        self.trajectory.append((self.current_bird.x, self.current_bird.y))

        # Check collisions
        reward = 0.0
        collision_occurred = False

        # Bird vs ground
        if self.current_bird.y > self.world_height - 50:  # Ground level
            self.current_bird.active = False
            collision_occurred = True

        # Bird vs structures
        for block in self.blocks:
            if block.destroyed:
                continue
            if self._check_circle_rect_collision(self.current_bird, block):
                # Apply damage based on bird type and speed
                speed = math.sqrt(self.current_bird.vx**2 + self.current_bird.vy**2)
                damage = speed * 0.5

                # Yellow birds do extra damage
                if self.current_bird.type == 'yellow':
                    damage *= 1.5
                # Black birds explode (area damage)
                elif self.current_bird.type == 'black':
                    damage *= 3.0

                block.take_damage(damage)
                self.total_damage += damage
                reward += damage * 0.01

                # Reflect velocity (simplified)
                self.current_bird.vx *= -0.5
                self.current_bird.vy *= -0.5

                if block.destroyed:
                    reward += 10.0

                collision_occurred = True

        # Bird vs pigs
        for pig in self.pigs:
            if not pig.alive:
                continue
            if self._check_circle_circle_collision(self.current_bird, pig):
                speed = math.sqrt(self.current_bird.vx**2 + self.current_bird.vy**2)
                damage = speed * 0.8
                pig.take_damage(damage)
                reward += 20.0

                if not pig.alive:
                    self.pigs_killed += 1
                    reward += 50.0  # Bonus for killing pig

                self.current_bird.active = False
                collision_occurred = True

        # Bird out of bounds
        if (self.current_bird.x < 0 or self.current_bird.x > self.world_width or
            self.current_bird.y < 0):
            self.current_bird.active = False
            collision_occurred = True

        # Step penalty (encourage efficiency)
        reward -= 0.1

        # Check if bird stopped
        if collision_occurred or not self.current_bird.active:
            # Next bird
            self.birds_remaining -= 1
            self.current_bird_index += 1

            if self.birds_remaining > 0:
                # Spawn new bird at slingshot
                self.current_bird = Bird(x=self.slingshot_x, y=self.slingshot_y)
            else:
                # No birds left - episode ends
                self.done = True

        # Check win condition
        if all(not pig.alive for pig in self.pigs):
            reward += 100.0  # Big bonus for clearing level
            self.done = True

        # Max steps
        if self.steps >= 1000:
            self.done = True

        self.episode_reward += reward

        return self._get_observation(), reward, self.done, False, {
            'score': self.pigs_killed * 100 + int(self.total_damage),
            'pigs_remaining': sum(1 for p in self.pigs if p.alive),
            'birds_remaining': self.birds_remaining,
        }

    def _check_circle_rect_collision(self, bird: Bird, block: Block) -> bool:
        """Check collision between circle (bird) and rectangle (block)."""
        # Find closest point on rectangle to circle center
        closest_x = max(block.x, min(bird.x, block.x + block.width))
        closest_y = max(block.y, min(bird.y, block.y + block.height))

        # Calculate distance
        dist_x = bird.x - closest_x
        dist_y = bird.y - closest_y
        distance = math.sqrt(dist_x**2 + dist_y**2)

        return distance < bird.radius

    def _check_circle_circle_collision(self, bird: Bird, pig: Pig) -> bool:
        """Check collision between two circles."""
        dx = bird.x - pig.x
        dy = bird.y - pig.y
        distance = math.sqrt(dx**2 + dy**2)
        return distance < (bird.radius + pig.radius)

    def _get_observation(self) -> np.ndarray:
        """Return normalized observation."""
        obs = np.zeros(8, dtype=np.float32)

        # Bird position (normalized)
        obs[0] = self.current_bird.x / self.world_width
        obs[1] = self.current_bird.y / self.world_height

        # Bird velocity (clipped)
        obs[2] = np.clip(self.current_bird.vx / 20, -1, 1)
        obs[3] = np.clip(self.current_bird.vy / 20, -1, 1)

        # Slingshot position (normalized)
        obs[4] = self.slingshot_x / self.world_width
        obs[5] = self.slingshot_y / self.world_height

        # Bird type (0=red, 1=yellow, 2=blue, 3=black)
        bird_types = {'red': 0, 'yellow': 1, 'blue': 2, 'black': 3}
        obs[6] = bird_types.get(self.current_bird.type, 0) / 4

        # Birds remaining
        obs[7] = self.birds_remaining / self.max_birds

        return obs

    def render(self) -> Optional[np.ndarray]:
        if self.render_mode == 'rgb_array':
            return self._render_frame()
        elif self.render_mode == 'human':
            self._render_human()

    def _render_human(self):
        """Render to screen (requires pygame)."""
        import pygame

        if self.screen is None:
            self._init_render()

        self._draw_frame()
        pygame.display.flip()
        self.clock.tick(self.metadata['render_fps'])

    def _render_frame(self) -> np.ndarray:
        """Render to RGB array."""
        import pygame

        if self.screen is None:
            self._init_render()

        self._draw_frame()
        return np.transpose(
            np.array(pygame.surfarray.pixels3d(self.screen)),
            (1, 0, 2)
        )

    def _draw_frame(self):
        """Draw current frame."""
        import pygame

        if hasattr(self, 'assets') and 'bg' in self.assets:
            self.screen.blit(self.assets['bg'], (0, 0))
        else:
            self.screen.fill((135, 206, 235))  # Sky blue
            # Draw ground
            pygame.draw.rect(
                self.screen,
                (139, 115, 85),
                (0, self.world_height - 50, self.world_width, 50)
            )

        # Draw slingshot
        slingshot_rect = pygame.Rect(
            self.slingshot_x - 10,
            self.slingshot_y,
            20,
            60
        )
        pygame.draw.rect(self.screen, (101, 67, 33), slingshot_rect)

        # Draw trajectory
        if len(self.trajectory) > 1:
            points = [(int(x), int(y)) for x, y in self.trajectory]
            pygame.draw.lines(self.screen, (255, 255, 0), False, points, 2)

        # Draw blocks
        for block in self.blocks:
            if block.destroyed:
                continue
            color = {
                'wood': (139, 69, 19),
                'stone': (128, 128, 128),
                'ice': (173, 216, 230),
            }.get(block.material, (255, 255, 255))
            rect = pygame.Rect(block.x, block.y, block.width, block.height)
            pygame.draw.rect(self.screen, color, rect)
            pygame.draw.rect(self.screen, (0, 0, 0), rect, 2)

        # Draw pigs
        for pig in self.pigs:
            if not pig.alive:
                continue
            if hasattr(self, 'assets') and 'pig' in self.assets:
                self.screen.blit(self.assets['pig'], (int(pig.x - pig.radius), int(pig.y - pig.radius)))
            else:
                color = (255, 182, 193)  # Pink
                pygame.draw.circle(
                    self.screen,
                    color,
                    (int(pig.x), int(pig.y)),
                    int(pig.radius)
                )
                # Pig nose
                pygame.draw.circle(
                    self.screen,
                    (255, 105, 180),
                    (int(pig.x), int(pig.y)),
                    5
                )

        # Draw current bird at slingshot or in flight
        if self.current_bird.active:
            if hasattr(self, 'assets') and 'red_bird' in self.assets:
                self.screen.blit(self.assets['red_bird'], (int(self.current_bird.x - self.current_bird.radius), int(self.current_bird.y - self.current_bird.radius)))
            else:
                bird_color = {
                    'red': (255, 0, 0),
                    'yellow': (255, 255, 0),
                    'blue': (0, 0, 255),
                    'black': (0, 0, 0),
                }.get(self.current_bird.type, (255, 0, 0))
                pygame.draw.circle(
                    self.screen,
                    bird_color,
                    (int(self.current_bird.x), int(self.current_bird.y)),
                    int(self.current_bird.radius)
                )

        # Draw score
        font = pygame.font.Font(None, 36)
        score = sum(1 for p in self.pigs if not p.alive) * 100
        score_text = font.render(f"Score: {score}", True, (255, 255, 255))
        self.screen.blit(score_text, (10, 10))

    def _init_render(self):
        import pygame
        import os
        pygame.init()
        pygame.display.init()
        self.screen = pygame.display.set_mode((self.world_width, self.world_height))
        pygame.display.set_caption("Angry Birds RL")
        self.clock = pygame.time.Clock()
        
        # Load realistic assets
        self.assets = {}
        try:
            assets_dir = os.path.join(os.path.dirname(__file__), '..', 'assets')
            bg = pygame.image.load(os.path.join(assets_dir, 'bg.png')).convert()
            self.assets['bg'] = pygame.transform.scale(bg, (self.world_width, self.world_height))
            
            for name, size in [('red_bird', 30), ('pig', 24)]:
                img = pygame.image.load(os.path.join(assets_dir, f'{name}.png')).convert_alpha()
                # Treat white as transparent
                img.set_colorkey((255, 255, 255))
                self.assets[name] = pygame.transform.scale(img, (size, size))
        except Exception as e:
            print(f"Failed to load assets: {e}")

    def close(self):
        if self.screen is not None:
            import pygame
            pygame.display.quit()
            pygame.quit()
            self.screen = None


def make_angry_birds(render_mode: Optional[str] = None, level: str = 'basic') -> AngryBirdsEnv:
    """Factory function for Angry Birds environment."""
    return AngryBirdsEnv(render_mode=render_mode, level=level)
