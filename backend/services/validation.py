"""
Safety and Validation Module: Input validation, execution sandbox checks.
Implements hooks for before/after training execution as per Claude Code standards.
"""
import ast
import operator
import re
import hashlib
import logging
from typing import Dict, List, Any, Optional, Callable, Tuple
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

logger = logging.getLogger(__name__)


class ValidationLevel(Enum):
    """Validation strictness levels."""
    PERMISSIVE = "permissive"
    STANDARD = "standard"
    STRICT = "strict"


class SafetyViolation(Exception):
    """Raised when a safety check fails."""
    pass


@dataclass
class ValidationResult:
    """Result of a validation check."""
    valid: bool
    message: str
    severity: str = "error"  # error, warning, info
    metadata: Dict[str, Any] = None

    @property
    def is_valid(self) -> bool:
        """Alias for valid — for clean property access."""
        return self.valid


class SafetyValidator:
    """
    Validates user inputs, code, and configurations for safe execution.
    Implements multiple layers of validation.
    """

    # Dangerous patterns to block
    DANGEROUS_PATTERNS = [
        r'__import__',
        r'eval\(',
        r'exec\(',
        r'compile\(',
        r'open\(',
        r'subprocess',
        r'os\.system',
        r'\.popen',
        r'socket',
        r'requests\.get',
        r'urllib',
        r'pickle\.load',
        r'shelve\.open',
        r'<?php',
        r'<script',
        r'javascript:',
        r'data:',
    ]

    # Allowed operations for mathematical expressions
    SAFE_OPERATORS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
        ast.FloorDiv: operator.floordiv,
        ast.Mod: operator.mod
    }

    def __init__(self, level: ValidationLevel = ValidationLevel.STANDARD):
        self.level = level
        self.violations = []

    def validate_user_input(self, user_input: str) -> ValidationResult:
        """Validate natural language user input for malicious content."""
        checks = [
            self._check_length(user_input),
            self._check_dangerous_patterns(user_input),
            self._check_script_tags(user_input),
            self._check_unicode_tricks(user_input)
        ]

        for check in checks:
            if not check.valid:
                return check

        return ValidationResult(True, "Input valid")

    def validate_config(self, config: Dict) -> ValidationResult:
        """Validate training configuration dictionary."""
        required_keys = ['environment', 'algorithm']
        for key in required_keys:
            if key not in config:
                return ValidationResult(
                    False,
                    f"Missing required config key: {key}"
                )

        # Validate environment name
        allowed_envs = [
            'CartPole-v1', 'FlappyBird-v0', 'AngryBird-v0', 'Pong-v0', 'Breakout-v0'
        ]
        if config['environment'] not in allowed_envs:
            return ValidationResult(
                False,
                f"Environment not allowed: {config['environment']}"
            )

        # Validate algorithm
        allowed_algos = ['PPO', 'A2C', 'DQN']
        if config['algorithm'] not in allowed_algos:
            return ValidationResult(
                False,
                f"Algorithm not allowed: {config['algorithm']}"
            )

        # Validate timesteps range
        if 'total_timesteps' in config:
            timesteps = config['total_timesteps']
            if not isinstance(timesteps, int) or timesteps < 100 or timesteps > 10_000_000:
                return ValidationResult(
                    False,
                    "Invalid timesteps: must be between 100 and 10M"
                )

        # Validate hyperparameters
        if 'hyperparameters' in config:
            hp = config['hyperparameters']
            if not isinstance(hp, dict):
                return ValidationResult(False, "Hyperparameters must be a dict")

            for key, value in hp.items():
                if not isinstance(value, (int, float)):
                    return ValidationResult(
                        False,
                        f"Hyperparameter {key} must be numeric"
                    )

        return ValidationResult(True, "Config valid")

    # Alias for backward compatibility
    def validate_training_config(self, config: Dict) -> ValidationResult:
        """Alias for validate_config."""
        return self.validate_config(config)

    def validate_code_snippet(self, code: str) -> ValidationResult:
        """
        Validate Python code snippets for safe execution.
        Uses AST parsing to check for unsafe operations.
        """
        try:
            tree = ast.parse(code)

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name in ['subprocess', 'os', 'sys', 'socket', 'pickle']:
                            return ValidationResult(
                                False,
                                f"Import of {alias.name} not allowed"
                            )
                elif isinstance(node, ast.ImportFrom):
                    if node.module in ['subprocess', 'os', 'sys', 'socket', 'pickle']:
                        return ValidationResult(
                            False,
                            f"Import from {node.module} not allowed"
                        )
                elif isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Name):
                        func_name = node.func.id
                        if func_name in ['eval', 'exec', 'compile', '__import__']:
                            return ValidationResult(
                                False,
                                f"Function {func_name} not allowed"
                            )

            return ValidationResult(True, "Code snippet safe")

        except SyntaxError as e:
            return ValidationResult(False, f"Invalid syntax: {e}")

    def validate_model_path(self, path: str) -> ValidationResult:
        """Validate model file path for path traversal attacks."""
        resolved = Path(path).resolve()

        # Check if path escapes allowed directories
        allowed_dirs = [
            Path('data/models').resolve(),
            Path('data/checkpoints').resolve()
        ]

        for allowed_dir in allowed_dirs:
            try:
                resolved.relative_to(allowed_dir)
                return ValidationResult(True, "Path is within allowed directories")
            except ValueError:
                continue

        return ValidationResult(
            False,
            "Path outside allowed directories"
        )

    def _check_length(self, text: str, max_length: int = 10000) -> ValidationResult:
        if len(text) > max_length:
            return ValidationResult(
                False,
                f"Input too long ({len(text)} > {max_length})"
            )
        return ValidationResult(True, "Length OK")

    def _check_dangerous_patterns(self, text: str) -> ValidationResult:
        for pattern in self.DANGEROUS_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return ValidationResult(
                    False,
                    f"Dangerous pattern detected: {pattern}"
                )
        return ValidationResult(True, "No dangerous patterns")

    def _check_script_tags(self, text: str) -> ValidationResult:
        if re.search(r'<script[^>]*>.*?</script>', text, re.IGNORECASE | re.DOTALL):
            return ValidationResult(False, "Script tags detected")
        return ValidationResult(True, "No script tags")

    def _check_unicode_tricks(self, text: str) -> ValidationResult:
        # Check for homograph attacks and unusual unicode
        unusual_chars = sum(1 for c in text if ord(c) > 0xFFFF)
        if unusual_chars > len(text) * 0.1:
            return ValidationResult(
                False,
                "Excessive unusual Unicode characters"
            )
        return ValidationResult(True, "Unicode OK")


