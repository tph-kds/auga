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

from backend.services.validation import ValidationResult

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
                    stderr_lines.append(line)
                else:
                    stdout_lines.append(line)

            # Get artifacts (generated files)
            artifacts = self._collect_artifacts(container)

            # Cleanup
            container.remove(v=True)

            return SandboxResult(
                success=success,
                exit_code=container.attrs['State']['ExitCode'] if success else -1,
                stdout='\n'.join(stdout_lines),
                stderr='\n'.join(stderr_lines),
                logs=logs.split('\n'),
                artifacts=artifacts,
                execution_time=execution_time
            )

        except Exception as e:
            logger.error(f"Sandbox execution failed: {e}")
            return SandboxResult(
                success=False,
                exit_code=-1,
                stdout="",
                stderr=str(e),
                logs=[f"Sandbox error: {e}"],
                artifacts=[],
                execution_time=0.0
            )

    def _collect_artifacts(self, container) -> List[str]:
        """Collect generated artifact files from container."""
        artifacts = []

        try:
            # Create tar archive of container filesystem
            stream, _ = container.get_archive('/workspace/data')

            # Parse tar stream
            tar_data = b''
            for chunk in stream:
                tar_data += chunk

            # Extract file list (not actual files for now)
            tar = tarfile.open(fileobj=io.BytesIO(tar_data))
            for member in tar.getmembers():
                if member.isfile() and 'models/' in member.name:
                    artifacts.append(member.name)

            tar.close()

        except Exception as e:
            logger.debug(f"Could not collect artifacts: {e}")

        return artifacts

    def validate_environment(self) -> ValidationResult:
        """Validate Docker environment is ready."""
        try:
            # Test Docker daemon
            version = self.client.version()
            logger.info(f"Docker version: {version.get('Version', 'unknown')}")

            # Ensure image exists
            images = self.client.images.list(name=self.config.image)
            if not images:
                return ValidationResult(
                    False,
                    f"Sandbox image '{self.config.image}' not found. Build it first.",
                    severity="error"
                )

            return ValidationResult(True, "Docker environment OK")

        except Exception as e:
            return ValidationResult(
                False,
                f"Docker validation failed: {e}",
                severity="error"
            )

    def cleanup(self):
        """Clean up dangling containers and images."""
        try:
            # Remove stopped containers
            containers = self.client.containers.list(all=True, filters={'status': 'exited'})
            for container in containers:
                if 'rl-sandbox' in container.name:
                    container.remove(v=True)

            # Remove dangling images
            self.client.images.prune(filters={'dangling': True})

            logger.info("Sandbox cleanup complete")
        except Exception as e:
            logger.error(f"Cleanup failed: {e}")


class SandboxRunner:
    """
    High-level runner that executes training scripts in Docker sandbox.
    Handles file upload, execution, and result retrieval.
    """

    def __init__(self, sandbox: Optional[DockerSandbox] = None):
        self.sandbox = sandbox or DockerSandbox()

    def run_script(self, script_content: str, job_id: Optional[str] = None) -> SandboxResult:
        """Run a Python script in the sandbox."""
        import time

        job_id = job_id or f"job_{int(time.time())}"

        with tempfile.NamedTemporaryFile(suffix='.py', delete=False) as temp_file:
            temp_file.write(script_content.encode('utf-8'))
            temp_file_path = temp_file.name

        try:
            result = self.sandbox.run_training_job(job_id, temp_file_path)
            return result
        finally:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)


def execute_in_sandbox(script_content: str) -> SandboxResult:
    """Convenience function for sandbox execution."""
    runner = SandboxRunner()
    return runner.run_script(script_content)
