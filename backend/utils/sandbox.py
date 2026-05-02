"""
Docker Sandbox: Safe execution environment for untrusted code and training.
Runs RL training jobs in isolated containers with resource limits.
"""
import docker
import tempfile
import tarfile
import io
import os
import json
import logging
from pathlib import Path
from typing import Dict, Optional, Any, List
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class SandboxConfig:
    """Configuration for sandbox execution."""
    image: str = "rl-sandbox:latest"
    memory_limit: str = "2g"
    cpu_limit: float = 1.0
    timeout_seconds: int = 3600
    network_disabled: bool = True
    read_only: bool = True
    volumes: Dict[str, str] = None

    def __post_init__(self):
        if self.volumes is None:
            self.volumes = {}


@dataclass
class SandboxResult:
    """Result from sandbox execution."""
    success: bool
    exit_code: int
    stdout: str
    stderr: str
    logs: List[str]
    artifacts: List[str]
    execution_time: float


class DockerSandbox:
    """
    Docker-based sandbox for safe execution of RL training jobs.
    Provides isolation, resource limits, and timeout protection.
    """

    def __init__(self, config: Optional[SandboxConfig] = None):
        self.config = config or SandboxConfig()
        self.client = None
        self._ensure_image()

    def _ensure_image(self):
        """Ensure the sandbox Docker image exists."""
        try:
            self.client = docker.from_env()

            # Check if image exists
            images = self.client.images.list(name=self.config.image)
            if not images:
                logger.warning(f"Image {self.config.image} not found. Build it first.")
        except Exception as e:
            logger.error(f"Docker connection failed: {e}")
            raise

    def build_image(self, dockerfile_path: str = "docker/Dockerfile"):
        """Build the sandbox Docker image."""
        dockerfile = Path(dockerfile_path)
        if not dockerfile.exists():
            raise FileNotFoundError(f"Dockerfile not found at {dockerfile_path}")

        image, logs = self.client.images.build(
            path=str(dockerfile.parent),
            dockerfile=str(dockerfile.name),
            tag=self.config.image
        )

        logger.info(f"Built sandbox image: {image.tags}")
        return image

    def run_training_job(self,
                        job_id: str,
                        script_path: str,
                        env_vars: Optional[Dict] = None,
                        mount_workspace: bool = True) -> SandboxResult:
        """
        Run a training job in the sandbox.

        Args:
            job_id: Unique job identifier
            script_path: Path to training script inside container
            env_vars: Environment variables to set
            mount_workspace: Whether to mount current workspace

        Returns:
            SandboxResult with execution output
        """
        import time

        env_vars = env_vars or {}
        volumes = {}

        # Mount workspace if requested
        if mount_workspace:
            workspace = Path.cwd().resolve()
            volumes[str(workspace)] = {'bind': '/workspace', 'mode': 'ro'}

        # Add configured volumes
        volumes.update(self.config.volumes)

        # Container configuration
        container_config = {
            'image': self.config.image,
            'command': ['python', script_path],
            'environment': env_vars,
            'volumes': volumes,
            'mem_limit': self.config.memory_limit,
            'cpu_quota': int(self.config.cpu_limit * 100000),
            'network_disabled': self.config.network_disabled,
            'read_only': self.config.read_only,
            'detach': True,
            'stdout': True,
            'stderr': True,
            'working_dir': '/workspace'
        }

        try:
            # Start container
            container = self.client.containers.run(**container_config)
            start_time = time.time()

            # Wait for completion with timeout
            try:
                container.wait(timeout=self.config.timeout_seconds)
                success = True
            except Exception as e:
                logger.warning(f"Container timeout or error: {e}")
                container.kill()
                success = False

            execution_time = time.time() - start_time

            # Collect output
            logs = container.logs(stdout=True, stderr=True).decode('utf-8', errors='replace')
            stdout_lines = []
            stderr_lines = []

            for line in logs.split('\n'):
                if '[ERROR]' in line or 'Traceback' in line:
                    """Compatibility wrapper for sandbox utilities."""
                    from backend.services.sandbox import (
                        SandboxConfig,
                        SandboxResult,
                        DockerSandbox,
                        SandboxRunner,
                        execute_in_sandbox,
                    )

                    __all__ = [
                        "SandboxConfig",
                        "SandboxResult",
                        "DockerSandbox",
                        "SandboxRunner",
                        "execute_in_sandbox",
                    ]
                artifacts=artifacts,