class HookManager:
    """
    Manages before/after hooks as per Claude Code standards.
    Hooks allow control and monitoring at key execution points.
    """

    def __init__(self):
        self.hooks: Dict[str, List[Callable]] = {
            'before_train': [],
            'after_train': [],
            'before_eval': [],
            'after_eval': [],
            'before_play': [],
            'after_play': [],
            'before_tool_call': [],
            'after_tool_call': []
        }

    def register(self, hook_name: str, func: Callable):
        """Register a hook function."""
        if hook_name not in self.hooks:
            raise ValueError(f"Unknown hook: {hook_name}")
        self.hooks[hook_name].append(func)

    def run_hooks(self, hook_name: str, *args, **kwargs) -> List:
        """Run all hooks for a given hook name."""
        results = []
        if hook_name in self.hooks:
            for hook in self.hooks[hook_name]:
                try:
                    results.append(hook(*args, **kwargs))
                except Exception as e:
                    logger.error(f"Hook {hook_name} failed: {e}")
        return results

    def clear_hooks(self, hook_name: Optional[str] = None):
        """Clear hooks for a given hook name or all hooks."""
        if hook_name:
            if hook_name in self.hooks:
                self.hooks[hook_name] = []
        else:
            for key in self.hooks:
                self.hooks[key] = []
