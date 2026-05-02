"""Workflow state and configuration models."""
from typing import Dict, Any, Optional, TypedDict, List, Annotated
from dataclasses import dataclass
import operator

from backend.agents.planner import TrainingPlan


class WorkflowState(TypedDict):
    """State object that flows through the workflow nodes."""
    user_input: str

    plan: Optional[TrainingPlan]
    planning_complete: bool
    planning_error: Optional[str]

    training_complete: bool
    model_path: Optional[str]
    training_metrics: Optional[Dict[str, Any]]
    training_error: Optional[str]

    evaluation_complete: bool
    evaluation_results: Optional[Dict[str, Any]]
    evaluation_error: Optional[str]

    runtime_complete: bool
    runtime_results: Optional[Dict[str, Any]]
    runtime_error: Optional[str]

    success: bool
    final_output: Optional[str]
    error_message: Optional[str]

    iteration: int
    max_iterations: int
    logs: Annotated[List[str], operator.add]


@dataclass
class WorkflowConfig:
    """Configuration for workflow execution."""
    max_iterations: int = 3
    enable_retry: bool = True
    enable_curriculum: bool = True
    checkpoint_dir: str = "data/checkpoints"
    verbose: bool = True
