"""Compatibility wrapper — re-exports from the canonical registry module."""
from backend.registry.tools import TOOL_SCHEMAS, ToolRegistry, tool_registry

__all__ = [
    "TOOL_SCHEMAS",
    "ToolRegistry",
    "tool_registry",
]
